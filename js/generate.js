import {
  DEFAULT_MIN_COURSES_PER_SLOT,
  DEFAULT_MAX_COURSES_PER_SLOT,
  DEFAULT_MAX_SLOTS_PER_COURSE_PER_DAY,
  TIME_SLOTS,
  DAYS,
} from "./config.js";
import { generateSchedule } from "./scheduler.js";
import {
  filterTimetable,
  getUniqueCourses,
  getUniqueLecturers,
} from "./filters.js";
import { displayTimetable } from "./generate_ui.js";
import {
  addCourse,
  resetCourseForm,
  populateLecturerDropdown,
  populateProgrammeDropdown,
  onCourseUpdated,
} from "./course.js";
import {
  initAuth,
  getCurrentUser,
  showNotification,
  showPrompt,
} from "./auth.js";

let originalTimetable = null;
let currentConstraints = {
  minCoursesPerSlot: DEFAULT_MIN_COURSES_PER_SLOT,
  maxCoursesPerSlot: DEFAULT_MAX_COURSES_PER_SLOT,
  maxSlotsPerCoursePerDay: DEFAULT_MAX_SLOTS_PER_COURSE_PER_DAY,
};

document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initializeEventListeners();
  initializeConstraints();
  initCourseModal();

  onCourseUpdated(async () => {
    if (!originalTimetable) return;
    try {
      const res = await fetch(
        "/api/courses?uid=" + (getCurrentUser()?.uid ?? ""),
      );
      courses.forEach((c) => {
        courseMap[c.course_code] = c;
      });
      DAYS.forEach((day) => {
        TIME_SLOTS.forEach((slot) => {
          originalTimetable[day][slot.id] = originalTimetable[day][slot.id].map(
            (c) => {
              const fresh = courseMap[c.course_code];
              return fresh ? { ...c, ...fresh } : c;
            },
          );
        });
      });
      displayTimetable(originalTimetable);
    } catch (err) {
      console.error("Failed to refresh timetable:", err);
    }
  });
});

function initializeEventListeners() {
  document
    .getElementById("generateBtn")
    .addEventListener("click", generateTimetable);
  document.getElementById("resetBtn").addEventListener("click", resetTimetable);
  document
    .getElementById("minCoursesPerSlot")
    .addEventListener("change", updateConstraints);
  document
    .getElementById("maxCoursesPerSlot")
    .addEventListener("change", updateConstraints);
  document
    .getElementById("maxSlotsPerCoursePerDay")
    .addEventListener("change", updateConstraints);
  document
    .getElementById("filterType")
    .addEventListener("change", handleFilterTypeChange);
  document
    .getElementById("filterValue")
    .addEventListener("change", applyFilter);

  // Save timetable button
  document
    .getElementById("saveTimetableBtn")
    ?.addEventListener("click", saveTimetable);

  // Download buttons
  document
    .getElementById("downloadPdfBtn")
    ?.addEventListener("click", downloadPDF);
  document
    .getElementById("downloadExcelBtn")
    ?.addEventListener("click", downloadExcel);
}

function initializeConstraints() {
  document.getElementById("minCoursesPerSlot").value =
    DEFAULT_MIN_COURSES_PER_SLOT;
  document.getElementById("maxCoursesPerSlot").value =
    DEFAULT_MAX_COURSES_PER_SLOT;
  document.getElementById("maxSlotsPerCoursePerDay").value =
    DEFAULT_MAX_SLOTS_PER_COURSE_PER_DAY;
}

function updateConstraints() {
  let min = parseInt(document.getElementById("minCoursesPerSlot").value) || 0;
  let max = parseInt(document.getElementById("maxCoursesPerSlot").value) || 3;
  let maxSlotsPerCoursePerDay =
    parseInt(document.getElementById("maxSlotsPerCoursePerDay").value) ||
    DEFAULT_MAX_SLOTS_PER_COURSE_PER_DAY;

  if (min < 0) min = 0;
  if (max > 10) max = 10;
  if (min > max) {
    min = max;
    document.getElementById("minCoursesPerSlot").value = min;
  }

  currentConstraints = {
    minCoursesPerSlot: min,
    maxCoursesPerSlot: max,
    maxSlotsPerCoursePerDay,
  };
}

