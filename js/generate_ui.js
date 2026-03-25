import {
  TIME_SLOTS,
  DAYS,
  COURSE_DURATION,
  PROGRAMME_COLORS,
  DEFAULT_COLORS,
  getProgrammeColor,
} from "./config.js";
import { editCourse } from "./course.js";

// ── Module-level timetable state (mutated by drag-and-drop) ──────────────────
let _timetable = null;

// ── Drag state ───────────────────────────────────────────────────────────────
const drag = {
  bar: null, // the .course_bar element being dragged
  course: null, // course data object
  sourceDay: null, // day it came from
  sourceSlotId: null, // startSlot it came from
  slotRects: [], // cached slot rects for the current table
};

// ── Debounce utility ─────────────────────────────────────────────────────────
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ── Single resize handler (registered once, reused on every displayTimetable) ─
const _onResize = debounce(() => {
  const table = document.querySelector(".timetable_container .timetable");
  if (table) positionGanttBars(table);
}, 150);

export function displayTimetable(timetable) {
  _timetable = timetable;

  const container = document.getElementById("timetableContainer");
  container.innerHTML = "";

  const table = createTimetableTable(timetable);
  container.appendChild(table);

  addLegendAndStats(container, timetable);

  requestAnimationFrame(() => positionGanttBars(table));

  // Re-position bars when window resizes or sidebar toggles (which shifts layout)
  window.removeEventListener("resize", _onResize);
  window.addEventListener("resize", _onResize);
}

// ── Positioning ──────────────────────────────────────────────────────────────

function positionGanttBars(table) {
  const headerCells = table.querySelectorAll("thead th");
  if (headerCells.length < 2) return;

  const laneCell = table.querySelector(".schedule_lane_cell");
  if (!laneCell) return;
  const laneLeft = laneCell.getBoundingClientRect().left;

  drag.slotRects = [];
  for (let i = 1; i < headerCells.length; i++) {
    const rect = headerCells[i].getBoundingClientRect();
    drag.slotRects.push({ left: rect.left - laneLeft, width: rect.width });
  }

  applyBarPositions(table);
}

function applyBarPositions(table) {
  table.querySelectorAll(".course_bar").forEach((bar) => {
    positionBar(bar);
  });
}

function positionBar(bar) {
  const startIndex = parseInt(bar.dataset.startIndex, 10);
  const durationSlots = parseInt(bar.dataset.durationSlots, 10);
  if (isNaN(startIndex) || isNaN(durationSlots)) return;

  const slotRects = drag.slotRects;
  const startRect = slotRects[startIndex];
  if (!startRect) return;

  const endIndex = Math.min(
    startIndex + durationSlots - 1,
    slotRects.length - 1,
  );
  const endRect = slotRects[endIndex];
  const totalWidth = endRect.left + endRect.width - startRect.left;

  bar.style.left = `${startRect.left + 6}px`;
  bar.style.width = `${totalWidth - 12}px`;
}

// ── Table construction ───────────────────────────────────────────────────────

function createTimetableTable(timetable) {
  const table = document.createElement("table");
  table.className = "timetable";
  table.appendChild(createTableHeader());
  table.appendChild(createTableBody(timetable));
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
  DAYS.forEach((day) => tbody.appendChild(createDayRow(day, timetable)));
  return tbody;
}

function createDayRow(day, timetable) {
  const row = document.createElement("tr");

  const dayCell = document.createElement("td");
  dayCell.className = "day_cell";
  dayCell.textContent = day;
  row.appendChild(dayCell);

  const laneCell = document.createElement("td");
  laneCell.className = "schedule_lane_cell";
  laneCell.colSpan = TIME_SLOTS.length;

  const lane = document.createElement("div");
  lane.className = "timetable_lane";
  lane.dataset.day = day;

  // Attach drop-zone listeners to the lane
  attachLaneDropListeners(lane, day);

  const coursesMap = new Map();
  TIME_SLOTS.forEach((slot) => {
    (timetable[day][slot.id] || []).forEach((course) => {
      if (!coursesMap.has(course.course_code)) {
        coursesMap.set(course.course_code, course);
      }
    });
  });

  const bars = buildCourseBarsForDay(Array.from(coursesMap.values()));

  const laneRows = new Map();
  bars.forEach((bar, i) => {
    if (!laneRows.has(bar.laneIndex)) {
      const laneRow = document.createElement("div");
      laneRow.className = "timetable_lane_row";
      laneRows.set(bar.laneIndex, laneRow);
    }
    const courseBlock = createCourseBlock(bar.course);
    courseBlock.classList.add("course_bar");
    courseBlock.dataset.startIndex = bar.startIndex;
    courseBlock.dataset.durationSlots = bar.durationSlots;
    courseBlock.dataset.courseCode = bar.course.course_code;
    courseBlock.dataset.day = day;
    courseBlock.style.setProperty("--i", i);

    // Click to edit — opens the same modal as My Entities
    courseBlock.addEventListener("click", () => {
      if (courseBlock.classList.contains("dragging")) return;
      editCourse(bar.course.course_code);
    });

    // Make it draggable
    attachDragListeners(courseBlock, bar.course, day);

    laneRows.get(bar.laneIndex).appendChild(courseBlock);
  });

  [...laneRows.keys()]
    .sort((a, b) => a - b)
    .forEach((idx) => {
      lane.appendChild(laneRows.get(idx));
    });

  laneCell.appendChild(lane);
  row.appendChild(laneCell);
  return row;
}

