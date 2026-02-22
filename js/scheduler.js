import {
  TIME_SLOTS,
  DAYS,
  COURSE_DURATION,
  DEFAULT_MAX_SLOTS_PER_COURSE_PER_DAY,
} from "./config.js";

// Maximum number of continuous classes (blocks) a lecturer
// can teach in a row on the same day, without any free slot
// between them.
// With 2-hour classes on 1-hour slots, this effectively limits
// a lecturer to at most 2 back-to-back classes in a row.
const MAX_CONTINUOUS_CLASSES_PER_LECTURER = 2;

export function generateSchedule(courses, constraints = {}) {
  const {
    minCoursesPerSlot = 0,
    maxCoursesPerSlot = 3,
    maxSlotsPerCoursePerDay = DEFAULT_MAX_SLOTS_PER_COURSE_PER_DAY,
  } = constraints;

  // Group courses by programme and year
  const courseGroups = {};

  courses.forEach((course) => {
    const key = `${course.programme_name}_${course.course_year}`;
    if (!courseGroups[key]) {
      courseGroups[key] = [];
    }
    courseGroups[key].push(course);
  });

  // Initialize timetable structure
  const timetable = initializeTimetable();

  // Track lecturer availability at slot level
  const lecturerSchedule = {};

  // Track lecturer blocks (start/end) per day for gap rules
  // Shape: { [lecturerId]: { [day]: [{ start, end }, ...] } }
  const lecturerBlocks = {};

  // Track programme-year occupancy
  const programmeYearSchedule = {};

  // Track how many slots each programme+year uses per day
  const programmeDayUsage = {};

  // Sort courses by constraints (most constrained first)
  const allCourses = [...courses];
  allCourses.sort((a, b) => {
    const groupA = courseGroups[`${a.programme_name}_${a.course_year}`].length;
    const groupB = courseGroups[`${b.programme_name}_${b.course_year}`].length;
    return groupB - groupA;
  });

  // Precompute preferred (day, start-slot) order:
  // 1. Central daytime blocks (10–12, 12–2, 2–4) across all days
  // 2. Other blocks
  // 3. Outer blocks (8–10, 4–6) across all days
  const daySlotOrder = getPreferredDaySlotOrder();

  // Try to assign each course
  for (const course of allCourses) {
    let assigned = false;

    const durationSlots = Number(course.duration_hours) || COURSE_DURATION;

    // Try each possible (day, start-slot) in global preferred order
    for (const { day, startSlotId } of daySlotOrder) {
      const startIndex = TIME_SLOTS.findIndex((s) => s.id === startSlotId);
      if (startIndex === -1) continue;

      const endIndex = startIndex + durationSlots - 1;
      if (endIndex >= TIME_SLOTS.length) continue;

      const startSlot = TIME_SLOTS.find((s) => s.id === startSlotId);
      const endSlot = TIME_SLOTS[endIndex];

      // Check if adding this course would exceed max courses per slot
      const currentSlotCourses = timetable[day][startSlot.id].length;
      if (currentSlotCourses >= maxCoursesPerSlot) {
        continue; // Skip this slot if max courses reached
      }

      if (
        !canAssignSlotsForProgrammeDay(
          course,
          day,
          startSlot.id,
          maxSlotsPerCoursePerDay,
          programmeDayUsage,
        )
      ) {
        continue;
      }

      if (
        canAssignCourse(
          course,
          day,
          startSlot.id,
          durationSlots,
          lecturerSchedule,
          lecturerBlocks,
          programmeYearSchedule,
        )
      ) {
        // Assign course
        timetable[day][startSlot.id].push({
          ...course,
          startSlot: startSlot.id,
          endSlot: endSlot.id,
          timeRange: `${startSlot.time} - ${getEndTimeWithDuration(startSlot.id, durationSlots)}`,
        });

        // Update schedules
        updateSchedules(
          course,
          day,
          startSlot.id,
          durationSlots,
          lecturerSchedule,
          lecturerBlocks,
          programmeYearSchedule,
          programmeDayUsage,
        );

        assigned = true;
        break;
      }
    }

    if (!assigned) {
      console.error(`Could not assign course: ${course.course_code}`);
      return null;
    }
  }

  return timetable;
}

