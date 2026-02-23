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

// ── PDF export ────────────────────────────────────────────────────────────────

function openPrintWindow(timetable, name) {
  const allSlots = TIME_SLOTS;
  let tableHTML = `<table><thead><tr>
    <th style="background:#e8e8e8;padding:6px 8px;border:1px solid #ccc;min-width:72px;font-size:10px;">Day / Time</th>
    ${allSlots.map((s) => `<th style="background:#f0f0f0;padding:6px 4px;border:1px solid #ccc;text-align:center;min-width:55px;font-size:9px;">${s.time}</th>`).join("")}
  </tr></thead><tbody>`;

  DAYS.forEach((day) => {
    const consumed = new Set();
    allSlots.forEach((slot) => {
      (timetable[day]?.[slot.id] || []).forEach((c) => {
        const dur = Number(c.duration_hours) || 2;
        const si = allSlots.findIndex((s) => s.id === slot.id);
        for (let i = 1; i < dur; i++) {
          const s = allSlots[si + i];
          if (s) consumed.add(s.id);
        }
      });
    });

    tableHTML += `<tr><td style="font-weight:700;background:#f8f8f8;padding:6px;border:1px solid #ccc;vertical-align:middle;width:72px;font-size:10px;">${day}</td>`;
    allSlots.forEach((slot) => {
      if (consumed.has(slot.id)) return;
      const courses = timetable[day]?.[slot.id] || [];
      if (!courses.length) {
        tableHTML += `<td style="border:1px solid #eee;"></td>`;
        return;
      }
      const maxDur = Math.max(
        ...courses.map((c) => Number(c.duration_hours) || 2),
      );
      const si = allSlots.findIndex((s) => s.id === slot.id);
      const colspan = Math.min(maxDur, allSlots.length - si);
      tableHTML += `<td colspan="${colspan}" style="border:1px solid #ccc;padding:3px;vertical-align:top;">`;
      courses.forEach((c) => {
        tableHTML += `<div style="margin:2px;padding:4px 6px;border-left:4px solid #5b5bd6;background:#f0f0ff;border-radius:4px;">
          <div style="font-weight:700;font-size:10px;">${c.course_code} <span style="font-weight:400;color:#888;">${c.timeRange || ""}</span></div>
          <div style="font-size:10px;">${c.course_name}</div>
          <div style="font-size:9px;color:#555;font-style:italic;">${c.lecturer_name || ""}</div>
        </div>`;
      });
      tableHTML += `</td>`;
    });
    tableHTML += `</tr>`;
  });
  tableHTML += `</tbody></table>`;

  const pw = window.open("", "_blank");
  pw.document.write(`<!DOCTYPE html><html><head><title>${name}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:Arial,sans-serif;margin:16px;font-size:11px;}
    h1{font-size:16px;font-weight:800;margin-bottom:2px;}
    p{font-size:11px;color:#555;margin-bottom:10px;}
    table{border-collapse:collapse;width:100%;}
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
  const allSlots = TIME_SLOTS;
  let rows = `<tr>
    <th style="background:#e8e8e8;font-weight:700;min-width:80px;padding:6px 8px;border:1px solid #ccc;">Day / Time</th>
    ${allSlots.map((s) => `<th style="background:#f0f0f0;font-weight:600;min-width:60px;padding:6px 4px;border:1px solid #ccc;text-align:center;">${s.time}</th>`).join("")}
  </tr>`;

  DAYS.forEach((day) => {
    const consumed = new Set();
    allSlots.forEach((slot) => {
      (timetable[day]?.[slot.id] || []).forEach((c) => {
        const dur = Number(c.duration_hours) || 2;
        const si = allSlots.findIndex((s) => s.id === slot.id);
        for (let i = 1; i < dur; i++) {
          const s = allSlots[si + i];
          if (s) consumed.add(s.id);
        }
      });
    });

    rows += `<tr><td style="font-weight:700;background:#f8f8f8;padding:6px 8px;border:1px solid #ccc;vertical-align:middle;">${day}</td>`;
    allSlots.forEach((slot) => {
      if (consumed.has(slot.id)) return;
      const courses = timetable[day]?.[slot.id] || [];
      if (!courses.length) {
        rows += `<td style="border:1px solid #eee;"></td>`;
        return;
      }
      const maxDur = Math.max(
        ...courses.map((c) => Number(c.duration_hours) || 2),
      );
      const si = allSlots.findIndex((s) => s.id === slot.id);
      const colspan = Math.min(maxDur, allSlots.length - si);
      const cells = courses
        .map(
          (c) => `
        <div style="margin-bottom:4px;padding:4px 6px;border-left:4px solid #5b5bd6;background:#f0f0ff;border-radius:3px;">
          <div style="font-weight:700;font-size:11px;">${c.course_code} <span style="font-weight:400;color:#888;">${c.timeRange || ""}</span></div>
          <div style="font-size:11px;">${c.course_name}</div>
          <div style="font-size:10px;color:#555;font-style:italic;">${c.lecturer_name || ""}</div>
        </div>`,
        )
        .join("");
      rows += `<td colspan="${colspan}" style="border:1px solid #ccc;padding:4px;vertical-align:top;">${cells}</td>`;
    });
    rows += `</tr>`;
  });

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="UTF-8"></head>
  <body>
    <h2 style="font-family:Arial;">${name}</h2>
    <p style="font-family:Arial;font-size:11px;color:#555;">Generated on ${new Date().toLocaleString()}</p>
    <table>${rows}</table>
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
    "Delete this timetable? This cannot be undone.",
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
