document.addEventListener("DOMContentLoaded", () => {
    const generateBtn = document.getElementById("generateBtn");
    const resetBtn = document.getElementById("resetBtn");

    generateBtn.addEventListener("click", generateTimetable);
    resetBtn.addEventListener("click", resetTimetable);
});

// Time slots configuration (1-hour slots, but courses take 2 hours)
const TIME_SLOTS = [
    { id: 1, time: "08:00" },
    { id: 2, time: "09:00" },
    { id: 3, time: "10:00" },
    { id: 4, time: "11:00" },
    { id: 5, time: "12:00" },
    { id: 6, time: "13:00" },
    { id: 7, time: "14:00" },
    { id: 8, time: "15:00" },
    { id: 9, time: "16:00" },
    { id: 10, time: "17:00" }
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const COURSE_DURATION = 2; // Each course takes 2 hours (2 slots)

async function generateTimetable() {
    const statusDiv = document.getElementById("timetableStatus");
    statusDiv.innerHTML = '<p class="status_loading">Generating timetable...</p>';

    try {
        // Fetch courses from API
        const res = await fetch("/api/courses");
        const courses = await res.json();

        if (courses.length === 0) {
            statusDiv.innerHTML = '<p class="status_error">No courses found. Please add courses first.</p>';
            return;
        }

        // Generate timetable using constraint satisfaction
        const timetable = generateSchedule(courses);

        if (timetable) {
            displayTimetable(timetable);
            statusDiv.innerHTML = '<p class="status_success">✓ Timetable generated successfully!</p>';
        } else {
            statusDiv.innerHTML = '<p class="status_error">Unable to generate conflict-free timetable. Try reducing courses or the system needs more time slots.</p>';
        }

    } catch (err) {
        console.error(err);
        statusDiv.innerHTML = '<p class="status_error">Error generating timetable. Please try again.</p>';
    }
}

function generateSchedule(courses) {
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
    // Structure: timetable[day][startSlotId] = [courses]
    const timetable = {};
    DAYS.forEach(day => {
        timetable[day] = {};
        TIME_SLOTS.forEach(slot => {
            timetable[day][slot.id] = [];
        });
    });

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

            // Try each possible starting slot (must have 2 consecutive slots available)
            for (let i = 0; i < TIME_SLOTS.length - 1; i++) {
                const startSlot = TIME_SLOTS[i];
                const endSlot = TIME_SLOTS[i + 1];

                if (canAssignCourse(course, day, startSlot.id, endSlot.id, lecturerSchedule, programmeYearSchedule)) {
                    // Assign course to starting slot (it will span 2 slots)
                    timetable[day][startSlot.id].push({
                        ...course,
                        startSlot: startSlot.id,
                        endSlot: endSlot.id,
                        timeRange: `${startSlot.time} - ${getEndTime(endSlot.id)}`
                    });
                    
                    // Update lecturer schedule
                    if (!lecturerSchedule[course.lecturer_id]) {
                        lecturerSchedule[course.lecturer_id] = new Set();
                    }
                    lecturerSchedule[course.lecturer_id].add(`${day}_${startSlot.id}`);
                    lecturerSchedule[course.lecturer_id].add(`${day}_${endSlot.id}`);

                    // Update programme-year schedule
                    const programmeYearKey = `${course.programme_name}_${course.course_year}`;
                    if (!programmeYearSchedule[programmeYearKey]) {
                        programmeYearSchedule[programmeYearKey] = new Set();
                    }
                    programmeYearSchedule[programmeYearKey].add(`${day}_${startSlot.id}`);
                    programmeYearSchedule[programmeYearKey].add(`${day}_${endSlot.id}`);

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

function canAssignCourse(course, day, startSlotId, endSlotId, lecturerSchedule, programmeYearSchedule) {
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

function getEndTime(slotId) {
    const nextSlotIndex = TIME_SLOTS.findIndex(slot => slot.id === slotId) + 1;
    if (nextSlotIndex < TIME_SLOTS.length) {
        return TIME_SLOTS[nextSlotIndex].time;
    }
    return "18:00";
}

function displayTimetable(timetable) {
    const container = document.getElementById("timetableContainer");
    container.innerHTML = "";

    // Create timetable table
    const table = document.createElement("table");
    table.className = "timetable";

    // Create header row (Time slots)
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    
    const dayHeader = document.createElement("th");
    dayHeader.textContent = "Day / Time";
    dayHeader.className = "day_header";
    headerRow.appendChild(dayHeader);

    TIME_SLOTS.forEach(slot => {
        const th = document.createElement("th");
        th.textContent = slot.time;
        th.className = "time_header";
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create body rows (one row per day)
    const tbody = document.createElement("tbody");

    DAYS.forEach(day => {
        const row = document.createElement("tr");

        // Day cell
        const dayCell = document.createElement("td");
        dayCell.className = "day_cell";
        dayCell.textContent = day;
        row.appendChild(dayCell);

        // Collect every unique startSlot that has courses assigned on this day
        const startSlots = new Set();
        TIME_SLOTS.forEach(slot => {
            if (timetable[day][slot.id] && timetable[day][slot.id].length > 0) {
                startSlots.add(slot.id);
            }
        });

        // Track which columns have already been consumed by a colspan
        const renderedSlots = new Set();

        TIME_SLOTS.forEach(slot => {
            // Already covered by a previous course's colspan — skip
            if (renderedSlots.has(slot.id)) return;

            const coursesInSlot = timetable[day][slot.id];

            if (coursesInSlot && coursesInSlot.length > 0) {
                const cell = document.createElement("td");
                cell.className = "schedule_cell occupied";
                cell.colSpan = COURSE_DURATION;

                // Reserve both columns this course block spans
                renderedSlots.add(slot.id);
                renderedSlots.add(slot.id + 1);

                // Render every course that starts at this slot
                coursesInSlot.forEach((course, index) => {
                    const courseBlock = document.createElement("div");
                    courseBlock.className = "course_block";

                    const courseCode = document.createElement("div");
                    courseCode.className = "course_code";
                    courseCode.textContent = course.course_code;

                    const courseName = document.createElement("div");
                    courseName.className = "course_name";
                    courseName.textContent = course.course_name;

                    const timeRange = document.createElement("div");
                    timeRange.className = "time_range";
                    timeRange.textContent = course.timeRange;

                    const lecturerName = document.createElement("div");
                    lecturerName.className = "lecturer_name";
                    lecturerName.textContent = course.lecturer_name || course.lecturer_id;

                    const programmeInfo = document.createElement("div");
                    programmeInfo.className = "programme_info";
                    programmeInfo.textContent = `${course.programme_name} Y${course.course_year}`;

                    courseBlock.appendChild(courseCode);
                    courseBlock.appendChild(courseName);
                    courseBlock.appendChild(timeRange);
                    courseBlock.appendChild(lecturerName);
                    courseBlock.appendChild(programmeInfo);

                    // Color-code the left border by programme
                    const colorIndex = getColorIndex(course.programme_name);
                    courseBlock.style.borderLeftColor = getColor(colorIndex);

                    cell.appendChild(courseBlock);

                    // Separator between stacked courses
                    if (index < coursesInSlot.length - 1) {
                        const separator = document.createElement("div");
                        separator.className = "course_separator";
                        cell.appendChild(separator);
                    }
                });

                // Badge when more than one course shares the cell
                if (coursesInSlot.length > 1) {
                    const countBadge = document.createElement("div");
                    countBadge.className = "course_count_badge";
                    countBadge.textContent = `${coursesInSlot.length} courses`;
                    cell.insertBefore(countBadge, cell.firstChild);
                }

                row.appendChild(cell);
            } else {
                // Empty single-column slot
                const cell = document.createElement("td");
                cell.className = "schedule_cell empty";
                row.appendChild(cell);
            }
        });

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);

    // Add legend and statistics
    addLegendAndStats(container, timetable);
}

function addLegendAndStats(container, timetable) {
    const infoSection = document.createElement("div");
    infoSection.className = "timetable_info";

    // Legend
    const legend = document.createElement("div");
    legend.className = "timetable_legend";

    const legendTitle = document.createElement("h3");
    legendTitle.textContent = "Programme Legend";
    legend.appendChild(legendTitle);

    // Get unique programmes
    const programmes = new Set();
    DAYS.forEach(day => {
        TIME_SLOTS.forEach(slot => {
            const courses = timetable[day][slot.id];
            courses.forEach(course => {
                programmes.add(course.programme_name);
            });
        });
    });

    programmes.forEach(programme => {
        const item = document.createElement("div");
        item.className = "legend_item";

        const colorBox = document.createElement("span");
        colorBox.className = "legend_color";
        const colorIndex = getColorIndex(programme);
        colorBox.style.backgroundColor = getColor(colorIndex);

        const text = document.createElement("span");
        text.textContent = programme;

        item.appendChild(colorBox);
        item.appendChild(text);
        legend.appendChild(item);
    });

    // Statistics
    const stats = document.createElement("div");
    stats.className = "timetable_stats";

    const statsTitle = document.createElement("h3");
    statsTitle.textContent = "Timetable Statistics";
    stats.appendChild(statsTitle);

    // Calculate statistics
    let totalCourses = 0;
    let totalSlotPairsUsed = 0;
    let simultaneousSlotsCount = 0;

    DAYS.forEach(day => {
        TIME_SLOTS.forEach(slot => {
            const courses = timetable[day][slot.id];
            if (courses.length > 0) {
                totalCourses += courses.length;
                totalSlotPairsUsed++;
                if (courses.length > 1) {
                    simultaneousSlotsCount++;
                }
            }
        });
    });

    const totalSlotPairs = DAYS.length * (TIME_SLOTS.length - 1); // -1 because courses need 2 consecutive slots
    const utilization = ((totalSlotPairsUsed / totalSlotPairs) * 100).toFixed(1);

    stats.innerHTML += `
        <div class="stat_item"><strong>Total Courses:</strong> ${totalCourses}</div>
        <div class="stat_item"><strong>Time Blocks Used:</strong> ${totalSlotPairsUsed} / ${totalSlotPairs}</div>
        <div class="stat_item"><strong>Utilization:</strong> ${utilization}%</div>
        <div class="stat_item"><strong>Simultaneous Sessions:</strong> ${simultaneousSlotsCount}</div>
    `;

    infoSection.appendChild(legend);
    infoSection.appendChild(stats);
    container.appendChild(infoSection);
}

function getColorIndex(programmeName) {
    const programmes = ["Foundation", "Diploma", "Degree"];
    return programmes.indexOf(programmeName);
}

function getColor(index) {
    const colors = ["#3498db", "#e74c3c", "#2ecc71", "#f39c12", "#9b59b6"];
    return colors[index] || colors[0];
}

function resetTimetable() {
    const container = document.getElementById("timetableContainer");
    container.innerHTML = '<p class="no_timetable">Click "Generate Timetable" to create your schedule</p>';
    
    const statusDiv = document.getElementById("timetableStatus");
    statusDiv.innerHTML = "";
}