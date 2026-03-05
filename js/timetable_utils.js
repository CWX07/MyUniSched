/**
 * timetable_utils.js — Shared timetable rendering & export utilities
 *
 * Extracted from generate.js and mySchedule.js to eliminate ~200 lines of
 * duplication. Both files import from here so any fix applies everywhere.
 *
 * Exports:
 *   buildGanttTable(timetable)         → <table> DOM element (Gantt view)
 *   positionBars(table)                → positions .course_bar elements via px
 *   buildExportTableHTML(timetable, styleMode) → HTML string for PDF/Excel
 *   greedyLaneAssign(rawBars)          → assigns laneIndex to each bar object
 */

import { TIME_SLOTS, DAYS, getProgrammeColor } from "./config.js";

// ── Greedy lane assignment ────────────────────────────────────────────────────
// Given an array of { startIndex, endIndex, durationSlots, course } objects
// (already sorted by startIndex), assigns a `laneIndex` to each so that no
// two bars in the same lane overlap. Returns a new array with laneIndex added.

export function greedyLaneAssign(rawBars) {
  const sorted = [...rawBars].sort((a, b) => a.startIndex - b.startIndex);
  const laneEnds = [];
  return sorted.map((bar) => {
    let laneIndex = 0;
    while (
      laneIndex < laneEnds.length &&
      laneEnds[laneIndex] >= bar.startIndex
    ) {
      laneIndex++;
    }
    laneEnds[laneIndex] = bar.endIndex;
    return { ...bar, laneIndex };
  });
}

// ── Build raw bar descriptors for one day ────────────────────────────────────
// Collects unique courses from the timetable for `day` and maps each to a
// { course, startIndex, endIndex, durationSlots } descriptor.

export function buildRawBarsForDay(timetable, day) {
  const courseMap = new Map();
  TIME_SLOTS.forEach((slot) => {
    (timetable[day]?.[slot.id] || []).forEach((course) => {
      if (!courseMap.has(course.course_code))
        courseMap.set(course.course_code, course);
    });
  });

  return Array.from(courseMap.values())
    .map((course) => {
      const startIndex = TIME_SLOTS.findIndex((s) => s.id === course.startSlot);
      if (startIndex === -1) return null;
      const durationSlots = Number(course.duration_hours) || 2;
      return {
        course,
        startIndex,
        endIndex: startIndex + durationSlots - 1,
        durationSlots,
      };
    })
    .filter(Boolean);
}

// ── Build Gantt <table> DOM element ──────────────────────────────────────────