// ── Drag listeners on each bar ───────────────────────────────────────────────

function attachDragListeners(barEl, course, day) {
  barEl.setAttribute("draggable", "true");

  barEl.addEventListener("dragstart", (e) => {
    drag.bar = barEl;
    drag.course = course;
    drag.sourceDay = day;
    drag.sourceSlotId = course.startSlot;

    // Delay the opacity change so the ghost image renders first
    requestAnimationFrame(() => barEl.classList.add("dragging"));

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", course.course_code);
  });

  barEl.addEventListener("dragend", () => {
    barEl.classList.remove("dragging");
    clearAllDropIndicators();
    drag.bar = null;
    drag.course = null;
    drag.sourceDay = null;
    drag.sourceSlotId = null;
  });
}

// ── Drop-zone listeners on each lane ────────────────────────────────────────

function attachLaneDropListeners(lane, day) {
  // Indicator element — created once per lane, reused during drag-over
  const indicator = document.createElement("div");
  indicator.className = "drop_indicator";
  indicator.style.display = "none";
  lane.appendChild(indicator);

  lane.addEventListener("dragover", (e) => {
    if (!drag.course) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    lane.classList.add("drag_over");

    // Work out which slot the cursor is snapping to
    const snapped = getSnappedSlot(e, lane);
    if (snapped === null) {
      indicator.style.display = "none";
      return;
    }

    // Show the indicator at the snapped position
    const slotRects = drag.slotRects;
    const startRect = slotRects[snapped.slotIndex];
    const duration = parseInt(drag.bar.dataset.durationSlots, 10);
    const endIdx = Math.min(
      snapped.slotIndex + duration - 1,
      slotRects.length - 1,
    );
    const endRect = slotRects[endIdx];
    const totalWidth = endRect.left + endRect.width - startRect.left;

    indicator.style.display = "block";
    indicator.style.left = `${startRect.left + 4}px`;
    indicator.style.width = `${totalWidth - 8}px`;
    // Vertically span the full lane content area (exclude the indicator row itself)
    indicator.style.top = "4px";
    indicator.style.bottom = "4px";
  });

  lane.addEventListener("dragleave", (e) => {
    // Only clear when leaving the lane entirely (not entering a child)
    if (!lane.contains(e.relatedTarget)) {
      lane.classList.remove("drag_over");
      indicator.style.display = "none";
    }
  });

  lane.addEventListener("drop", (e) => {
    e.preventDefault();
    lane.classList.remove("drag_over");
    indicator.style.display = "none";

    if (!drag.course) return;

    const snapped = getSnappedSlot(e, lane);
    if (snapped === null) return;

    const newSlotId = TIME_SLOTS[snapped.slotIndex].id;
    const duration = parseInt(drag.bar.dataset.durationSlots, 10);

    // Bounds check — course must fit within TIME_SLOTS
    if (snapped.slotIndex + duration > TIME_SLOTS.length) return;

    moveCourse(
      drag.course,
      drag.sourceDay,
      drag.sourceSlotId,
      day,
      newSlotId,
      duration,
    );
  });
}

// ── Slot-snap helper ─────────────────────────────────────────────────────────

/**
 * Given a dragover/drop event and the lane element, returns the snapped slot
 * index (integer) or null if out of range.
 */
