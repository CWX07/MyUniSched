import {
  TIME_SLOTS,
  DAYS,
  COURSE_DURATION,
  DEFAULT_MAX_SLOTS_PER_COURSE_PER_DAY,
} from "./config.js";

const MAX_CONTINUOUS_CLASSES_PER_LECTURER = 2;

export function generateSchedule(courses, constraints = {}) {
  const {
    minCoursesPerSlot = 0,
    maxCoursesPerSlot = 3,
    maxSlotsPerCoursePerDay = DEFAULT_MAX_SLOTS_PER_COURSE_PER_DAY,
  } = constraints;

  // Group courses by programme+year
  const courseGroups = {};
  courses.forEach((course) => {
    const key = `${course.programme_name}_${course.programme_year}`;
    if (!courseGroups[key]) courseGroups[key] = [];
    courseGroups[key].push(course);
  });

  const timetable = initializeTimetable();
  const lecturerSchedule = {};
  const lecturerBlocks = {};
  const programmeYearSchedule = {};
  const programmeDayUsage = {};

  // Live count of courses placed per day — the key balancing lever.
  // Updated after every successful placement so the next course always
  // sees the current load and prefers the lightest day.
  const dayCourseCounts = {};
  DAYS.forEach((d) => {
    dayCourseCounts[d] = 0;
  });

  // Sort most-constrained (largest programme group) first
  const allCourses = [...courses].sort((a, b) => {
    const ga = courseGroups[`${a.programme_name}_${a.programme_year}`].length;
    const gb = courseGroups[`${b.programme_name}_${b.programme_year}`].length;
    return gb - ga;
  });

  const candidateSlots = TIME_SLOTS.slice(0, -1);

  function hourRank(slot) {
    const h = parseInt(slot.time, 10);
    return h >= 10 && h <= 15 ? 0 : 1;
  }

  // Count courses that START at a given (day, slotId) — used to decide
  // whether a slot already meets minCoursesPerSlot during consolidation.
  function starterCount(day, slotId) {
    return (timetable[day][slotId] || []).length;
  }

  // Build the sorted candidate list fresh before each placement.
  //
  // Priority order:
  //
  // Sort priority when minCoursesPerSlot = 0 (default / balance only):
  //   1. Least-loaded day first
  //   2. Core hours (10:00–15:00) before outer hours
  //   3. Chronological
  //
  // Sort priority when minCoursesPerSlot > 0 (consolidation mode):
  //   1. Slots that already have courses but are below the minimum come first
  //      — fill them up to the minimum before opening new slots
  //   2. Among slots at equal consolidation score: least-loaded day first
  //   3. Core hours before outer hours
  //   4. Chronological
  //
  // Consolidation MUST outrank day-balance when minCoursesPerSlot is set,
  // otherwise the day-balancer always sends the 2nd course to a different
  // day, leaving every slot with exactly 1 course and failing validation.
  function buildPlacementOrder() {
    const candidates = [];
    DAYS.forEach((day) => {
      candidateSlots.forEach((slot) => {
        candidates.push({ day, slot });
      });
    });

    candidates.sort((a, b) => {
      if (minCoursesPerSlot > 0) {
        const ca = starterCount(a.day, a.slot.id);
        const cb = starterCount(b.day, b.slot.id);

        // A slot that already has courses but is below the minimum is
        // "needs topping up" — prioritise it over empty slots so we fill
        // it to the minimum before creating any new singleton slots.
        const aNeedsTop = ca > 0 && ca < minCoursesPerSlot ? 1 : 0;
        const bNeedsTop = cb > 0 && cb < minCoursesPerSlot ? 1 : 0;
        if (bNeedsTop !== aNeedsTop) return bNeedsTop - aNeedsTop;

        // Both need topping up or both don't — prefer the one closer to
        // the minimum (more courses already there = less work to do).
        const aScore = Math.min(ca, minCoursesPerSlot);
        const bScore = Math.min(cb, minCoursesPerSlot);
        if (bScore !== aScore) return bScore - aScore;
      }

      // Day balance (always active, acts as tiebreaker in consolidation mode)
      const loadDiff = dayCourseCounts[a.day] - dayCourseCounts[b.day];
      if (loadDiff !== 0) return loadDiff;

      // Core hours before outer hours
      const rankDiff = hourRank(a.slot) - hourRank(b.slot);
      if (rankDiff !== 0) return rankDiff;

      // Chronological
      return parseInt(a.slot.time, 10) - parseInt(b.slot.time, 10);
    });

    return candidates;
  }

  // Place each course
  for (const course of allCourses) {
    let assigned = false;
    const durationSlots = Number(course.duration_hours) || COURSE_DURATION;

    for (const { day, slot: startSlot } of buildPlacementOrder()) {
      const startIndex = TIME_SLOTS.findIndex((s) => s.id === startSlot.id);
      if (startIndex === -1) continue;

      const endIndex = startIndex + durationSlots - 1;
      if (endIndex >= TIME_SLOTS.length) continue;

      const endSlot = TIME_SLOTS[endIndex];

      // Check maxCoursesPerSlot across all slots this course spans
      const wouldExceedMax = (() => {
        for (let i = startIndex; i < startIndex + durationSlots; i++) {
          const slotId = TIME_SLOTS[i]?.id;
          if (!slotId) continue;
          let overlapping = 0;
          TIME_SLOTS.forEach((s) => {
            (timetable[day][s.id] || []).forEach((placed) => {
              const ps = TIME_SLOTS.findIndex((x) => x.id === placed.startSlot);
              const pe = ps + (Number(placed.duration_hours) || 2) - 1;
              const ti = TIME_SLOTS.findIndex((x) => x.id === slotId);
              if (ps <= ti && ti <= pe) overlapping++;
            });
          });
          if (overlapping >= maxCoursesPerSlot) return true;
        }
        return false;
      })();
      if (wouldExceedMax) continue;

      if (
        !canAssignSlotsForProgrammeDay(
          course,
          day,
          startSlot.id,
          maxSlotsPerCoursePerDay,
          programmeDayUsage,
        )
      )
        continue;

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
        timetable[day][startSlot.id].push({
          ...course,
          startSlot: startSlot.id,
          endSlot: endSlot.id,
          timeRange: `${startSlot.time} - ${getEndTimeWithDuration(startSlot.id, durationSlots)}`,
        });

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

        // Keep day load counter current for the next placement
        dayCourseCounts[day]++;

        assigned = true;
        break;
      }
    }

    if (!assigned) {
      // Diagnose why this course couldn't be placed
      const reasons = [];

      // Check if lecturer is completely overbooked across all days
      const lecturerDaysBlocked = DAYS.filter((day) =>
        candidateSlots.every((slot) => {
          const si = TIME_SLOTS.findIndex((s) => s.id === slot.id);
          return (
            lecturerSchedule[course.lecturer_id]?.has(`${day}_${slot.id}`) ||
            wouldBreakLecturerBlockRules(
              lecturerBlocks,
              course.lecturer_id,
              day,
              si,
              si + durationSlots - 1,
              MAX_CONTINUOUS_CLASSES_PER_LECTURER,
            )
          );
        }),
      );
      if (lecturerDaysBlocked.length === DAYS.length) {
        reasons.push(
          `Lecturer "${course.lecturer_name || course.lecturer_id}" has no available slots across the whole week`,
        );
      } else if (lecturerDaysBlocked.length > 0) {
        reasons.push(
          `Lecturer "${course.lecturer_name || course.lecturer_id}" is fully booked on ${lecturerDaysBlocked.join(", ")}`,
        );
      }

      // Check if programme-year group is overbooked
      const progKey = `${course.programme_name}_${course.programme_year}`;
      const progDaysBlocked = DAYS.filter((day) =>
        candidateSlots.every((slot) => {
          const si = TIME_SLOTS.findIndex((s) => s.id === slot.id);
          const ei = si + durationSlots - 1;
          for (let i = si; i <= ei; i++) {
            if (
              programmeYearSchedule[progKey]?.has(`${day}_${TIME_SLOTS[i]?.id}`)
            )
              return true;
          }
          return false;
        }),
      );
      if (progDaysBlocked.length === DAYS.length) {
        reasons.push(
          `Programme "${course.programme_name} Year ${course.programme_year}" has no free slots left in the week`,
        );
      }

      // Check if maxSlotsPerCoursePerDay is blocking every day
      const maxSlotBlocked = DAYS.every((day) => {
        const key = `${course.programme_level}_${course.programme_name}_${course.programme_year}_${day}`;
        return (programmeDayUsage[key] || 0) + 1 > maxSlotsPerCoursePerDay;
      });
      if (maxSlotBlocked) {
        reasons.push(
          `Max slots per course per day (${maxSlotsPerCoursePerDay}) is too restrictive — not enough days to spread all courses`,
        );
      }

      if (reasons.length === 0) {
        reasons.push(
          `Too many constraints active simultaneously — no valid slot found`,
        );
      }

      return {
        error: "unassignable",
        course: course.course_name || course.course_code,
        reasons,
      };
    }
  }

  // Post-generation safety check for minCoursesPerSlot
  if (!validateMinCoursesPerSlot(timetable, minCoursesPerSlot)) {
    return {
      error: "minCoursesPerSlot",
      reasons: [
        `Some time slots ended up with fewer than ${minCoursesPerSlot} course(s). Try lowering the minimum, adding more courses, or raising the max courses per slot.`,
      ],
    };
  }

  return timetable;
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateMinCoursesPerSlot(timetable, minCoursesPerSlot) {
  if (!minCoursesPerSlot || minCoursesPerSlot <= 0) return true;
  // Only check slots where courses can START (all slots except the last,
  // which can't accommodate a full-duration class). Checking every covered
  // slot is impossible to satisfy because a 2-hour course always occupies
  // a 2nd "intermediate" slot that no other course can start in.
  const startableSlots = TIME_SLOTS.slice(0, -1);
  for (const day of DAYS) {
    for (const slot of startableSlots) {
      const starters = (timetable[day][slot.id] || []).length;
      if (starters > 0 && starters < minCoursesPerSlot) {
        console.error(
          `minCoursesPerSlot violation: ${day} ${slot.time} has ${starters} starting course(s), need >= ${minCoursesPerSlot}`,
        );
        return false;
      }
    }
  }
  return true;
}

