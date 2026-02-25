import {
  initAuth,
  getCurrentUser,
  showNotification,
  showConfirm,
} from "./auth.js";
import { TIME_SLOTS, DAYS, getProgrammeColor } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  loadSchedules();
});

// ── Load all saved timetables ─────────────────────────────────────────────────

async function loadSchedules() {
  const container = document.getElementById("myScheduleContainer");
  const user = getCurrentUser();

  if (!user) {
    container.innerHTML = `
      <div class="schedule_empty">
        <i class="fa-solid fa-calendar-xmark"></i>
        <p>Please <a href="#" id="loginPrompt">log in</a> to view your saved timetables.</p>
      </div>`;
    document.getElementById("loginPrompt")?.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector(".authModal.login")?.classList.add("active");
    });
    return;
  }

  container.innerHTML = '<p class="loading_msg">Loading your schedules…</p>';

  try {
    const res = await fetch(`/api/timetables?uid=${user.uid}`);
    const timetables = await res.json();
    if (!res.ok || timetables.error)
      throw new Error(timetables.error || "Failed to load");

    if (timetables.length === 0) {
      container.innerHTML = `
        <div class="schedule_empty">
          <i class="fa-solid fa-calendar-plus"></i>
          <p>No saved timetables yet. <a href="./generate.html">Generate one!</a></p>
        </div>`;
      return;
    }

    container.innerHTML = "";
    timetables.forEach((tt) => renderScheduleCard(container, tt));
  } catch (err) {
    container.innerHTML = `<p class="error_msg">Error loading schedules: ${err.message}</p>`;
  }
}

// ── Render one card with inline dropdown ──────────────────────────────────────

function renderScheduleCard(container, tt) {
  const wrapper = document.createElement("div");
  wrapper.className = "schedule_card_wrapper";

  const savedDate = new Date(tt.savedAt).toLocaleString();

  // ── Card bar ──
  const card = document.createElement("div");
  card.className = "schedule_card";
  card.innerHTML = `
    <div class="schedule_card_info">
      <div class="schedule_card_name">${tt.name}</div>
      <div class="schedule_card_date">
        <i class="fa-regular fa-clock"></i> ${savedDate}
      </div>
    </div>
    <div class="schedule_card_actions">
      <button class="action_bar_btn view_btn">
        <i class="fa-solid fa-chevron-down view_chevron"></i> View
      </button>
      <button class="action_bar_btn download_btn dl_pdf_btn">
        <i class="fa-solid fa-file-pdf"></i> PDF
      </button>
      <button class="action_bar_btn download_btn dl_excel_btn">
        <i class="fa-solid fa-file-excel"></i> Excel
      </button>
      <button class="action_bar_btn delete_tt_btn">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  `;

  // ── Collapsible panel ──
  const panel = document.createElement("div");
  panel.className = "schedule_card_panel";

  const panelInner = document.createElement("div");
  panelInner.className = "schedule_card_panel_inner";
  panel.appendChild(panelInner);

  // ── State ──
  let isOpen = false;
  let isLoaded = false;
  let cachedTimetable = null;

  // ── View toggle ──
  const viewBtn = card.querySelector(".view_btn");
  const chevron = card.querySelector(".view_chevron");

  viewBtn.addEventListener("click", async () => {
    isOpen = !isOpen;

    if (isOpen) {
      // Open
      viewBtn.classList.add("active");
      chevron.classList.add("rotated");
      card.classList.add("card_expanded");
      panel.classList.add("open");

      if (!isLoaded) {
        panelInner.innerHTML = `
          <div class="panel_loading">
            <i class="fa-solid fa-spinner fa-spin"></i> Loading timetable…
          </div>`;
        try {
          cachedTimetable = await fetchTimetable(tt.id);
          isLoaded = true;
          renderTimetableInPanel(panelInner, cachedTimetable);
        } catch (err) {
          panelInner.innerHTML = `<p class="error_msg">Failed to load: ${err.message}</p>`;
          // Reset state so user can retry
          isOpen = false;
          isLoaded = false;
          panel.classList.remove("open");
          card.classList.remove("card_expanded");
          viewBtn.classList.remove("active");
          chevron.classList.remove("rotated");
        }
      }
    } else {
      // Close
      viewBtn.classList.remove("active");
      chevron.classList.remove("rotated");
      card.classList.remove("card_expanded");
      panel.classList.remove("open");
    }
  });

  // ── PDF ──
  card.querySelector(".dl_pdf_btn").addEventListener("click", async () => {
    try {
      if (!cachedTimetable) cachedTimetable = await fetchTimetable(tt.id);
      openPrintWindow(cachedTimetable, tt.name);
    } catch (err) {
      showNotification("Error: " + err.message, "error");
    }
  });

  // ── Excel ──
  card.querySelector(".dl_excel_btn").addEventListener("click", async () => {
    try {
      if (!cachedTimetable) cachedTimetable = await fetchTimetable(tt.id);
      exportExcel(cachedTimetable, tt.name);
    } catch (err) {
      showNotification("Error: " + err.message, "error");
    }
  });

  // ── Delete ──
  card
    .querySelector(".delete_tt_btn")
    .addEventListener("click", () => deleteTimetable(tt.id, wrapper));

  wrapper.appendChild(card);
  wrapper.appendChild(panel);
  container.appendChild(wrapper);
}

