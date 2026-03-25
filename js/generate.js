import {
  API_BASE,
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
import { buildExportTableHTML } from "./timetable_utils.js";
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
  showConfirm,
} from "./auth.js";

let originalTimetable = null;
let isSaved = true; // true = no unsaved generated timetable to warn about
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

  // ── Bug #7: Unsaved timetable warnings ──────────────────────────────────
  // 1. Browser refresh / tab close — native dialog (browsers require this)
  window.addEventListener("beforeunload", (e) => {
    if (!isSaved) {
      e.preventDefault();
      e.returnValue = ""; // required for Chrome to show the dialog
    }
  });

  // 2. In-app navigation via sidebar links — custom confirm dialog
  document.querySelectorAll(".sidebar_nav a").forEach((link) => {
    link.addEventListener("click", async (e) => {
      if (isSaved) return; // nothing to warn about
      e.preventDefault();
      const dest = link.href;
      const confirmed = await showConfirm(
        "You have an unsaved timetable.<br>Leave without saving?",
        "Leave",
        "Stay",
        "warn",
      );
      if (confirmed) {
        isSaved = true; // suppress beforeunload on the programmatic navigation
        window.location.href = dest;
      }
    });
  });

  onCourseUpdated(async () => {
    if (!originalTimetable) return;
    try {
      const res = await fetch(
        "/api/courses?uid=" + (getCurrentUser()?.uid ?? ""),
      );
      const courses = await res.json();
      const courseMap = {};
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

  initFilterDropdowns();

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
  const rawMin = parseInt(document.getElementById("minCoursesPerSlot").value);
  const rawMax = parseInt(document.getElementById("maxCoursesPerSlot").value);
  const rawMaxSlots = parseInt(
    document.getElementById("maxSlotsPerCoursePerDay").value,
  );

  // Use ?? so 0 is respected as a valid value (|| would replace 0 with the fallback)
  let min = isNaN(rawMin) ? 0 : rawMin;
  let max = isNaN(rawMax) ? 3 : rawMax;
  // maxSlotsPerCoursePerDay of 0 makes no sense (no course could ever be placed),
  // so clamp to a minimum of 1
  let maxSlotsPerCoursePerDay = isNaN(rawMaxSlots)
    ? DEFAULT_MAX_SLOTS_PER_COURSE_PER_DAY
    : Math.max(1, rawMaxSlots);

  if (min < 0) min = 0;
  if (max < 1) max = 1;
  if (max > 10) max = 10;
  if (min > max) {
    min = max;
    document.getElementById("minCoursesPerSlot").value = min;
  }
  // Reflect clamped value back to input so user sees what was actually applied
  document.getElementById("maxSlotsPerCoursePerDay").value =
    maxSlotsPerCoursePerDay;

  // Show tooltip briefly if the value was clamped up from < 1
  if (!isNaN(rawMaxSlots) && rawMaxSlots < 1) {
    const tip = document.getElementById("maxSlotsTip");
    if (tip) {
      clearTimeout(tip._hideTimer);
      tip.classList.add("visible");
      tip._hideTimer = setTimeout(() => tip.classList.remove("visible"), 2000);
    }
  }

  currentConstraints = {
    minCoursesPerSlot: min,
    maxCoursesPerSlot: max,
    maxSlotsPerCoursePerDay,
  };
}

function showLoadingOverlay() {
  document.getElementById("generateLoadingOverlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "generateLoadingOverlay";
  overlay.className = "generate_loading_overlay";
  overlay.innerHTML = `
    <div class="generate_loading_box">
      <div class="generate_spinner"></div>
      <p class="generate_loading_text">Generating timetable…</p>
    </div>`;
  document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
  document.getElementById("generateLoadingOverlay")?.remove();
}

async function generateTimetable() {
  const statusDiv = document.getElementById("timetableStatus");

  // Auth gate — must be logged in to generate
  const user = getCurrentUser();
  if (!user) {
    statusDiv.innerHTML =
      '<p class="status_error">Please <a href="#" class="status_login_link">log in</a> to generate a timetable.</p>';
    statusDiv
      .querySelector(".status_login_link")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelector(".authModal.login")?.classList.add("active");
      });
    return;
  }

  showLoadingOverlay();
  statusDiv.innerHTML = "";

  try {
    const res = await fetch("/api/courses?uid=" + user.uid);
    const courses = await res.json();

    if (courses.length === 0) {
      hideLoadingOverlay();
      statusDiv.innerHTML =
        '<p class="status_error">No courses found. Please <a href="./myEntities.html">add courses</a> first.</p>';
      return;
    }

    const timetable = generateSchedule(courses, currentConstraints);
    hideLoadingOverlay();

    if (timetable && !timetable.error) {
      originalTimetable = timetable;
      isSaved = false;
      displayTimetable(timetable);
      populateFilterValues(timetable);
      showActionButtons(true);
      statusDiv.innerHTML =
        '<p class="status_success">✓ Timetable generated successfully!</p>';
    } else {
      const result = timetable; // structured { error, course?, reasons[] } or null
      statusDiv.innerHTML = buildFailureMessage(result);
    }
  } catch (err) {
    hideLoadingOverlay();
    console.error(err);
    statusDiv.innerHTML =
      '<p class="status_error">Error generating timetable. Please try again.</p>';
  }
}

function buildFailureMessage(result) {
  if (!result) {
    return `<div class="status_error">
      <strong>Could not generate a conflict-free timetable.</strong>
      <span>Try adjusting your constraints or reducing the number of courses.</span>
    </div>`;
  }

  if (result.error === "unassignable") {
    const reasonItems = result.reasons.map((r) => `<li>${r}</li>`).join("");
    return `<div class="status_error">
      <strong>Could not place: "${result.course}"</strong>
      <ul class="status_reason_list">${reasonItems}</ul>
      <span class="status_hint">💡 Try raising Max Courses/Slot, lowering Max Slots/Day, or assigning a different lecturer.</span>
    </div>`;
  }

  if (result.error === "minCoursesPerSlot") {
    const reasonItems = result.reasons.map((r) => `<li>${r}</li>`).join("");
    return `<div class="status_error">
      <strong>Min Courses/Slot constraint could not be satisfied.</strong>
      <ul class="status_reason_list">${reasonItems}</ul>
    </div>`;
  }

  return `<div class="status_error"><strong>Generation failed.</strong> <span>Please try again.</span></div>`;
}

function showActionButtons(show) {
  const bar = document.getElementById("timetableActionBar");
  if (bar) bar.style.display = show ? "flex" : "none";
  // Stats bar visibility is owned by updateStatsBar (called inside displayTimetable)
  // and resetTimetable — not here, to avoid a visible gap between timetable and stats.
  if (!show) {
    const statsBar = document.getElementById("timetableStatsBar");
    if (statsBar) statsBar.style.display = "none";
  }
}

// ── Filter dropdowns ──────────────────────────────────────────────────────────

let activeFilters = []; // [{ type, value, label }]
let currentFilterType = "none";

const DAY_OPTIONS = [
  { value: "Monday", label: "Monday" },
  { value: "Tuesday", label: "Tuesday" },
  { value: "Wednesday", label: "Wednesday" },
  { value: "Thursday", label: "Thursday" },
  { value: "Friday", label: "Friday" },
];

function initFilterDropdowns() {
  setupCustomDropdown({
    containerId: "filterTypeSelected",
    listSelector: ".filterType_list",
    onSelect(value, label) {
      currentFilterType = value;
      // Reset value dropdown
      setValueDropdownLabel("—");
      document
        .getElementById("filterValueContainer")
        .classList.toggle("disabled", value === "none");
      populateFilterValues(originalTimetable);
    },
  });

  setupCustomDropdown({
    containerId: "filterValueSelected",
    listSelector: ".filterValue_list",
    onSelect(value, label) {
      if (currentFilterType === "none" || !value) return;
      addFilter(currentFilterType, value, label);
      // Reset value dropdown label back to "—" ready for next pick
      setValueDropdownLabel("—");
    },
  });
}

function setupCustomDropdown({ containerId, listSelector, onSelect }) {
  const selected = document.getElementById(containerId);
  const list =
    selected.closest("[class$='_container']")?.querySelector(listSelector) ||
    selected.parentElement.querySelector(listSelector);

  if (!selected || !list) return;

  selected.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = list.classList.toggle("active");
    selected.classList.toggle("open", isOpen);
  });

  list.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    const value = li.dataset.value;
    const label = li.textContent.trim();
    selected.querySelector("span").textContent = label;
    list.classList.remove("active");
    selected.classList.remove("open");
    onSelect(value, label);
  });

  document.addEventListener("click", () => {
    list.classList.remove("active");
    selected.classList.remove("open");
  });
}