// Determine preferred global order of (day, start-slot) pairs.
// Prioritises 10:00–16:00 on all days first, then outer slots (08–10, 16+).
// Within each priority band, sort day-major then chronologically so
// courses pack sequentially without gaps.
function getPreferredDaySlotOrder() {
  const pairs = [];

  // Only consider slots that can start a full class (need a following slot)
  const candidateSlots = TIME_SLOTS.slice(0, -1);

  DAYS.forEach((day, dayIndex) => {
    candidateSlots.forEach((slot, slotIndex) => {
      const hour = parseInt(slot.time.split(":")[0], 10);
      pairs.push({
        day,
        dayIndex,
        startSlotId: slot.id,
        slotIndex,
        hour,
      });
    });
  });

  function rank(hour) {
    // Core window 10:00–15:00 (can start a course that ends by 16:00)
    if (hour >= 10 && hour <= 15) return 0;
    // Outer hours 08:00–09:00 and 16:00+
    return 1;
  }

  return pairs.sort((a, b) => {
    // 1. Core window before outer
    const rankDiff = rank(a.hour) - rank(b.hour);
    if (rankDiff !== 0) return rankDiff;
    // 2. Day-major: fill each day before moving to the next
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    // 3. Chronological within the day so slots pack with no gaps
    return a.slotIndex - b.slotIndex;
  });
}

function initializeTimetable() {
  const timetable = {};
  DAYS.forEach((day) => {
    timetable[day] = {};
    TIME_SLOTS.forEach((slot) => {
      timetable[day][slot.id] = [];
    });
  });
  return timetable;
}

function canAssignCourse(
  course,
  day,
  startSlotId,
  durationSlots,
  lecturerSchedule,
  lecturerBlocks,
  programmeYearSchedule,
) {
  const programmeYearKey = `${course.programme_name}_${course.course_year}`;

  const startIndex = TIME_SLOTS.findIndex((s) => s.id === startSlotId);
  const endIndex = startIndex + durationSlots - 1;
  const endSlotId = TIME_SLOTS[endIndex]?.id ?? startSlotId;

  // Check lecturer availability using actual slot IDs from TIME_SLOTS
  if (lecturerSchedule[course.lecturer_id]) {
    for (let i = startIndex; i <= endIndex; i++) {
      const slotId = TIME_SLOTS[i].id;
      if (lecturerSchedule[course.lecturer_id].has(`${day}_${slotId}`)) {
        return false;
      }
    }
  }

  // Prevent a lecturer from having more than the allowed number
  // of continuous classes (blocks) in a day, and enforce at least
  // a 1-slot gap before any 3rd class.
  if (
    wouldBreakLecturerBlockRules(
      lecturerBlocks,
      course.lecturer_id,
      day,
      startIndex,
      endIndex,
      MAX_CONTINUOUS_CLASSES_PER_LECTURER,
    )
  ) {
    return false;
  }

  // Check programme-year conflict using actual slot IDs from TIME_SLOTS
  if (programmeYearSchedule[programmeYearKey]) {
    for (let i = startIndex; i <= endIndex; i++) {
      const slotId = TIME_SLOTS[i].id;
      if (programmeYearSchedule[programmeYearKey].has(`${day}_${slotId}`)) {
        return false;
      }
    }
  }

  return true;
}