// ── Fetch timetable data ──────────────────────────────────────────────────────

async function fetchTimetable(id) {
  const res = await fetch(`/api/timetables/${id}`);
  if (!res.ok) throw new Error("Failed to fetch timetable");
  const data = await res.json();
  return data.timetable;
}

// ── Render Gantt timetable inside panel ──────────────────────────────────────

function renderTimetableInPanel(container, timetable) {
  container.innerHTML = "";

  const hasCourses = DAYS.some((day) =>
    TIME_SLOTS.some((slot) => (timetable[day]?.[slot.id] || []).length > 0),
  );

  if (!hasCourses) {
    container.innerHTML = `
      <div class="panel_empty">
        <i class="fa-solid fa-calendar-xmark"></i>
        <span>No scheduled courses in this timetable.</span>
      </div>`;
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "timetable_wrapper";

  const tableContainer = document.createElement("div");
  tableContainer.className = "timetable_container";

  const table = buildGanttTable(timetable);
  tableContainer.appendChild(table);
  wrapper.appendChild(tableContainer);
  container.appendChild(wrapper);

  // Position bars after layout paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => positionBars(table));
  });
}

// ── Build the Gantt table (same logic as generate_ui.js) ─────────────────────

function buildGanttTable(timetable) {
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

    // Collect unique courses for this day (stored at start slot only)
    const coursesMap = new Map();
    TIME_SLOTS.forEach((slot) => {
      (timetable[day]?.[slot.id] || []).forEach((course) => {
        if (!coursesMap.has(course.course_code))
          coursesMap.set(course.course_code, course);
      });
    });

    // Greedy lane assignment — same algorithm as generate_ui.js
    const rawBars = Array.from(coursesMap.values())
      .map((course) => {
        const startIndex = TIME_SLOTS.findIndex(
          (s) => s.id === course.startSlot,
        );
        const durationSlots = Number(course.duration_hours) || 2;
        if (startIndex === -1) return null;
        return {
          course,
          startIndex,
          endIndex: startIndex + durationSlots - 1,
          durationSlots,
        };
      })
      .filter(Boolean);

    const laneEnds = [];
    const bars = [];
    rawBars
      .sort((a, b) => a.startIndex - b.startIndex)
      .forEach((bar) => {
        let laneIndex = 0;
        while (
          laneIndex < laneEnds.length &&
          laneEnds[laneIndex] >= bar.startIndex
        )
          laneIndex++;
        laneEnds[laneIndex] = bar.endIndex;
        bars.push({ ...bar, laneIndex });
      });

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

// ── Position bars using pixel rects (same as generate_ui.js) ─────────────────

function positionBars(table) {
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

// ── Shared export table builder ───────────────────────────────────────────────
// Builds an HTML <table> string using the row-per-lane layout:
//   - One column per hour (08:00–18:00)
//   - One row per simultaneous-course "lane" per day
//   - Day cell uses rowspan across all its lanes
//   - Course cell uses colspan across its duration hours
//   - Empty slots are blank <td>s
//
// `styleMode` is either "pdf" or "excel" to switch minor style differences.

function buildExportTableHTML(timetable, styleMode = "pdf") {
  const isPdf = styleMode === "pdf";

  const thStyle = isPdf
    ? `background:#1a1a2e;color:#fff;padding:6px 4px;border:1px solid #555;text-align:center;vertical-align:middle;min-width:55px;font-size:9px;`
    : `background:#1a1a2e;color:#fff;font-weight:600;min-width:60px;padding:6px 4px;border:1px solid #555;text-align:center;`;

  const dayThStyle = isPdf
    ? `background:#1a1a2e;color:#fff;padding:6px 8px;border:1px solid #555;min-width:72px;font-size:10px;text-align:center;vertical-align:middle;`
    : `background:#1a1a2e;color:#fff;font-weight:700;min-width:80px;padding:6px 8px;border:1px solid #555;`;

  // Equal-width time columns: day col is fixed, remaining width split evenly across all time slots.
  // table-layout:fixed + % widths ensures every slot column is the same width,
  // regardless of whether it has a course (colspan) or is empty.
  const dayColPct = 6;
  const timeColPct = ((100 - dayColPct) / TIME_SLOTS.length).toFixed(4);

  const colGroup = `<colgroup>
    <col style="width:${dayColPct}%;">
    ${TIME_SLOTS.map(() => `<col style="width:${timeColPct}%;">`).join("")}
  </colgroup>`;

  // Header row
  let tableHTML = `<table style="table-layout:fixed;border-collapse:collapse;width:100%;">${colGroup}<thead><tr>
    <th style="${dayThStyle}">Day / Time</th>
    ${TIME_SLOTS.map((s) => `<th style="${thStyle}">${s.time}</th>`).join("")}
  </tr></thead><tbody>`;

  DAYS.forEach((day) => {
    // ── Step 1: collect unique courses for this day ──
    const courseMap = new Map();
    TIME_SLOTS.forEach((slot) => {
      (timetable[day]?.[slot.id] || []).forEach((c) => {
        if (!courseMap.has(c.course_code)) courseMap.set(c.course_code, c);
      });
    });

    // ── Step 2: compute start/end index for each course ──
    const rawBars = Array.from(courseMap.values())
      .map((c) => {
        const startIndex = TIME_SLOTS.findIndex((s) => s.id === c.startSlot);
        if (startIndex === -1) return null;
        const durationSlots = Number(c.duration_hours) || 2;
        return {
          course: c,
          startIndex,
          endIndex: startIndex + durationSlots - 1,
          durationSlots,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.startIndex - b.startIndex);

    // ── Step 3: greedy lane assignment (same as Gantt renderer) ──
    const laneEnds = [];
    const lanes = []; // array of lanes, each lane = array of bar objects

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

    // ── Step 4: render one <tr> per lane ──
    lanes.forEach((laneBars, laneIdx) => {
      tableHTML += `<tr>`;

      // Day cell — only on the first lane row, with rowspan
      if (laneIdx === 0) {
        const dayCellStyle = isPdf
          ? `font-weight:700;background:#f0f0f5;padding:6px;border:1px solid #ccc;vertical-align:middle;text-align:center;width:72px;font-size:10px;`
          : `font-weight:700;background:#f0f0f5;padding:6px 8px;border:1px solid #ccc;vertical-align:middle;text-align:center;`;
        tableHTML += `<td rowspan="${laneCount}" style="${dayCellStyle}">${day}</td>`;
      }

      // Build a lookup: startIndex -> bar for this lane
      const barByStart = new Map();
      laneBars.forEach((bar) => barByStart.set(bar.startIndex, bar));

      // Walk through every slot and emit cells
      let slotIdx = 0;
      while (slotIdx < TIME_SLOTS.length) {
        const bar = barByStart.get(slotIdx);

        if (bar) {
          const colspan = Math.min(
            bar.durationSlots,
            TIME_SLOTS.length - slotIdx,
          );
          const c = bar.course;
          const color = getProgrammeColor(
            c.programme_level,
            c.programme_name,
            c.programme_year,
          );

          const cellStyle = `border:1px solid #ccc;padding:4px;vertical-align:middle;`;
          const contentStyle = `padding:5px 7px;border-left:4px solid ${color};background:#f5f5ff;border-radius:3px;`;
          const codeStyle = isPdf
            ? `font-weight:700;font-size:10px;`
            : `font-weight:700;font-size:11px;`;
          const nameStyle = isPdf ? `font-size:10px;` : `font-size:11px;`;
          const metaStyle = isPdf
            ? `font-size:9px;color:#555;`
            : `font-size:10px;color:#555;`;

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

    // If day had zero courses, render a single empty row
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

// ── PDF export ────────────────────────────────────────────────────────────────

function openPrintWindow(timetable, name) {
  const tableHTML = buildExportTableHTML(timetable, "pdf");

  const pw = window.open("", "_blank");
  pw.document.write(`<!DOCTYPE html><html><head><title>${name}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:Arial,sans-serif;margin:16px;font-size:11px;}
    h1{font-size:16px;font-weight:800;margin-bottom:2px;}
    p{font-size:11px;color:#555;margin-bottom:10px;}
    table{border-collapse:collapse;width:100%;}
    td,th{word-break:break-word;overflow:hidden;}
    td, th { word-break: break-word; }
    @media print{@page{size:landscape;margin:8mm;}body{margin:0;}}
  </style></head><body>
  <h1>MyUniSched — ${name}</h1>
  <p>Generated on ${new Date().toLocaleString()}</p>
  ${tableHTML}
  </body></html>`);
  pw.document.close();
  pw.focus();
  setTimeout(() => pw.print(), 400);
}

// ── Excel export ──────────────────────────────────────────────────────────────

function exportExcel(timetable, name) {
  const tableHTML = buildExportTableHTML(timetable, "excel");

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="UTF-8"></head>
  <body>
    <h2 style="font-family:Arial;">${name}</h2>
    <p style="font-family:Arial;font-size:11px;color:#555;">Generated on ${new Date().toLocaleString()}</p>
    ${tableHTML}
  </body></html>`;

  const blob = new Blob([html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/\s+/g, "_")}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function deleteTimetable(id, wrapper) {
  const confirmed = await showConfirm(
    "Delete this timetable? <br> This cannot be undone.",
    "Delete",
  );
  if (!confirmed) return;
  try {
    const res = await fetch(`/api/timetables/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    wrapper.remove();

    const container = document.getElementById("myScheduleContainer");
    if (container.children.length === 0) {
      container.innerHTML = `
        <div class="schedule_empty">
          <i class="fa-solid fa-calendar-plus"></i>
          <p>No saved timetables yet. <a href="./generate.html">Generate one!</a></p>
        </div>`;
    }
  } catch (err) {
    showNotification("Error deleting timetable: " + err.message, "error");
  }
}