function setValueDropdownLabel(text) {
  const span = document.querySelector("#filterValueSelected span");
  if (span) span.textContent = text;
}

function populateFilterValues(timetable) {
  const list = document.getElementById("filterValueList");
  if (!list) return;
  list.innerHTML = "";

  let items = [];
  if (currentFilterType === "programme" && timetable) {
    items = getUniqueCourses(timetable).map((p) => ({
      value: p.id,
      label: p.label,
    }));
  } else if (currentFilterType === "lecturer" && timetable) {
    items = getUniqueLecturers(timetable).map((l) => ({
      value: l.id,
      label: l.name,
    }));
  } else if (currentFilterType === "day") {
    items = DAY_OPTIONS;
  }

  items.forEach(({ value, label }) => {
    const li = document.createElement("li");
    li.dataset.value = value;
    const isActive = activeFilters.some(
      (f) => f.type === currentFilterType && f.value === value,
    );
    if (isActive) li.classList.add("selected");
    li.innerHTML = `${label}${isActive ? ' <i class="fa-solid fa-check filter_check"></i>' : ""}`;
    list.appendChild(li);
  });
}

function addFilter(type, value, label) {
  // Prevent duplicates
  if (activeFilters.some((f) => f.type === type && f.value === value)) return;
  activeFilters.push({ type, value, label });
  renderFilterTags();
  populateFilterValues(originalTimetable); // refresh ticks
  applyFilter();
}

