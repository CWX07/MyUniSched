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

    // Try each possible (day, start-slot) in global preferred order
    for (const { day, startSlotId } of daySlotOrder) {
      const startSlot = TIME_SLOTS.find((s) => s.id === startSlotId);
      const nextSlotIndex =
        TIME_SLOTS.findIndex((s) => s.id === startSlotId) + 1;

      // Safety check: need a following slot to make a 2-hour block
      if (nextSlotIndex >= TIME_SLOTS.length) continue;

      const endSlot = TIME_SLOTS[nextSlotIndex];

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
          endSlot.id,
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
          timeRange: `${startSlot.time} - ${getEndTime(endSlot.id)}`,
        });

        // Update schedules
        updateSchedules(
          course,
          day,
          startSlot.id,
          endSlot.id,
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

// Determine preferred global order of (day, start-slot) pairs so that the
// generator fills central daytime blocks (10–12, 12–2, 2–4) on all days
// before using outer blocks (8–10, 4–6) on any day.
function getPreferredDaySlotOrder() {
  const pairs = [];

  // Only consider slots that can start a full class (need a following slot)
  const candidateSlots = TIME_SLOTS.slice(0, -1);

  DAYS.forEach((day, dayIndex) => {
    candidateSlots.forEach((slot) => {
      const hour = parseInt(slot.time.split(":")[0], 10);
      pairs.push({
        day,
        dayIndex,
        startSlotId: slot.id,
        hour,
      });
    });
  });

  function rank(hour) {
    // Central preferred hours
    if (hour === 10 || hour === 12 || hour === 14) return 0;
    // Outer hours (early/late) – least preferred
    if (hour === 8 || hour === 16) return 2;
    // Everything else in the middle
    return 1;
  }

  return pairs.sort((a, b) => {
    const hourDiff = rank(a.hour) - rank(b.hour);
    if (hourDiff !== 0) return hourDiff;

    // Within same hour rank, keep earlier days first for stability
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;

    // Finally, sort by actual hour to prefer earlier times
    return a.hour - b.hour;
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
  endSlotId,
  lecturerSchedule,
  lecturerBlocks,
  programmeYearSchedule,
) {
  const programmeYearKey = `${course.programme_name}_${course.course_year}`;

  // Check lecturer availability for both slots
  if (lecturerSchedule[course.lecturer_id]) {
    if (
      lecturerSchedule[course.lecturer_id].has(`${day}_${startSlotId}`) ||
      lecturerSchedule[course.lecturer_id].has(`${day}_${endSlotId}`)
    ) {
      return false;
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
      startSlotId,
      endSlotId,
      MAX_CONTINUOUS_CLASSES_PER_LECTURER,
    )
  ) {
    return false;
  }

  // Check programme-year conflict for both slots
  if (programmeYearSchedule[programmeYearKey]) {
    if (
      programmeYearSchedule[programmeYearKey].has(`${day}_${startSlotId}`) ||
      programmeYearSchedule[programmeYearKey].has(`${day}_${endSlotId}`)
    ) {
      return false;
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
  endSlotId,
  lecturerSchedule,
  lecturerBlocks,
  programmeYearSchedule,
  programmeDayUsage,
) {
  const programmeYearKey = `${course.programme_name}_${course.course_year}`;

  // Update lecturer schedule
  if (!lecturerSchedule[course.lecturer_id]) {
    lecturerSchedule[course.lecturer_id] = new Set();
  }
  lecturerSchedule[course.lecturer_id].add(`${day}_${startSlotId}`);
  lecturerSchedule[course.lecturer_id].add(`${day}_${endSlotId}`);

  // Update lecturer blocks (start/end) for gap rules
  if (!lecturerBlocks[course.lecturer_id]) {
    lecturerBlocks[course.lecturer_id] = {};
  }
  if (!lecturerBlocks[course.lecturer_id][day]) {
    lecturerBlocks[course.lecturer_id][day] = [];
  }
  lecturerBlocks[course.lecturer_id][day].push({
    start: startSlotId,
    end: endSlotId,
  });

  // Update programme-year schedule
  if (!programmeYearSchedule[programmeYearKey]) {
    programmeYearSchedule[programmeYearKey] = new Set();
  }
  programmeYearSchedule[programmeYearKey].add(`${day}_${startSlotId}`);
  programmeYearSchedule[programmeYearKey].add(`${day}_${endSlotId}`);

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
  const nextSlotIndex = TIME_SLOTS.findIndex((slot) => slot.id === slotId) + 1;
  if (nextSlotIndex < TIME_SLOTS.length) {
    return TIME_SLOTS[nextSlotIndex].time;
  }
  return "18:00";
}
