import {
  DEFAULT_MIN_COURSES_PER_SLOT,
  DEFAULT_MAX_COURSES_PER_SLOT,
  DEFAULT_MAX_SLOTS_PER_COURSE_PER_DAY,
} from "./config.js";
import { generateSchedule } from "./scheduler.js";
import { filterTimetable, getUniqueCourses, getUniqueLecturers } from "./filters.js";
import { displayTimetable } from "./generate_ui.js";
import { addCourse, resetCourseForm, populateLecturerDropdown, populateProgrammeDropdown, onCourseUpdated } from "./course.js";

// Store the original timetable for filtering
let originalTimetable = null;
let currentConstraints = {
  minCoursesPerSlot: DEFAULT_MIN_COURSES_PER_SLOT,
  maxCoursesPerSlot: DEFAULT_MAX_COURSES_PER_SLOT,
  maxSlotsPerCoursePerDay: DEFAULT_MAX_SLOTS_PER_COURSE_PER_DAY,
};

document.addEventListener("DOMContentLoaded", () => {
  initializeEventListeners();
  initializeConstraints();
  initCourseModal();

  // Re-patch timetable with fresh data after any course edit
  onCourseUpdated(async () => {
    if (!originalTimetable) return;
    try {
      const res = await fetch("/api/courses");
      const courses = await res.json();
      const { DAYS, TIME_SLOTS } = await import("./config.js");
      const courseMap = {};
      courses.forEach(c => { courseMap[c.course_code] = c; });
      DAYS.forEach(day => {
        TIME_SLOTS.forEach(slot => {
          originalTimetable[day][slot.id] = originalTimetable[day][slot.id].map(c => {
            const fresh = courseMap[c.course_code];
            return fresh ? { ...c, ...fresh } : c;
          });
        });
      });
      displayTimetable(originalTimetable);
    } catch (err) {
      console.error("Failed to refresh timetable:", err);
    }
  });
});

function initializeEventListeners() {
  const generateBtn = document.getElementById("generateBtn");
  const resetBtn = document.getElementById("resetBtn");
  const minCoursesInput = document.getElementById("minCoursesPerSlot");
  const maxCoursesInput = document.getElementById("maxCoursesPerSlot");
  const maxSlotsPerCourseInput = document.getElementById(
    "maxSlotsPerCoursePerDay",
  );
  const filterTypeSelect = document.getElementById("filterType");
  const filterValueSelect = document.getElementById("filterValue");

  generateBtn.addEventListener("click", generateTimetable);
  resetBtn.addEventListener("click", resetTimetable);

  minCoursesInput.addEventListener("change", updateConstraints);
  maxCoursesInput.addEventListener("change", updateConstraints);
  maxSlotsPerCourseInput.addEventListener("change", updateConstraints);

  filterTypeSelect.addEventListener("change", handleFilterTypeChange);
  filterValueSelect.addEventListener("change", applyFilter);
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
  const minInput = document.getElementById("minCoursesPerSlot");
  const maxInput = document.getElementById("maxCoursesPerSlot");
  const maxSlotsPerCourseInput = document.getElementById(
    "maxSlotsPerCoursePerDay",
  );

  let min = parseInt(minInput.value) || 0;
  let max = parseInt(maxInput.value) || 3;
  let maxSlotsPerCoursePerDay =
    parseInt(maxSlotsPerCourseInput.value) ||
    DEFAULT_MAX_SLOTS_PER_COURSE_PER_DAY;

  // Validate constraints
  if (min < 0) min = 0;
  if (max > 10) max = 10;
  if (min > max) {
    min = max;
    minInput.value = min;
  }

  currentConstraints.minCoursesPerSlot = min;
  currentConstraints.maxCoursesPerSlot = max;
  currentConstraints.maxSlotsPerCoursePerDay = maxSlotsPerCoursePerDay;
}

async function generateTimetable() {
  const statusDiv = document.getElementById("timetableStatus");
  statusDiv.innerHTML = '<p class="status_loading">Generating timetable...</p>';

  try {
    // Fetch courses from API
    const res = await fetch("/api/courses");
    const courses = await res.json();

    if (courses.length === 0) {
      statusDiv.innerHTML =
        '<p class="status_error">No courses found. Please add courses first.</p>';
      return;
    }

    // Generate timetable with constraints
    const timetable = generateSchedule(courses, currentConstraints);

    if (timetable) {
      originalTimetable = timetable;
      displayTimetable(timetable);
      populateFilterOptions(timetable);
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

function populateFilterOptions(timetable) {
  const filterValueSelect = document.getElementById("filterValue");
  const filterType = document.getElementById("filterType").value;

  // Clear existing options
  filterValueSelect.innerHTML = '<option value="all">All</option>';

  if (filterType === "course") {
    const programmes = getUniqueCourses(timetable);
    programmes.forEach((programme) => {
      const option = document.createElement("option");
      option.value = programme.id;
      option.textContent = programme.label;
      filterValueSelect.appendChild(option);
    });
  } else if (filterType === "lecturer") {
    const lecturers = getUniqueLecturers(timetable);
    lecturers.forEach((lecturer) => {
      const option = document.createElement("option");
      option.value = lecturer.id;
      option.textContent = lecturer.name;
      filterValueSelect.appendChild(option);
    });
  }

  filterValueSelect.disabled = false;
}

function handleFilterTypeChange() {
  const filterValueSelect = document.getElementById("filterValue");
  filterValueSelect.value = "all";

  if (originalTimetable) {
    populateFilterOptions(originalTimetable);
    displayTimetable(originalTimetable);
  }
}

function applyFilter() {
  if (!originalTimetable) return;

  const filterType = document.getElementById("filterType").value;
  const filterValue = document.getElementById("filterValue").value;

  const filteredTimetable = filterTimetable(originalTimetable, {
    filterType,
    filterValue,
  });

  displayTimetable(filteredTimetable);
}

function resetTimetable() {
  originalTimetable = null;

  const container = document.getElementById("timetableContainer");
  container.innerHTML =
    '<p class="no_timetable">Click "Generate Timetable" to create your schedule</p>';

  const statusDiv = document.getElementById("timetableStatus");
  statusDiv.innerHTML = "";

  // Reset filters
  document.getElementById("filterType").value = "none";
  document.getElementById("filterValue").innerHTML =
    '<option value="all">All</option>';
  document.getElementById("filterValue").disabled = true;

  // Reset constraints to default
  initializeConstraints();
  currentConstraints = {
    minCoursesPerSlot: DEFAULT_MIN_COURSES_PER_SLOT,
    maxCoursesPerSlot: DEFAULT_MAX_COURSES_PER_SLOT,
    maxSlotsPerCoursePerDay: DEFAULT_MAX_SLOTS_PER_COURSE_PER_DAY,
  };
}

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
    const active = list.classList.toggle("active");
    selected.style.borderColor = active ? "#000" : "rgba(0,0,0,0.2)";
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
    const active = list.classList.toggle("active");
    selected.style.borderColor = active ? "#000" : "rgba(0,0,0,0.2)";
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
    const active = list.classList.toggle("active");
    selected.style.borderColor = active ? "#000" : "rgba(0,0,0,0.2)";
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