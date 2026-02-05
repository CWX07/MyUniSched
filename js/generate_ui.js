import {
    TIME_SLOTS,
    DAYS,
    COURSE_DURATION,
    PROGRAMME_COLORS,
    DEFAULT_COLORS,
} from "./config.js";

export function displayTimetable(timetable) {
    const container = document.getElementById("timetableContainer");
    container.innerHTML = "";

    // Create timetable table
    const table = createTimetableTable(timetable);
    container.appendChild(table);

    // Add legend and statistics
    addLegendAndStats(container, timetable);
}

function createTimetableTable(timetable) {
    const table = document.createElement("table");
    table.className = "timetable";

    // Create header
    const thead = createTableHeader();
    table.appendChild(thead);

    // Create body
    const tbody = createTableBody(timetable);
    table.appendChild(tbody);

    return table;
}

function createTableHeader() {
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const dayHeader = document.createElement("th");
    dayHeader.textContent = "Day / Time";
    dayHeader.className = "day_header";
    headerRow.appendChild(dayHeader);

    TIME_SLOTS.forEach((slot) => {
        const th = document.createElement("th");
        th.textContent = slot.time;
        th.className = "time_header";
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    return thead;
}

function createTableBody(timetable) {
    const tbody = document.createElement("tbody");

    DAYS.forEach((day) => {
        const row = createDayRow(day, timetable);
        tbody.appendChild(row);
    });

    return tbody;
}

function createDayRow(day, timetable) {
    const row = document.createElement("tr");

    // Day cell
    const dayCell = document.createElement("td");
    dayCell.className = "day_cell";
    dayCell.textContent = day;
    row.appendChild(dayCell);

    // Track which columns have been consumed by colspan
    const renderedSlots = new Set();

    TIME_SLOTS.forEach((slot) => {
        if (renderedSlots.has(slot.id)) return;

        const coursesInSlot = timetable[day][slot.id];

        if (coursesInSlot && coursesInSlot.length > 0) {
        const cell = createOccupiedCell(coursesInSlot, slot.id, renderedSlots);
        row.appendChild(cell);
        } else {
        const cell = createEmptyCell();
        row.appendChild(cell);
        }
    });

    return row;
}

function createOccupiedCell(coursesInSlot, slotId, renderedSlots) {
    const cell = document.createElement("td");
    cell.className = "schedule_cell occupied";
    cell.colSpan = COURSE_DURATION;

    // Reserve both columns this course block spans
    renderedSlots.add(slotId);
    renderedSlots.add(slotId + 1);

    // Add count badge if multiple courses
    if (coursesInSlot.length > 1) {
        const countBadge = document.createElement("div");
        countBadge.className = "course_count_badge";
        countBadge.textContent = `${coursesInSlot.length} courses`;
        cell.appendChild(countBadge);
    }

    // Render each course
    coursesInSlot.forEach((course, index) => {
        const courseBlock = createCourseBlock(course);
        cell.appendChild(courseBlock);

        // Separator between courses
        if (index < coursesInSlot.length - 1) {
        const separator = document.createElement("div");
        separator.className = "course_separator";
        cell.appendChild(separator);
        }
    });

    return cell;
}

function createEmptyCell() {
    const cell = document.createElement("td");
    cell.className = "schedule_cell empty";
    return cell;
}

function createCourseBlock(course) {
    const courseBlock = document.createElement("div");
    courseBlock.className = "course_block";

    const elements = [
        { className: "course_code", text: course.course_code },
        { className: "course_name", text: course.course_name },
        { className: "time_range", text: course.timeRange },
        {
            className: "lecturer_name",
            text: course.lecturer_name || course.lecturer_id,
        },
        {
            className: "programme_info",
            text: `${course.programme_name} Y${course.course_year}`,
        },
  ];

  elements.forEach(({ className, text }) => {
        const element = document.createElement("div");
        element.className = className;
        element.textContent = text;
        courseBlock.appendChild(element);
    });

    // Color-code the left border by programme
    const color = PROGRAMME_COLORS[course.programme_name] || DEFAULT_COLORS[0];
    courseBlock.style.borderLeftColor = color;

    return courseBlock;
}

function addLegendAndStats(container, timetable) {
    const infoSection = document.createElement("div");
    infoSection.className = "timetable_info";

    const legend = createLegend(timetable);
    const stats = createStats(timetable);

    infoSection.appendChild(legend);
    infoSection.appendChild(stats);
    container.appendChild(infoSection);
}

function createLegend(timetable) {
    const legend = document.createElement("div");
    legend.className = "timetable_legend";

    const legendTitle = document.createElement("h3");
    legendTitle.textContent = "Programme Legend";
    legend.appendChild(legendTitle);

    // Get unique programmes
    const programmes = getUniqueProgrammes(timetable);

    programmes.forEach((programme) => {
        const item = document.createElement("div");
        item.className = "legend_item";

        const colorBox = document.createElement("span");
        colorBox.className = "legend_color";
        colorBox.style.backgroundColor =
        PROGRAMME_COLORS[programme] || DEFAULT_COLORS[0];

        const text = document.createElement("span");
        text.textContent = programme;

        item.appendChild(colorBox);
        item.appendChild(text);
        legend.appendChild(item);
    });

    return legend;
}

function createStats(timetable) {
    const stats = document.createElement("div");
    stats.className = "timetable_stats";

    const statsTitle = document.createElement("h3");
    statsTitle.textContent = "Timetable Statistics";
    stats.appendChild(statsTitle);

    const statistics = calculateStatistics(timetable);

    const statItems = [
        { label: "Total Courses", value: statistics.totalCourses },
        {
        label: "Time Blocks Used",
        value: `${statistics.blocksUsed} / ${statistics.totalBlocks}`,
        },
        { label: "Utilization", value: `${statistics.utilization}%` },
        { label: "Simultaneous Sessions", value: statistics.simultaneousSessions },
    ];

    statItems.forEach(({ label, value }) => {
        const item = document.createElement("div");
        item.className = "stat_item";
        item.innerHTML = `<strong>${label}:</strong> ${value}`;
        stats.appendChild(item);
    });

    return stats;
}

function getUniqueProgrammes(timetable) {
    const programmes = new Set();

    DAYS.forEach((day) => {
        TIME_SLOTS.forEach((slot) => {
        timetable[day][slot.id].forEach((course) => {
            programmes.add(course.programme_name);
        });
        });
    });

    return Array.from(programmes);
}

function calculateStatistics(timetable) {
    let totalCourses = 0;
    let blocksUsed = 0;
    let simultaneousSessions = 0;

    DAYS.forEach((day) => {
        TIME_SLOTS.forEach((slot) => {
        const courses = timetable[day][slot.id];
        if (courses.length > 0) {
            totalCourses += courses.length;
            blocksUsed++;
            if (courses.length > 1) {
            simultaneousSessions++;
            }
        }
        });
    });

    const totalBlocks = DAYS.length * (TIME_SLOTS.length - 1);
    const utilization = ((blocksUsed / totalBlocks) * 100).toFixed(1);

    return {
        totalCourses,
        blocksUsed,
        totalBlocks,
        utilization,
        simultaneousSessions,
    };
}
