import {
  TIME_SLOTS,
  DAYS,
  COURSE_DURATION,
  PROGRAMME_COLORS,
  DEFAULT_COLORS,
  getProgrammeColor,
} from "./config.js";

export function displayTimetable(timetable) {
  const container = document.getElementById("timetableContainer");
  container.innerHTML = "";

  // Create timetable table
  const table = createTimetableTable(timetable);
  container.appendChild(table);

  // Add legend and statistics
  addLegendAndStats(container, timetable);

  // After DOM is rendered, position bars using real pixel widths of header cells
  requestAnimationFrame(() => positionGanttBars(table));
}

function positionGanttBars(table) {
  // Gather the pixel left offset and width of each time-slot header cell.
  // The header row has: [day_header, time_header_0, time_header_1, ...]
  const headerCells = table.querySelectorAll("thead th");
  if (headerCells.length < 2) return;

  const laneCell = table.querySelector(".schedule_lane_cell");
  if (!laneCell) return;
  const laneLeft = laneCell.getBoundingClientRect().left;

  // Build a lookup: slotIndex -> { left (px relative to lane), width (px) }
  const slotRects = [];
  // headerCells[0] is the day header; the rest are time slots
  for (let i = 1; i < headerCells.length; i++) {
    const rect = headerCells[i].getBoundingClientRect();
    slotRects.push({
      left: rect.left - laneLeft,
      width: rect.width,
    });
  }

  // Now position every course_bar using its data attributes
  const bars = table.querySelectorAll(".course_bar");
  bars.forEach((bar) => {
    const startIndex = parseInt(bar.dataset.startIndex, 10);
    const durationSlots = parseInt(bar.dataset.durationSlots, 10);

    if (isNaN(startIndex) || isNaN(durationSlots)) return;

    const startRect = slotRects[startIndex];
    if (!startRect) return;

    // Width spans from left edge of start slot to right edge of last slot
    const endIndex = Math.min(startIndex + durationSlots - 1, slotRects.length - 1);
    const endRect = slotRects[endIndex];
    const totalWidth = (endRect.left + endRect.width) - startRect.left;

    bar.style.left = `${startRect.left + 4}px`;   // 4px inset
    bar.style.width = `${totalWidth - 8}px`;       // 8px total inset (left+right)
  });
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

  // Single lane cell spanning all time columns (Gantt-style)
  const laneCell = document.createElement("td");
  laneCell.className = "schedule_lane_cell";
  laneCell.colSpan = TIME_SLOTS.length;

  const lane = document.createElement("div");
  lane.className = "timetable_lane";

  // Collect all unique courses for this day (scheduler stores by start slot)
  const coursesMap = new Map();
  TIME_SLOTS.forEach((slot) => {
    const list = timetable[day][slot.id] || [];
    list.forEach((course) => {
      if (!coursesMap.has(course.course_code)) {
        coursesMap.set(course.course_code, course);
      }
    });
  });

  const courses = Array.from(coursesMap.values());
  const bars = buildCourseBarsForDay(courses);

  // Group bars by laneIndex so each stacking level gets its own flex row.
  // This avoids any hardcoded top/height — the row's natural height drives
  // the lane height, and course blocks use align-self: stretch inside it.
  const laneRows = new Map();
  bars.forEach((bar) => {
    if (!laneRows.has(bar.laneIndex)) {
      const row = document.createElement("div");
      row.className = "timetable_lane_row";
      laneRows.set(bar.laneIndex, row);
    }
    const courseBlock = createCourseBlock(bar.course);
    courseBlock.classList.add("course_bar");
    courseBlock.dataset.startIndex = bar.startIndex;
    courseBlock.dataset.durationSlots = bar.durationSlots;
    laneRows.get(bar.laneIndex).appendChild(courseBlock);
  });

  // Append rows in order
  [...laneRows.keys()].sort((a, b) => a - b).forEach((idx) => {
    lane.appendChild(laneRows.get(idx));
  });

  laneCell.appendChild(lane);
  row.appendChild(laneCell);

  return row;
}