async function generateTimetable() {
  const statusDiv = document.getElementById("timetableStatus");
  statusDiv.innerHTML = '<p class="status_loading">Generating timetable...</p>';

  try {
    const res = await fetch(
      "/api/courses?uid=" + (getCurrentUser()?.uid ?? ""),
    );
    const courses = await res.json();

    if (courses.length === 0) {
      statusDiv.innerHTML =
        '<p class="status_error">No courses found. Please add courses first.</p>';
      return;
    }

    const timetable = generateSchedule(courses, currentConstraints);

    if (timetable) {
      originalTimetable = timetable;
      displayTimetable(timetable);
      populateFilterOptions(timetable);
      showActionButtons(true);
      statusDiv.innerHTML =
        '<p class="status_success">✓ Timetable generated successfully!</p>';
    } else {
      statusDiv.innerHTML =
        '<p class="status_error">Unable to generate conflict-free timetable. Try adjusting constraints or reducing courses.</p>';
    }
  } catch (err) {
    console.error(err);
    statusDiv.innerHTML =
      '<p class="status_error">Error generating timetable. Please try again.</p>';
  }
}

function showActionButtons(show) {
  const bar = document.getElementById("timetableActionBar");
  if (bar) bar.style.display = show ? "flex" : "none";
}

function populateFilterOptions(timetable) {
  const filterValueSelect = document.getElementById("filterValue");
  const filterType = document.getElementById("filterType").value;

  filterValueSelect.innerHTML = '<option value="all">All</option>';

  if (filterType === "course") {
    getUniqueCourses(timetable).forEach((programme) => {
      const option = document.createElement("option");
      option.value = programme.id;
      option.textContent = programme.label;
      filterValueSelect.appendChild(option);
    });
  } else if (filterType === "lecturer") {
    getUniqueLecturers(timetable).forEach((lecturer) => {
      const option = document.createElement("option");
      option.value = lecturer.id;
      option.textContent = lecturer.name;
      filterValueSelect.appendChild(option);
    });
  }

  filterValueSelect.disabled = false;
}

function handleFilterTypeChange() {
  document.getElementById("filterValue").value = "all";
  if (originalTimetable) {
    populateFilterOptions(originalTimetable);
    displayTimetable(originalTimetable);
  }
}

function applyFilter() {
  if (!originalTimetable) return;
  const filteredTimetable = filterTimetable(originalTimetable, {
    filterType: document.getElementById("filterType").value,
    filterValue: document.getElementById("filterValue").value,
  });
  displayTimetable(filteredTimetable);
}

function resetTimetable() {
  originalTimetable = null;
  document.getElementById("timetableContainer").innerHTML =
    '<p class="no_timetable">Click "Generate Timetable" to create your schedule</p>';
  document.getElementById("timetableStatus").innerHTML = "";
  document.getElementById("filterType").value = "none";
  document.getElementById("filterValue").innerHTML =
    '<option value="all">All</option>';
  document.getElementById("filterValue").disabled = true;
  showActionButtons(false);
  initializeConstraints();
  currentConstraints = {
    minCoursesPerSlot: DEFAULT_MIN_COURSES_PER_SLOT,
    maxCoursesPerSlot: DEFAULT_MAX_COURSES_PER_SLOT,
    maxSlotsPerCoursePerDay: DEFAULT_MAX_SLOTS_PER_COURSE_PER_DAY,
  };
}

// ── Save Timetable ────────────────────────────────────────────────────────────