export function buildGanttTable(timetable) {
  const table = document.createElement("table");
  table.className = "timetable";

  // Header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const dayTh = document.createElement("th");
  dayTh.textContent = "Day / Time";
  dayTh.className = "day_header";
  headerRow.appendChild(dayTh);
  TIME_SLOTS.forEach((slot) => {
    const th = document.createElement("th");
    th.textContent = slot.time;
    th.className = "time_header";
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement("tbody");
  DAYS.forEach((day) => {
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

    const bars = greedyLaneAssign(buildRawBarsForDay(timetable, day));

    // Group bars by lane row
    const laneRows = new Map();
    bars.forEach((bar) => {
      if (!laneRows.has(bar.laneIndex)) {
        const lr = document.createElement("div");
        lr.className = "timetable_lane_row";
        laneRows.set(bar.laneIndex, lr);
      }

      const color = getProgrammeColor(
        bar.course.programme_level,
        bar.course.programme_name,
        bar.course.programme_year,
      );

      const block = document.createElement("div");
      block.className = "course_block course_bar";
      block.dataset.startIndex = bar.startIndex;
      block.dataset.durationSlots = bar.durationSlots;
      block.style.borderLeftColor = color;
      block.innerHTML = `
        <div class="course_code">${bar.course.course_code}</div>
        <div class="course_name">${bar.course.course_name}</div>
        <div class="time_range">${bar.course.timeRange || ""}</div>
        <div class="lecturer_name">${bar.course.lecturer_name || ""}</div>
        <div class="programme_info">
          <span class="programme_info_title">${bar.course.programme_level || ""} in ${bar.course.programme_name || ""}</span>
          <span class="programme_info_year">Year ${bar.course.programme_year || ""}</span>
        </div>
      `;
      laneRows.get(bar.laneIndex).appendChild(block);
    });

    [...laneRows.keys()]
      .sort((a, b) => a - b)
      .forEach((idx) => lane.appendChild(laneRows.get(idx)));

    laneCell.appendChild(lane);
    row.appendChild(laneCell);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  return table;
}

// ── Position bars using pixel rects ──────────────────────────────────────────

export function positionBars(table) {
  const headerCells = table.querySelectorAll("thead th");
  if (headerCells.length < 2) return;

  const laneCell = table.querySelector(".schedule_lane_cell");
  if (!laneCell) return;
  const laneLeft = laneCell.getBoundingClientRect().left;

  const slotRects = [];
  for (let i = 1; i < headerCells.length; i++) {
    const rect = headerCells[i].getBoundingClientRect();
    slotRects.push({ left: rect.left - laneLeft, width: rect.width });
  }

  table.querySelectorAll(".course_bar").forEach((bar) => {
    const startIndex = parseInt(bar.dataset.startIndex, 10);
    const durationSlots = parseInt(bar.dataset.durationSlots, 10);
    if (isNaN(startIndex) || isNaN(durationSlots)) return;
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
  });
}

// ── Build export HTML table string (PDF / Excel) ──────────────────────────────
// `styleMode` is either "pdf" or "excel".

export function buildExportTableHTML(timetable, styleMode = "pdf") {
  const isPdf = styleMode === "pdf";

  const thStyle = isPdf
    ? `background:#1a1a2e;color:#fff;padding:6px 4px;border:1px solid #555;text-align:center;vertical-align:middle;min-width:55px;font-size:9px;`
    : `background:#1a1a2e;color:#fff;font-weight:600;min-width:60px;padding:6px 4px;border:1px solid #555;text-align:center;`;

  const dayThStyle = isPdf
    ? `background:#1a1a2e;color:#fff;padding:6px 8px;border:1px solid #555;min-width:72px;font-size:10px;text-align:center;vertical-align:middle;`
    : `background:#1a1a2e;color:#fff;font-weight:700;min-width:80px;padding:6px 8px;border:1px solid #555;`;

  const dayColPct = 6;
  const timeColPct = ((100 - dayColPct) / TIME_SLOTS.length).toFixed(4);

  const colGroup = `<colgroup>
    <col style="width:${dayColPct}%;">
    ${TIME_SLOTS.map(() => `<col style="width:${timeColPct}%;">`).join("")}
  </colgroup>`;

  let tableHTML = `<table style="table-layout:fixed;border-collapse:collapse;width:100%;">${colGroup}<thead><tr>
    <th style="${dayThStyle}">Day / Time</th>
    ${TIME_SLOTS.map((s) => `<th style="${thStyle}">${s.time}</th>`).join("")}
  </tr></thead><tbody>`;

  DAYS.forEach((day) => {
    const rawBars = buildRawBarsForDay(timetable, day).sort(
      (a, b) => a.startIndex - b.startIndex,
    );

    // Group into lanes using the same greedy algorithm
    const laneEnds = [];
    const lanes = [];
    rawBars.forEach((bar) => {
      let laneIndex = 0;
      while (
        laneIndex < laneEnds.length &&
        laneEnds[laneIndex] >= bar.startIndex
      ) {
        laneIndex++;
      }
      laneEnds[laneIndex] = bar.endIndex;
      if (!lanes[laneIndex]) lanes[laneIndex] = [];
      lanes[laneIndex].push(bar);
    });

    const laneCount = lanes.length || 1;

    lanes.forEach((laneBars, laneIdx) => {
      tableHTML += `<tr>`;

      if (laneIdx === 0) {
        const dayCellStyle = isPdf
          ? `font-weight:700;background:#f0f0f5;padding:6px;border:1px solid #ccc;vertical-align:middle;text-align:center;width:72px;font-size:10px;`
          : `font-weight:700;background:#f0f0f5;padding:6px 8px;border:1px solid #ccc;vertical-align:middle;text-align:center;`;
        tableHTML += `<td rowspan="${laneCount}" style="${dayCellStyle}">${day}</td>`;
      }

      const barByStart = new Map();
      laneBars.forEach((bar) => barByStart.set(bar.startIndex, bar));

      let slotIdx = 0;
      while (slotIdx < TIME_SLOTS.length) {
        const bar = barByStart.get(slotIdx);
        if (bar) {
          const colspan = Math.min(bar.durationSlots, TIME_SLOTS.length - slotIdx);
          const c = bar.course;
          const color = getProgrammeColor(
            c.programme_level,
            c.programme_name,
            c.programme_year,
          );
          const cellStyle = `border:1px solid #ccc;padding:4px;vertical-align:middle;`;
          const contentStyle = `padding:5px 7px;border-left:4px solid ${color};background:#f5f5ff;border-radius:3px;`;
          const codeStyle = isPdf ? `font-weight:700;font-size:10px;` : `font-weight:700;font-size:11px;`;
          const nameStyle = isPdf ? `font-size:10px;` : `font-size:11px;`;
          const metaStyle = isPdf ? `font-size:9px;color:#555;` : `font-size:10px;color:#555;`;

          tableHTML += `<td colspan="${colspan}" style="${cellStyle}">
            <div style="${contentStyle}">
              <div style="${codeStyle}">${c.course_code}
                <span style="font-weight:400;color:#888;font-size:9px;">${c.timeRange || ""}</span>
              </div>
              <div style="${nameStyle}">${c.course_name}</div>
              <div style="${metaStyle};font-style:italic;">${c.lecturer_name || ""}</div>
              <div style="${metaStyle}">${c.programme_level || ""} ${c.programme_name || ""} Yr${c.programme_year || ""}</div>
            </div>
          </td>`;
          slotIdx += bar.durationSlots;
        } else {
          tableHTML += `<td style="border:1px solid #eee;"></td>`;
          slotIdx++;
        }
      }

      tableHTML += `</tr>`;
    });

    if (lanes.length === 0) {
      const dayCellStyle = isPdf
        ? `font-weight:700;background:#f0f0f5;padding:6px;border:1px solid #ccc;vertical-align:middle;text-align:center;width:72px;font-size:10px;`
        : `font-weight:700;background:#f0f0f5;padding:6px 8px;border:1px solid #ccc;vertical-align:middle;text-align:center;`;
      tableHTML += `<tr>
        <td style="${dayCellStyle}">${day}</td>
        ${TIME_SLOTS.map(() => `<td style="border:1px solid #eee;"></td>`).join("")}
      </tr>`;
    }
  });

  tableHTML += `</tbody></table>`;
  return tableHTML;
}