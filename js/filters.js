import { TIME_SLOTS, DAYS } from "./config.js";

export function filterTimetable(timetable, activeFilters) {
  if (!activeFilters || activeFilters.length === 0) return timetable;

  const programmeFilters = activeFilters.filter(f => f.type === "programme").map(f => f.value);
  const lecturerFilters  = activeFilters.filter(f => f.type === "lecturer").map(f => f.value);
  const dayFilters       = activeFilters.filter(f => f.type === "day").map(f => f.value);

  const activeDays = dayFilters.length > 0 ? DAYS.filter(d => dayFilters.includes(d)) : DAYS;

  const filteredTimetable = {};
  DAYS.forEach((day) => {
    filteredTimetable[day] = {};
    TIME_SLOTS.forEach((slot) => {
      filteredTimetable[day][slot.id] = [];
    });
  });

  activeDays.forEach((day) => {
    TIME_SLOTS.forEach((slot) => {
      timetable[day][slot.id].forEach((course) => {
        const progKey        = `${course.programme_level}_${course.programme_name}_${course.programme_year}`;
        const passProgramme  = programmeFilters.length === 0 || programmeFilters.includes(progKey);
        const passLecturer   = lecturerFilters.length === 0  || lecturerFilters.includes(course.lecturer_id) || lecturerFilters.includes(course.lecturer_name);
        if (passProgramme && passLecturer) {
          filteredTimetable[day][slot.id].push(course);
        }
      });
    });
  });

  return filteredTimetable;
}

export function getUniqueCourses(timetable) {
  const programmes = new Set();

  DAYS.forEach((day) => {
    TIME_SLOTS.forEach((slot) => {
      timetable[day][slot.id].forEach((course) => {
        const programme_level = course.programme_level;
        const programme_name = course.programme_name;
        const programme_year = course.programme_year;

        programmes.add(
          JSON.stringify({
            id: `${programme_level}_${programme_name}_${programme_year}`,
            label: `${programme_level} in ${programme_name} Year ${programme_year}`,
            programme_level,
            programme_name,
            programme_year,
          }),
        );
      });
    });
  });

  const levelOrder = ["Foundation", "Diploma", "Degree", "Master", "PhD"];

  return Array.from(programmes)
    .map((p) => JSON.parse(p))
    .sort((a, b) => {
      const levelDiff =
        levelOrder.indexOf(a.programme_level) -
        levelOrder.indexOf(b.programme_level);
      if (levelDiff !== 0) return levelDiff;

      const nameDiff = a.programme_name.localeCompare(b.programme_name);
      if (nameDiff !== 0) return nameDiff;

      return Number(a.programme_year) - Number(b.programme_year);
    });
}

export function getUniqueLecturers(timetable) {
  const lecturers = new Set();

  DAYS.forEach((day) => {
    TIME_SLOTS.forEach((slot) => {
      timetable[day][slot.id].forEach((course) => {
        lecturers.add(
          JSON.stringify({
            id: course.lecturer_id,
            name: course.lecturer_name || course.lecturer_id,
          }),
        );
      });
    });
  });

  return Array.from(lecturers)
    .map((l) => JSON.parse(l))
    .sort((a, b) => a.name.localeCompare(b.name));
}