function wouldBreakLecturerBlockRules(
  lecturerBlocks,
  lecturerId,
  day,
  newStart,
  newEnd,
  maxContinuousClasses,
) {
  const lecturerDayBlocks =
    (lecturerBlocks[lecturerId] && lecturerBlocks[lecturerId][day]) || [];

  // First, ensure no overlap of blocks for the same lecturer on the same day.
  // Overlap occurs if ranges [newStart, newEnd] and [start, end] intersect.
  for (const block of lecturerDayBlocks) {
    if (newStart <= block.end && newEnd >= block.start) {
      return true;
    }
  }

  // Build a list including the new block and sort by start.
  const allBlocks = [
    ...lecturerDayBlocks.map((b) => ({ start: b.start, end: b.end })),
    { start: newStart, end: newEnd },
  ];

  allBlocks.sort((a, b) => a.start - b.start);

  // Count consecutive classes where the next class starts immediately
  // after the previous one ends with less than a full class-length
  // gap (in slots). Only when there is a gap of at least one full
  // class duration do we reset the continuity run.
  let currentRun = 1;
  for (let i = 1; i < allBlocks.length; i++) {
    const prev = allBlocks[i - 1];
    const curr = allBlocks[i];

    // Gap in slots between the end of the previous block
    // and the start of the current block.
    const gapSlots = curr.start - prev.end - 1;

    if (gapSlots < COURSE_DURATION) {
      currentRun += 1;
    } else {
      // There is at least one full class-length gap between classes.
      currentRun = 1;
    }

    if (currentRun > maxContinuousClasses) {
      return true;
    }
  }

  return false;
}

function updateSchedules(
  course,
  day,
  startSlotId,
  durationSlots,
  lecturerSchedule,
  lecturerBlocks,
  programmeYearSchedule,
  programmeDayUsage,
) {
  const programmeYearKey = `${course.programme_name}_${course.course_year}`;

  const startIndex = TIME_SLOTS.findIndex((s) => s.id === startSlotId);
  const endIndex = startIndex + durationSlots - 1;

  // Update lecturer schedule using actual slot IDs from TIME_SLOTS
  if (!lecturerSchedule[course.lecturer_id]) {
    lecturerSchedule[course.lecturer_id] = new Set();
  }
  for (let i = startIndex; i <= endIndex; i++) {
    lecturerSchedule[course.lecturer_id].add(`${day}_${TIME_SLOTS[i].id}`);
  }

  // Update lecturer blocks using indices (consistent with canAssignCourse)
  if (!lecturerBlocks[course.lecturer_id]) {
    lecturerBlocks[course.lecturer_id] = {};
  }
  if (!lecturerBlocks[course.lecturer_id][day]) {
    lecturerBlocks[course.lecturer_id][day] = [];
  }
  lecturerBlocks[course.lecturer_id][day].push({
    start: startIndex,
    end: endIndex,
  });

  // Update programme-year schedule using actual slot IDs from TIME_SLOTS
  if (!programmeYearSchedule[programmeYearKey]) {
    programmeYearSchedule[programmeYearKey] = new Set();
  }
  for (let i = startIndex; i <= endIndex; i++) {
    programmeYearSchedule[programmeYearKey].add(`${day}_${TIME_SLOTS[i].id}`);
  }

  // Update per-programme-per-day usage (count slots used)
  const programmeDayKey = `${course.programme_level}_${course.programme_name}_${course.programme_year}_${day}`;
  if (!programmeDayUsage[programmeDayKey]) {
    programmeDayUsage[programmeDayKey] = 0;
  }
  // Count classes, not individual slots
  programmeDayUsage[programmeDayKey] += 1;
}

function canAssignSlotsForProgrammeDay(
  course,
  day,
  startSlotId,
  maxSlotsPerCoursePerDay,
  programmeDayUsage,
) {
  const programmeDayKey = `${course.programme_level}_${course.programme_name}_${course.programme_year}_${day}`;
  const usedClasses = programmeDayUsage[programmeDayKey] || 0;

  // Treat constraint as "max classes per day"
  return usedClasses + 1 <= maxSlotsPerCoursePerDay;
}

function getEndTime(slotId) {
  return getEndTimeWithDuration(slotId, COURSE_DURATION);
}

function getEndTimeWithDuration(slotId, durationSlots) {
  const startIndex = TIME_SLOTS.findIndex((slot) => slot.id === slotId);
  if (startIndex === -1) {
    return "18:00";
  }
  const endIndex = startIndex + durationSlots;
  if (endIndex < TIME_SLOTS.length) {
    return TIME_SLOTS[endIndex].time;
  }
  return "18:00";
}