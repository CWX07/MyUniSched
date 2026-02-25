import {
  API_BASE,
  DEFAULT_MIN_COURSES_PER_SLOT,
  DEFAULT_MAX_COURSES_PER_SLOT,
  DEFAULT_MAX_SLOTS_PER_COURSE_PER_DAY,
  TIME_SLOTS,
  DAYS,
  getProgrammeColor,
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

// ── Shared helper: build lane layout for a day ──────────────────────────────

function buildBarsForDayFromTimetable(timetable, day) {
  const slots = timetable[day];
  if (!slots) return [];

  // Deduplicate courses by course_code for this day
  const courseMap = new Map();
  TIME_SLOTS.forEach((slot) => {
    const courses = slots[slot.id] || [];
    courses.forEach((course) => {
      if (!courseMap.has(course.course_code)) {
        courseMap.set(course.course_code, course);
      }
    });
  });

  const courses = Array.from(courseMap.values());
  const rawBars = courses
    .map((course) => {
      const startId = course.startSlot;
      const endId = course.endSlot;
      const startIndex = TIME_SLOTS.findIndex((s) => s.id === startId);
      let durationSlots = 2;

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
  const bars = [];
  const laneEnds = [];
  rawBars
    .sort((a, b) => a.startIndex - b.startIndex)
    .forEach((bar) => {
      let laneIndex = 0;
      while (
        laneIndex < laneEnds.length &&
        laneEnds[laneIndex] >= bar.startIndex
      ) {
        laneIndex += 1;
      }
      laneEnds[laneIndex] = bar.endIndex;
      bars.push({ ...bar, laneIndex });
    });

  return bars;
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

    // If day has no courses, render a single empty row
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
          // Course cell — spans its duration
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

          const cellStyle = isPdf
            ? `border:1px solid #ccc;padding:4px;vertical-align:middle;`
            : `border:1px solid #ccc;padding:4px;vertical-align:middle;`;

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
          // Empty cell
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

// ── Download PDF ──────────────────────────────────────────────────────────────

function downloadPDF() {
  if (!originalTimetable) {
    showNotification("Generate a timetable first.", "info");
    return;
  }

  const tableHTML = buildExportTableHTML(originalTimetable, "pdf");

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
    table { border-collapse: collapse; width: 100%; }
    td, th { word-break: break-word; overflow: hidden; }
    @media print {
      @page { size: landscape; margin: 8mm; }
      body  { margin: 0; }
    }
  </style>
</head>
<body>
  <h1>MyUniSched — Timetable</h1>
  <p>Generated on ${new Date().toLocaleString()}</p>
  ${tableHTML}
</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 600);
}

// ── Download Excel ────────────────────────────────────────────────────────────

function downloadExcel() {
  if (!originalTimetable) {
    showNotification("Generate a timetable first.", "info");
    return;
  }

  const tableHTML = buildExportTableHTML(originalTimetable, "excel");

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
  ${tableHTML}
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