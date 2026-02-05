import { TIME_SLOTS, DAYS, COURSE_DURATION } from './config.js';

export function generateSchedule(courses, constraints = {}) {
    const { minCoursesPerSlot = 0, maxCoursesPerSlot = 3 } = constraints;

    // Group courses by programme and year
    const courseGroups = {};
    
    courses.forEach(course => {
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

                if (canAssignCourse(course, day, startSlot.id, endSlot.id, 
                    lecturerSchedule, programmeYearSchedule)) {
                    
                    // Assign course
                    timetable[day][startSlot.id].push({
                        ...course,
                        startSlot: startSlot.id,
                        endSlot: endSlot.id,
                        timeRange: `${startSlot.time} - ${getEndTime(endSlot.id)}`
                    });
                    
                    // Update schedules
                    updateSchedules(course, day, startSlot.id, endSlot.id, 
                        lecturerSchedule, programmeYearSchedule);

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
    DAYS.forEach(day => {
        timetable[day] = {};
        TIME_SLOTS.forEach(slot => {
            timetable[day][slot.id] = [];
        });
    });
    return timetable;
}

function canAssignCourse(course, day, startSlotId, endSlotId, 
    lecturerSchedule, programmeYearSchedule) {
    
    const programmeYearKey = `${course.programme_name}_${course.course_year}`;

    // Check lecturer availability for both slots
    if (lecturerSchedule[course.lecturer_id]) {
        if (lecturerSchedule[course.lecturer_id].has(`${day}_${startSlotId}`) ||
            lecturerSchedule[course.lecturer_id].has(`${day}_${endSlotId}`)) {
            return false;
        }
    }

    // Check programme-year conflict for both slots
    if (programmeYearSchedule[programmeYearKey]) {
        if (programmeYearSchedule[programmeYearKey].has(`${day}_${startSlotId}`) ||
            programmeYearSchedule[programmeYearKey].has(`${day}_${endSlotId}`)) {
            return false;
        }
    }

    return true;
}

function updateSchedules(course, day, startSlotId, endSlotId, 
    lecturerSchedule, programmeYearSchedule) {
    
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
}

function getEndTime(slotId) {
    const nextSlotIndex = TIME_SLOTS.findIndex(slot => slot.id === slotId) + 1;
    if (nextSlotIndex < TIME_SLOTS.length) {
        return TIME_SLOTS[nextSlotIndex].time;
    }
    return "18:00";
}