function getSnappedSlot(e, lane) {
  const slotRects = drag.slotRects;
  if (!slotRects.length) return null;

  const laneRect = lane.getBoundingClientRect();
  const cursorX = e.clientX - laneRect.left;

  // Find which slot column the cursor is over
  for (let i = 0; i < slotRects.length; i++) {
    const { left, width } = slotRects[i];
    if (cursorX >= left && cursorX < left + width) {
      return { slotIndex: i };
    }
  }
  return null;
}

// ── Timetable mutation ───────────────────────────────────────────────────────

function moveCourse(
  course,
  fromDay,
  fromSlotId,
  toDay,
  toSlotId,
  durationSlots,
) {
  // Remove from old position in every slot it occupied
  const oldStartIndex = TIME_SLOTS.findIndex((s) => s.id === fromSlotId);
  for (let i = 0; i < durationSlots; i++) {
    const slotId = TIME_SLOTS[oldStartIndex + i]?.id;
    if (slotId === undefined) continue;
    const arr = _timetable[fromDay][slotId];
    const idx = arr.findIndex((c) => c.course_code === course.course_code);
    if (idx !== -1) arr.splice(idx, 1);
  }

  // Build updated course object with new slot info
  const newStartIndex = TIME_SLOTS.findIndex((s) => s.id === toSlotId);
  const newEndSlot =
    TIME_SLOTS[newStartIndex + durationSlots - 1]?.id ?? toSlotId;
  const newEndTime = TIME_SLOTS[newStartIndex + durationSlots]?.time ?? "18:00";

  const updatedCourse = {
    ...course,
    startSlot: toSlotId,
    endSlot: newEndSlot,
    timeRange: `${TIME_SLOTS[newStartIndex].time} - ${newEndTime}`,
  };

  // Insert into every slot the course now occupies
  for (let i = 0; i < durationSlots; i++) {
    const slotId = TIME_SLOTS[newStartIndex + i]?.id;
    if (slotId === undefined) continue;
    if (!_timetable[toDay][slotId]) _timetable[toDay][slotId] = [];
    _timetable[toDay][slotId].push(updatedCourse);
  }

  // Re-render
  displayTimetable(_timetable);
}

// ── Cleanup helpers ──────────────────────────────────────────────────────────

function clearAllDropIndicators() {
  document.querySelectorAll(".drop_indicator").forEach((el) => {
    el.style.display = "none";
  });
  document.querySelectorAll(".timetable_lane.drag_over").forEach((el) => {
    el.classList.remove("drag_over");
  });
}

// ── Bar layout ───────────────────────────────────────────────────────────────