async function saveTimetable() {
  const user = getCurrentUser();
  if (!user) {
    showNotification("Please log in to save your timetable.", "info");
    document.querySelector(".authModal.login")?.classList.add("active");
    return;
  }

  if (!originalTimetable) {
    showNotification("Please generate a timetable first.", "info");
    return;
  }

  const name = await showPrompt(
    "Enter a name for this timetable:",
    `Timetable ${new Date().toLocaleDateString()}`,
  );
  if (!name) return;

  // Serialise — replace Sets/Maps with plain objects (timetable should already be plain)
  const timetableData = JSON.parse(JSON.stringify(originalTimetable));

  try {
    const res = await fetch(`${API_BASE}/api/timetables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: user.uid,
        name,
        timetable: timetableData,
        constraints: currentConstraints,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed");
    showNotification(
      `Timetable "${name}" saved! View it in My Schedule.`,
      "success",
    );
  } catch (err) {
    showNotification("Error saving timetable: " + err.message, "error");
  }
}

// ── Download PDF ──────────────────────────────────────────────────────────────
// Captures the exact rendered timetable (Gantt bars + all styling) from the DOM
// and sends it to a print window — what you see is what you get.

function downloadPDF() {
  if (!originalTimetable) {
    showNotification("Generate a timetable first.", "info");
    return;
  }

  const container = document.getElementById("timetableContainer");
  if (!container) {
    showNotification("No timetable rendered.", "info");
    return;
  }

  // Clone the rendered timetable so we can inline all computed styles
  const clone = container.cloneNode(true);

  // The Gantt bars use absolute pixel left/width set by positionGanttBars().
  // Those inline styles are already on the elements so the clone carries them.
  // We just need to make sure the lane wrapper has position:relative and a
  // fixed height so bars render correctly on paper.

  const printWindow = window.open("", "_blank");
  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>MyUniSched Timetable</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; margin: 16px; font-size: 11px; background: #fff; }
    h1 { font-size: 16px; font-weight: 800; margin-bottom: 2px; }
    p  { font-size: 11px; color: #555; margin-bottom: 10px; }

    /* ── Timetable table ── */
    .timetable { border-collapse: collapse; width: 100%; table-layout: fixed; }
    .timetable th, .timetable td { border: 1px solid #ccc; padding: 0; vertical-align: top; }
    .day_header  { background: #e8e8e8; font-size: 10px; font-weight: 700; padding: 5px 6px; width: 72px; }
    .time_header { background: #f0f0f0; font-size: 9px;  font-weight: 600; padding: 5px 4px; text-align: center; }
    .day_cell    { font-weight: 700; background: #f8f8f8; font-size: 10px; padding: 6px; width: 72px; vertical-align: middle; }

    /* ── Gantt lane ── */
    .schedule_lane_cell { padding: 0; position: relative; }
    .timetable_lane     { position: relative; width: 100%; min-height: 56px; }
    .timetable_lane_row { position: relative; height: 56px; width: 100%; }

    /* ── Course bars (carry inline left/width from the live page) ── */
    .course_bar, .course_block {
      position: absolute;
      top: 4px; bottom: 4px;
      border-radius: 5px;
      border-left: 4px solid #5b5bd6;
      background: #f0f0ff;
      padding: 3px 5px;
      overflow: hidden;
      font-size: 9px;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .course_code   { font-weight: 700; font-size: 9px; }
    .course_name   { font-size: 8px; }
    .time_range    { font-size: 8px; color: #555; }
    .lecturer_name { font-size: 8px; color: #666; font-style: italic; }
    .programme_info { display: none; } /* hide programme label to save space */

    /* ── Legend & stats ── */
    .timetable_info   { display: flex; gap: 20px; margin-top: 10px; font-size: 10px; }
    .timetable_legend { flex: 1; }
    .timetable_stats  { flex: 1; }
    .timetable_legend h3, .timetable_stats h3 { font-size: 11px; margin-bottom: 4px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
    .legend_item  { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
    .legend_color { width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0; }
    .stat_item    { margin-bottom: 3px; }

    /* ── Drop indicator / drag UI — hide in print ── */
    .drop_indicator, [draggable] { cursor: default; }

    @media print {
      @page { size: landscape; margin: 8mm; }
      body  { margin: 0; }
    }
  </style>
</head>
<body>
  <h1>MyUniSched — Timetable</h1>
  <p>Generated on ${new Date().toLocaleString()}</p>
  ${clone.outerHTML}
</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 600);
}

// ── Download Excel ────────────────────────────────────────────────────────────
// Exports an HTML table (one column per 1-hour slot, colspan for multi-hour
// courses) saved as .xls — Excel opens it natively with full formatting.

function downloadExcel() {
  if (!originalTimetable) {
    showNotification("Generate a timetable first.", "info");
    return;
  }

  // One column per TIME_SLOT (each = 1 hour)
  const allSlots = TIME_SLOTS;

  // ── Header row ──
  let rows = `<tr>
    <th style="background:#e8e8e8;font-weight:700;min-width:80px;padding:6px 8px;border:1px solid #ccc;">Day / Time</th>
    ${allSlots.map((s) => `<th style="background:#f0f0f0;font-weight:600;min-width:60px;padding:6px 4px;border:1px solid #ccc;text-align:center;">${s.time}</th>`).join("")}
  </tr>`;

  DAYS.forEach((day) => {
    // Gather unique courses by start slot for this day
    const coursesByStart = new Map(); // startSlotId -> course[]
    allSlots.forEach((slot) => {
      const courses = originalTimetable[day][slot.id] || [];
      if (courses.length > 0) coursesByStart.set(slot.id, courses);
    });

    // Track which slot ids are "consumed" by a previous course's colspan
    const consumed = new Set();
    coursesByStart.forEach((courses, startSlotId) => {
      const dur = Math.max(
        ...courses.map((c) => Number(c.duration_hours) || 2),
      );
      const startIdx = allSlots.findIndex((s) => s.id === startSlotId);
      for (let i = 1; i < dur; i++) {
        const s = allSlots[startIdx + i];
        if (s) consumed.add(s.id);
      }
    });

    rows += `<tr>`;
    rows += `<td style="font-weight:700;background:#f8f8f8;padding:6px 8px;border:1px solid #ccc;vertical-align:middle;">${day}</td>`;

    allSlots.forEach((slot) => {
      if (consumed.has(slot.id)) return; // covered by colspan — skip cell

      const courses = originalTimetable[day][slot.id] || [];

      if (courses.length === 0) {
        rows += `<td style="border:1px solid #eee;"></td>`;
        return;
      }

      const maxDur = Math.max(
        ...courses.map((c) => Number(c.duration_hours) || 2),
      );
      const startIdx = allSlots.findIndex((s) => s.id === slot.id);
      const colspan = Math.min(maxDur, allSlots.length - startIdx);

      const cellContent = courses
        .map((c) => {
          const color = c.borderLeftColor || "#5b5bd6";
          return `<div style="margin-bottom:4px;padding:4px 6px;border-left:4px solid ${color};background:#f0f0ff;border-radius:3px;">
          <div style="font-weight:700;font-size:11px;">${c.course_code} <span style="font-weight:400;color:#888;font-size:10px;">${c.timeRange || ""}</span></div>
          <div style="font-size:11px;">${c.course_name}</div>
          <div style="font-size:10px;color:#555;font-style:italic;">${c.lecturer_name || ""}</div>
          <div style="font-size:10px;color:#777;">${c.programme_level || ""} ${c.programme_name || ""} Yr${c.programme_year || ""}</div>
        </div>`;
        })
        .join("");

      rows += `<td colspan="${colspan}" style="border:1px solid #ccc;padding:4px;vertical-align:top;">${cellContent}</td>`;
    });

    rows += `</tr>`;
  });

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
  <x:ExcelWorksheet><x:Name>Timetable</x:Name>
  <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
  </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; }
    table { border-collapse: collapse; }
  </style>
</head>
<body>
  <h2 style="font-family:Arial;margin-bottom:4px;">MyUniSched — Timetable</h2>
  <p style="font-family:Arial;font-size:11px;color:#555;margin-bottom:10px;">Generated on ${new Date().toLocaleString()}</p>
  <table>${rows}</table>
</body>
</html>`;

  const blob = new Blob([html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timetable_${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Course modal (unchanged) ──────────────────────────────────────────────────

function initCourseModal() {
  addCourse();

  const modal = document.querySelector(".addCourse_modal");
  const closeBtn = document.querySelector(".addCourse_close");

  closeBtn.addEventListener("click", () => {
    modal.style.opacity = "0";
    modal.style.zIndex = "-100";
    resetCourseForm();
  });

  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.opacity = "0";
      modal.style.zIndex = "-100";
      resetCourseForm();
    }
  });

  toggleLecturerDropdown();
  toggleCourseProgrammeDropdown();
  toggleCourseDurationDropdown();
}

function toggleLecturerDropdown() {
  const container = document.querySelector(".lecturerId_container");
  if (!container) return;
  const selected = container.querySelector(".lecturerId_selected");
  const list = container.querySelector(".lecturerId_list");
  selected.addEventListener("click", () => {
    const a = list.classList.toggle("active");
    selected.style.borderColor = a ? "#000" : "rgba(0,0,0,0.2)";
  });
  list.addEventListener("click", (e) => {
    if (e.target.tagName === "LI") {
      selected.textContent = e.target.textContent;
      selected.dataset.value = e.target.dataset.value;
      list.classList.remove("active");
      selected.style.borderColor = "rgba(0,0,0,0.2)";
    }
  });
  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) {
      list.classList.remove("active");
      selected.style.borderColor = "rgba(0,0,0,0.2)";
    }
  });
}

