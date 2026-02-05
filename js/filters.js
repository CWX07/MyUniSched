import { TIME_SLOTS, DAYS } from './config.js';

export function filterTimetable(timetable, filters) {
    const { filterType, filterValue } = filters;

    if (!filterType || !filterValue || filterValue === 'all') {
        return timetable;
    }

    const filteredTimetable = {};
    DAYS.forEach(day => {
        filteredTimetable[day] = {};
        TIME_SLOTS.forEach(slot => {
            filteredTimetable[day][slot.id] = [];
        });
    });

    DAYS.forEach(day => {
        TIME_SLOTS.forEach(slot => {
            const courses = timetable[day][slot.id];
            
            courses.forEach(course => {
                let shouldInclude = false;

                if (filterType === 'course') {
                    shouldInclude = course.course_code === filterValue;
                } else if (filterType === 'lecturer') {
                    shouldInclude = course.lecturer_id === filterValue || 
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
    const courses = new Set();
    
    DAYS.forEach(day => {
        TIME_SLOTS.forEach(slot => {
            timetable[day][slot.id].forEach(course => {
                courses.add(JSON.stringify({
                    code: course.course_code,
                    name: course.course_name
                }));
            });
        });
    });

    return Array.from(courses).map(c => JSON.parse(c)).sort((a, b) => 
        a.code.localeCompare(b.code)
    );
}

export function getUniqueLecturers(timetable) {
    const lecturers = new Set();
    
    DAYS.forEach(day => {
        TIME_SLOTS.forEach(slot => {
            timetable[day][slot.id].forEach(course => {
                lecturers.add(JSON.stringify({
                    id: course.lecturer_id,
                    name: course.lecturer_name || course.lecturer_id
                }));
            });
        });
    });

    return Array.from(lecturers).map(l => JSON.parse(l)).sort((a, b) => 
        a.name.localeCompare(b.name)
    );
}