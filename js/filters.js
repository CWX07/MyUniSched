import { TIME_SLOTS, DAYS } from "./config.js";

export function filterTimetable(timetable, filters) {
  const { filterType, filterValue } = filters;

  if (!filterType || !filterValue || filterValue === "all") {
    return timetable;
  }

  const filteredTimetable = {};
  DAYS.forEach((day) => {
    filteredTimetable[day] = {};
    TIME_SLOTS.forEach((slot) => {
      filteredTimetable[day][slot.id] = [];
    });
  });

  DAYS.forEach((day) => {
    TIME_SLOTS.forEach((slot) => {
      const courses = timetable[day][slot.id];

      courses.forEach((course) => {
        let shouldInclude = false;

        if (filterType === "course") {
          const key = `${course.programme_level}_${course.programme_name}_${course.programme_year}`;
          shouldInclude = key === filterValue;
        } else if (filterType === "lecturer") {
          shouldInclude =
            course.lecturer_id === filterValue ||
            course.lecturer_name === filterValue;
        }

        if (shouldInclude) {
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
        programmes.add(
          JSON.stringify({
            id: `${course.programme_level}_${course.programme_name}_${course.programme_year}`,
            label: `${course.programme_level} in ${course.programme_name} Year ${course.programme_year}`,
          }),
        );
      });
    });
  });

  return Array.from(programmes)
    .map((p) => JSON.parse(p))
    .sort((a, b) => a.label.localeCompare(b.label));
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