function buildCourseBarsForDay(courses) {
  const bars = [];

  // Each segment is between visible time labels
  const segments = TIME_SLOTS.length - 1 || 1;

  const rawBars = courses
    .map((course) => {
      const startId = course.startSlot;
      const endId = course.endSlot;
      const startIndex = TIME_SLOTS.findIndex((s) => s.id === startId);
      let durationSlots = 2;

      if (
        typeof startId === "number" &&
        typeof endId === "number" &&
        startIndex !== -1
      ) {
        durationSlots = endId - startId + 1;
      } else if (course.duration_hours) {
        durationSlots = Number(course.duration_hours) || 2;
      }

      if (startIndex === -1) return null;

      return {
        course,
        startIndex,
        endIndex: startIndex + durationSlots - 1,
        durationSlots,
      };
    })
    .filter(Boolean);

  // Simple greedy lane assignment to avoid vertical overlap
  const laneEnds = [];
  rawBars
    .sort((a, b) => a.startIndex - b.startIndex)
    .forEach((bar) => {
      let laneIndex = 0;
      while (laneIndex < laneEnds.length && laneEnds[laneIndex] >= bar.startIndex) {
        laneIndex += 1;
      }
      laneEnds[laneIndex] = bar.endIndex;
      bars.push({ ...bar, laneIndex });
    });

  return bars;
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
  ];

  elements.forEach(({ className, text }) => {
    const element = document.createElement("div");
    element.className = className;
    element.textContent = text;
    courseBlock.appendChild(element);
  });

  // Programme info — two lines inside one pill
  const progInfo = document.createElement("div");
  progInfo.className = "programme_info";

  const progLine1 = document.createElement("span");
  progLine1.className = "programme_info_title";
  progLine1.textContent = `${course.programme_level} in ${course.programme_name}`;

  const progLine2 = document.createElement("span");
  progLine2.className = "programme_info_year";
  progLine2.textContent = `Year ${course.programme_year}`;

  progInfo.appendChild(progLine1);
  progInfo.appendChild(progLine2);
  courseBlock.appendChild(progInfo);

  // Color-code the left border by programme
  const color = getProgrammeColor(
    course.programme_level,
    course.programme_name,
    course.programme_year,
  );
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

  // Get unique programme-level+name+year combos
  const programmes = getUniqueProgrammes(timetable);

  // Sort programmes similar to My Entities:
  // level -> programme name -> year (ascending)
  const levelOrder = ["Foundation", "Diploma", "Degree", "Master", "PhD"];

  programmes
    .slice()
    .sort((a, b) => {
      const levelDiff =
        levelOrder.indexOf(a.programme_level) -
        levelOrder.indexOf(b.programme_level);
      if (levelDiff !== 0) return levelDiff;

      const nameDiff = a.programme_name.localeCompare(b.programme_name);
      if (nameDiff !== 0) return nameDiff;

      // Ensure numeric ascending order for year
      return Number(a.programme_year) - Number(b.programme_year);
    })
    .forEach((programme) => {
    const item = document.createElement("div");
    item.className = "legend_item";

    const colorBox = document.createElement("span");
    colorBox.className = "legend_color";
    colorBox.style.backgroundColor = getProgrammeColor(
      programme.programme_level,
      programme.programme_name,
      programme.programme_year,
    );

    const text = document.createElement("span");
    text.textContent = `${programme.programme_level} in ${programme.programme_name} Year ${programme.programme_year}`;

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
  const programmesMap = new Map();

  DAYS.forEach((day) => {
    TIME_SLOTS.forEach((slot) => {
      timetable[day][slot.id].forEach((course) => {
        const key = `${course.programme_level}_${course.programme_name}_${course.programme_year}`;
        if (!programmesMap.has(key)) {
          programmesMap.set(key, {
            programme_level: course.programme_level,
            programme_name: course.programme_name,
            programme_year: course.programme_year,
          });
        }
      });
    });
  });

  return Array.from(programmesMap.values());
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