function buildCourseBarsForDay(courses) {
  const bars = [];

  const rawBars = courses
    .map((course) => {
      const startId = course.startSlot;
      const endId = course.endSlot;
      const startIndex = TIME_SLOTS.findIndex((s) => s.id === startId);
      let durationSlots = 2;

      // Always prefer duration_hours as ground truth — it's set directly
      // from the course record and never miscomputed. The endId-based formula
      // breaks when slot IDs are not strictly 1-apart.
      if (course.duration_hours) {
        durationSlots = Number(course.duration_hours) || 2;
      } else if (
        typeof startId === "number" &&
        typeof endId === "number" &&
        startIndex !== -1
      ) {
        durationSlots = endId - startId + 1;
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

  // Greedy lane assignment — overlapping bars go to a new row
  const laneEnds = [];
  rawBars
    .sort((a, b) => a.startIndex - b.startIndex)
    .forEach((bar) => {
      let laneIndex = 0;
      while (
        laneIndex < laneEnds.length &&
        laneEnds[laneIndex] >= bar.startIndex
      ) {
        laneIndex++;
      }
      laneEnds[laneIndex] = bar.endIndex;
      bars.push({ ...bar, laneIndex });
    });

  return bars;
}

// ── Course block element ─────────────────────────────────────────────────────

function createCourseBlock(course) {
  const courseBlock = document.createElement("div");
  courseBlock.className = "course_block";

  [
    { className: "course_code", text: course.course_code },
    { className: "course_name", text: course.course_name },
    { className: "time_range", text: course.timeRange },
    {
      className: "lecturer_name",
      text: course.lecturer_name || course.lecturer_id,
    },
  ].forEach(({ className, text }) => {
    const el = document.createElement("div");
    el.className = className;
    el.textContent = text;
    courseBlock.appendChild(el);
  });

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

  const color = getProgrammeColor(
    course.programme_level,
    course.programme_name,
    course.programme_year,
  );
  courseBlock.style.borderLeftColor = color;

  return courseBlock;
}

// ── Legend & Stats ───────────────────────────────────────────────────────────

function addLegendAndStats(container, timetable) {
  // Update the stats bar cards at the top
  updateStatsBar(timetable);

  // Legend still lives below the timetable
  const infoSection = document.createElement("div");
  infoSection.className = "timetable_info";
  infoSection.appendChild(createLegend(timetable));
  container.appendChild(infoSection);
}

export function updateStatsBar(timetable) {
  const bar = document.getElementById("timetableStatsBar");
  if (!bar) return;

  const s = calculateStatistics(timetable);

  bar.style.display = "grid";
  document
    .getElementById("statBarCourses")
    .querySelector(".stats_bar_value").textContent = s.totalCourses;
  document
    .getElementById("statBarBlocks")
    .querySelector(".stats_bar_value").textContent =
    `${s.blocksUsed} / ${s.totalBlocks}`;
  document
    .getElementById("statBarUtilization")
    .querySelector(".stats_bar_value").textContent = `${s.utilization}%`;
  document
    .getElementById("statBarSessions")
    .querySelector(".stats_bar_value").textContent = s.simultaneousSessions;
}

function createLegend(timetable) {
  const legend = document.createElement("div");
  legend.className = "timetable_legend";

  const legendTitle = document.createElement("h3");
  legendTitle.textContent = "Programme Legend";
  legend.appendChild(legendTitle);

  const levelOrder = ["Foundation", "Diploma", "Degree", "Master", "PhD"];

  getUniqueProgrammes(timetable)
    .slice()
    .sort((a, b) => {
      const ld =
        levelOrder.indexOf(a.programme_level) -
        levelOrder.indexOf(b.programme_level);
      if (ld !== 0) return ld;
      const nd = a.programme_name.localeCompare(b.programme_name);
      if (nd !== 0) return nd;
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

  [
    { label: "Total Courses", value: statistics.totalCourses },
    {
      label: "Time Blocks Used",
      value: `${statistics.blocksUsed} / ${statistics.totalBlocks}`,
    },
    { label: "Utilization", value: `${statistics.utilization}%` },
    { label: "Simultaneous Sessions", value: statistics.simultaneousSessions },
  ].forEach(({ label, value }) => {
    const item = document.createElement("div");
    item.className = "stat_item";
    item.innerHTML = `<strong>${label}:</strong> ${value}`;
    stats.appendChild(item);
  });

  return stats;
}

function getUniqueProgrammes(timetable) {
  const map = new Map();
  DAYS.forEach((day) => {
    TIME_SLOTS.forEach((slot) => {
      (timetable[day][slot.id] || []).forEach((course) => {
        const key = `${course.programme_level}_${course.programme_name}_${course.programme_year}`;
        if (!map.has(key)) {
          map.set(key, {
            programme_level: course.programme_level,
            programme_name: course.programme_name,
            programme_year: course.programme_year,
          });
        }
      });
    });
  });
  return Array.from(map.values());
}

function calculateStatistics(timetable) {
  const uniqueCourses = new Set();
  let blocksUsed = 0,
    simultaneousSessions = 0;

  DAYS.forEach((day) => {
    // Collect each course only once per day (keyed by course_code) using its
    // canonical startSlot so multi-slot courses aren't counted per slot they occupy.
    const seenCodes = new Set();
    const allCourses = [];
    TIME_SLOTS.forEach((slot) => {
      (timetable[day][slot.id] || []).forEach((course) => {
        uniqueCourses.add(course.course_code);
        if (seenCodes.has(course.course_code)) return;
        seenCodes.add(course.course_code);
        const startIndex = TIME_SLOTS.findIndex(
          (s) => s.id === course.startSlot,
        );
        if (startIndex === -1) return;
        const duration = Number(course.duration_hours) || 2;
        allCourses.push({ startIndex, endIndex: startIndex + duration - 1 });
      });
    });

    // Per slot index, count how many courses are active (span across it)
    TIME_SLOTS.forEach((slot, slotIndex) => {
      const active = allCourses.filter(
        (c) => slotIndex >= c.startIndex && slotIndex <= c.endIndex,
      ).length;
      if (active > 0) blocksUsed++;
      if (active > 1) simultaneousSessions++;
    });
  });

  const totalCourses = uniqueCourses.size;
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