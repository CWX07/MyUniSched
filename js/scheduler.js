import {
  TIME_SLOTS,
  DAYS,
  COURSE_DURATION,
  DEFAULT_MAX_SLOTS_PER_COURSE_PER_DAY,
} from "./config.js";

// Maximum number of continuous 1-hour slots a lecturer
// can teach in a row on the same day.
// Since each class takes 2 slots, this effectively limits
// a lecturer to at most 2 back-to-back classes.
const MAX_CONTINUOUS_SLOTS_PER_LECTURER = 4;

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

  // Track lecturer availability
  const lecturerSchedule = {};

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

  // Try to assign each course
  for (const course of allCourses) {
    let assigned = false;

    for (const day of DAYS) {
      if (assigned) break;

      // Try each possible starting slot
      for (let i = 0; i < TIME_SLOTS.length - 1; i++) {
        const startSlot = TIME_SLOTS[i];
        const endSlot = TIME_SLOTS[i + 1];

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
            programmeYearSchedule,
            programmeDayUsage,
          );

          assigned = true;
          break;
        }
      }
    }

    if (!assigned) {
      console.error(`Could not assign course: ${course.course_code}`);
      return null;
    }
  }

  return timetable;
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
  // of continuous teaching slots in a day.
  if (
    wouldExceedLecturerContinuousSlots(
      lecturerSchedule,
      course.lecturer_id,
      day,
      [startSlotId, endSlotId],
      MAX_CONTINUOUS_SLOTS_PER_LECTURER,
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

function wouldExceedLecturerContinuousSlots(
  lecturerSchedule,
  lecturerId,
  day,
  newSlots,
  maxContinuousSlots,
) {
  const existing = lecturerSchedule[lecturerId];

  // If lecturer has no existing slots, they can't exceed the limit yet
  if (!existing || existing.size === 0) return false;

  // Collect all slots for this lecturer on this day
  const daySlots = [];
  existing.forEach((key) => {
    const [slotDay, slotIdStr] = key.split("_");
    if (slotDay === day) {
      const n = Number(slotIdStr);
      if (!Number.isNaN(n)) daySlots.push(n);
    }
  });

  // Add the new slots we are considering
  newSlots.forEach((slotId) => {
    if (!daySlots.includes(slotId)) {
      daySlots.push(slotId);
    }
  });

  if (daySlots.length === 0) return false;

  // Sort and check the length of each consecutive run
  daySlots.sort((a, b) => a - b);

  let currentRun = 1;
  for (let i = 1; i < daySlots.length; i++) {
    if (daySlots[i] === daySlots[i - 1] + 1) {
      currentRun += 1;
    } else if (daySlots[i] !== daySlots[i - 1]) {
      currentRun = 1;
    }

    if (currentRun > maxContinuousSlots) {
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