// ── Timetable init ────────────────────────────────────────────────────────────

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

// ── Course assignment ─────────────────────────────────────────────────────────

function canAssignCourse(
  course,
  day,
  startSlotId,
  durationSlots,
  lecturerSchedule,
  lecturerBlocks,
  programmeYearSchedule,
) {
  const programmeYearKey = `${course.programme_name}_${course.programme_year}`;
  const startIndex = TIME_SLOTS.findIndex((s) => s.id === startSlotId);
  const endIndex = startIndex + durationSlots - 1;

  if (lecturerSchedule[course.lecturer_id]) {
    for (let i = startIndex; i <= endIndex; i++) {
      if (
        lecturerSchedule[course.lecturer_id].has(`${day}_${TIME_SLOTS[i].id}`)
      )
        return false;
    }
  }

  if (
    wouldBreakLecturerBlockRules(
      lecturerBlocks,
      course.lecturer_id,
      day,
      startIndex,
      endIndex,
      MAX_CONTINUOUS_CLASSES_PER_LECTURER,
    )
  )
    return false;

  if (programmeYearSchedule[programmeYearKey]) {
    for (let i = startIndex; i <= endIndex; i++) {
      if (
        programmeYearSchedule[programmeYearKey].has(
          `${day}_${TIME_SLOTS[i].id}`,
        )
      )
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
  const blocks = lecturerBlocks[lecturerId]?.[day] || [];

  for (const block of blocks) {
    if (newStart <= block.end && newEnd >= block.start) return true;
  }

  const allBlocks = [
    ...blocks.map((b) => ({ start: b.start, end: b.end })),
    { start: newStart, end: newEnd },
  ].sort((a, b) => a.start - b.start);

  let run = 1;
  for (let i = 1; i < allBlocks.length; i++) {
    const gap = allBlocks[i].start - allBlocks[i - 1].end - 1;
    run = gap < COURSE_DURATION ? run + 1 : 1;
    if (run > maxContinuousClasses) return true;
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
  const programmeYearKey = `${course.programme_name}_${course.programme_year}`;
  const startIndex = TIME_SLOTS.findIndex((s) => s.id === startSlotId);
  const endIndex = startIndex + durationSlots - 1;

  if (!lecturerSchedule[course.lecturer_id])
    lecturerSchedule[course.lecturer_id] = new Set();
  for (let i = startIndex; i <= endIndex; i++) {
    lecturerSchedule[course.lecturer_id].add(`${day}_${TIME_SLOTS[i].id}`);
  }

  if (!lecturerBlocks[course.lecturer_id])
    lecturerBlocks[course.lecturer_id] = {};
  if (!lecturerBlocks[course.lecturer_id][day])
    lecturerBlocks[course.lecturer_id][day] = [];
  lecturerBlocks[course.lecturer_id][day].push({
    start: startIndex,
    end: endIndex,
  });

  if (!programmeYearSchedule[programmeYearKey])
    programmeYearSchedule[programmeYearKey] = new Set();
  for (let i = startIndex; i <= endIndex; i++) {
    programmeYearSchedule[programmeYearKey].add(`${day}_${TIME_SLOTS[i].id}`);
  }

  const programmeDayKey = `${course.programme_level}_${course.programme_name}_${course.programme_year}_${day}`;
  programmeDayUsage[programmeDayKey] =
    (programmeDayUsage[programmeDayKey] || 0) + 1;
}

function canAssignSlotsForProgrammeDay(
  course,
  day,
  startSlotId,
  maxSlotsPerCoursePerDay,
  programmeDayUsage,
) {
  const programmeDayKey = `${course.programme_level}_${course.programme_name}_${course.programme_year}_${day}`;
  return (
    (programmeDayUsage[programmeDayKey] || 0) + 1 <= maxSlotsPerCoursePerDay
  );
}

function getEndTimeWithDuration(slotId, durationSlots) {
  const startIndex = TIME_SLOTS.findIndex((slot) => slot.id === slotId);
  if (startIndex === -1) return "18:00";
  const endIndex = startIndex + durationSlots;
  return endIndex < TIME_SLOTS.length ? TIME_SLOTS[endIndex].time : "18:00";
}