function renderFilterTags() {
  const container = document.getElementById("filterTags");
  container.innerHTML = "";
  activeFilters.forEach(({ type, value, label }) => {
    const tag = document.createElement("div");
    tag.className = "filter_tag";
    tag.innerHTML = `<span>${label}</span><button class="filter_tag_remove"><i class="fa-solid fa-xmark"></i></button>`;
    tag.querySelector(".filter_tag_remove").addEventListener("click", () => {
      activeFilters = activeFilters.filter(
        (f) => !(f.type === type && f.value === value),
      );
      renderFilterTags();
      populateFilterValues(originalTimetable);
      applyFilter();
    });
    container.appendChild(tag);
  });
}

function applyFilter() {
  if (!originalTimetable) return;
  displayTimetable(filterTimetable(originalTimetable, activeFilters));
}

function resetFilters() {
  activeFilters = [];
  currentFilterType = "none";
  const typeSpan = document.querySelector("#filterTypeSelected span");
  if (typeSpan) typeSpan.textContent = "None";
  setValueDropdownLabel("—");
  document.getElementById("filterValueContainer")?.classList.add("disabled");
  document.getElementById("filterValueList").innerHTML = "";
  document.getElementById("filterTags").innerHTML = "";
}

function resetTimetable() {
  originalTimetable = null;
  isSaved = true;
  document.getElementById("timetableContainer").innerHTML =
    '<p class="no_timetable">Click "Generate Timetable" to create your schedule</p>';
  document.getElementById("timetableStatus").innerHTML = "";
  resetFilters();
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
    isSaved = true;
    showNotification(
      `Timetable "${name}" saved! View it in My Schedule.`,
      "success",
    );
  } catch (err) {
    showNotification("Error saving timetable: " + err.message, "error");
  }
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
    modal.classList.remove("active");
    resetCourseForm();
  });

  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
      resetCourseForm();
    }
  });

  toggleLecturerDropdown();
  toggleCourseProgrammeDropdown();
  toggleCourseDurationDropdown();
}

// ── Shared dropdown initialiser (Bug #4 fix) ─────────────────────────────────
// Uses a data attribute to guard against double-registration when the function
// is called more than once (e.g. modal re-open). The document click listener is
// stored on the container element so it can be removed before re-adding.
function initDropdown(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container || container.dataset.dropdownInit) return;
  container.dataset.dropdownInit = "1";

  const selected = container.querySelector("[class$='_selected']");
  const list = container.querySelector("[class$='_list']");
  if (!selected || !list) return;

  selected.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = list.classList.toggle("active");
    selected.style.borderColor = isOpen ? "#000" : "rgba(0,0,0,0.2)";
  });

  list.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    selected.textContent = li.textContent;
    selected.dataset.value = li.dataset.value;
    list.classList.remove("active");
    selected.style.borderColor = "rgba(0,0,0,0.2)";
  });

  const outsideHandler = (e) => {
    if (!container.contains(e.target)) {
      list.classList.remove("active");
      selected.style.borderColor = "rgba(0,0,0,0.2)";
    }
  };
  // Store so it's reachable if we ever need to remove it
  container._dropdownOutsideHandler = outsideHandler;
  document.addEventListener("click", outsideHandler);
}

function toggleLecturerDropdown() {
  initDropdown(".lecturerId_container");
}
function toggleCourseProgrammeDropdown() {
  initDropdown(".programmeName_container");
}
function toggleCourseDurationDropdown() {
  initDropdown(".courseDuration_container");
}