function toggleCourseProgrammeDropdown() {
  const container = document.querySelector(".programmeName_container");
  if (!container) return;
  const selected = container.querySelector(".programmeName_selected");
  const list = container.querySelector(".programmeName_list");
  selected.addEventListener("click", () => {
    const a = list.classList.toggle("active");
    selected.style.borderColor = a ? "#000" : "rgba(0,0,0,0.2)";
  });
  list.addEventListener("click", (e) => {
    if (e.target.tagName === "LI") {
      selected.textContent = e.target.textContent;
      selected.dataset.value = e.target.dataset.value;
      list.classList.remove("active");
      selected.style.borderColor = "rgba(0,0,0,0.2)";
    }
  });
  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) {
      list.classList.remove("active");
      selected.style.borderColor = "rgba(0,0,0,0.2)";
    }
  });
}

function toggleCourseDurationDropdown() {
  const container = document.querySelector(".courseDuration_container");
  if (!container) return;
  const selected = container.querySelector(".courseDuration_selected");
  const list = container.querySelector(".courseDuration_list");
  selected.addEventListener("click", () => {
    const a = list.classList.toggle("active");
    selected.style.borderColor = a ? "#000" : "rgba(0,0,0,0.2)";
  });
  list.addEventListener("click", (e) => {
    if (e.target.tagName === "LI") {
      selected.textContent = e.target.textContent;
      selected.dataset.value = e.target.dataset.value;
      list.classList.remove("active");
      selected.style.borderColor = "rgba(0,0,0,0.2)";
    }
  });
  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) {
      list.classList.remove("active");
      selected.style.borderColor = "rgba(0,0,0,0.2)";
    }
  });
}
