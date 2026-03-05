import { initDrawer, closeDrawer } from "./drawer.js";
import {
  addCourse,
  loadCourses,
  populateLecturerDropdown,
  populateProgrammeDropdown,
  resetCourseForm,
} from "./course.js";

import { addLecturer, loadLecturers } from "./lecturer.js";
import { addProgramme, loadProgrammes } from "./programme.js";
import { initAuth, getCurrentUser, showNotification } from "./auth.js";

// Entity type labels for contextual empty-state messages
const ENTITY_LABELS = {
  course: { singular: "course", addLabel: "+ Add Course" },
  lecturer: { singular: "lecturer", addLabel: "+ Add Lecturer" },
  programme: { singular: "programme", addLabel: "+ Add Programme" },
};

function showLoginPrompt(activeList) {
  const target = activeList || document.querySelector(".myLecturer_list");
  if (!target) return;

  target.style.display = "flex";
  target.innerHTML = `
    <div class="schedule_empty entities_login_prompt">
      <i class="fa-solid fa-lock"></i>
      <p>Please <a href="#" class="loginPromptLink">log in</a> to view and manage your entities.</p>
    </div>`;
  target.querySelector(".loginPromptLink").addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector(".authModal.login")?.classList.add("active");
  });
}

// #15 — Contextual empty state when a list has no entities yet
function showEmptyState(listEl, entityType) {
  const label = ENTITY_LABELS[entityType] || { singular: entityType, addLabel: `+ Add ${entityType}` };
  listEl.innerHTML = `
    <div class="schedule_empty entities_empty_state">
      <i class="fa-solid fa-box-open"></i>
      <p>No ${label.singular}s yet — click <strong>${label.addLabel}</strong> to get started.</p>
    </div>`;
}

export { showEmptyState };

document.addEventListener("DOMContentLoaded", () => {
  initAuth();

  const user = getCurrentUser();

  // Always set up modal toggles and form handlers (they check auth internally)
  toggleAddEntitiesModal();
  addCourse();
  addLecturer();
  addProgramme();
  toggleEntity();
  toggleProgrammeLevelDropdown();
  toggleLecturerDropdown();
  toggleCourseProgrammeDropdown();
  toggleCourseDurationDropdown();
  initDrawer();
  initSearch();

  if (!user) {
    // Show login prompt inside the default (lecturer) list panel only
    showLoginPrompt(document.querySelector(".myLecturer_list"));
  } else {
    Promise.all([
      loadLecturers(),   // → lecturerCount
      loadProgrammes(),  // → programmeCount
      loadCourses(),     // → courseCount
    ]).then(([lecturerCount, programmeCount, courseCount]) =>
      updateEntityCards(lecturerCount, programmeCount, courseCount)
    );
  }
});

function toggleAddEntitiesModal() {
  const addCourseBtn = document.getElementById("addCourse");
  const addLecturerBtn = document.getElementById("addLecturer");
  const addProgrammeBtn = document.getElementById("addProgramme");

  const addCourseModal = document.querySelector(".addCourse_modal");
  const addLecturerModal = document.querySelector(".addLecturer_modal");
  const addProgrammeModal = document.querySelector(".addProgramme_modal");

  const addCourseCloseBtn = document.querySelector(".addCourse_close");
  const addLecturerCloseBtn = document.querySelector(".addLecturer_close");
  const addProgrammeCloseBtn = document.querySelector(".addProgramme_close");

  addCourseBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!getCurrentUser()) {
      showNotification("Please log in to add entities.", "info");
      return;
    }
    resetCourseForm();
    await populateLecturerDropdown();
    await populateProgrammeDropdown();
    openModal(addCourseModal);
  });

  addLecturerBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!getCurrentUser()) {
      showNotification("Please log in to add entities.", "info");
      return;
    }
    openModal(addLecturerModal);
  });
  addProgrammeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!getCurrentUser()) {
      showNotification("Please log in to add entities.", "info");
      return;
    }
    openModal(addProgrammeModal);
  });

  addCourseCloseBtn.addEventListener("click", () => closeModal(addCourseModal));
  addLecturerCloseBtn.addEventListener("click", () =>
    closeModal(addLecturerModal),
  );
  addProgrammeCloseBtn.addEventListener("click", () =>
    closeModal(addProgrammeModal),
  );

  window.addEventListener("click", (e) => {
    if (e.target === addCourseModal) closeModal(addCourseModal);
    if (e.target === addLecturerModal) closeModal(addLecturerModal);
    if (e.target === addProgrammeModal) closeModal(addProgrammeModal);
  });
}

export function openModal(modal) {
  modal.classList.add("active");
}

export function closeModal(modal) {
  modal.classList.remove("active");
}

function toggleEntity() {
  const courseBtn = document.querySelector(".courseBtn");
  const lecturerBtn = document.querySelector(".lecturerBtn");
  const programmeBtn = document.querySelector(".programmeBtn");

  const myCourse_list = document.querySelector(".myCourse_list");
  const myLecturer_list = document.querySelector(".myLecturer_list");
  const myProgramme_list = document.querySelector(".myProgramme_list");

  let currentView = "lecturer";

  function setActiveTab(activeBtn) {
    [courseBtn, lecturerBtn, programmeBtn].forEach((b) =>
      b.classList.remove("active"),
    );
    activeBtn.classList.add("active");
  }

  // Mark the default tab (lecturer) as active on load
  setActiveTab(lecturerBtn);

  courseBtn.addEventListener("click", () => {
    if (currentView === "course") return;
    currentView = "course";
    setActiveTab(courseBtn);
    myCourse_list.style.display = "flex";
    myLecturer_list.style.display = "none";
    myProgramme_list.style.display = "none";
    if (!getCurrentUser()) {
      showLoginPrompt(myCourse_list);
      return;
    }
    loadCourses().then(c => { updateEntityCards(null, null, c); applySearch(); });
  });

  lecturerBtn.addEventListener("click", () => {
    if (currentView === "lecturer") return;
    currentView = "lecturer";
    setActiveTab(lecturerBtn);
    myCourse_list.style.display = "none";
    myLecturer_list.style.display = "flex";
    myProgramme_list.style.display = "none";
    if (!getCurrentUser()) {
      showLoginPrompt(myLecturer_list);
      return;
    }
    loadLecturers().then(l => { updateEntityCards(l, null, null); applySearch(); });
  });

  programmeBtn.addEventListener("click", () => {
    if (currentView === "programme") return;
    currentView = "programme";
    setActiveTab(programmeBtn);
    myCourse_list.style.display = "none";
    myLecturer_list.style.display = "none";
    myProgramme_list.style.display = "flex";
    if (!getCurrentUser()) {
      showLoginPrompt(myProgramme_list);
      return;
    }
    loadProgrammes().then(p => { updateEntityCards(null, p, null); applySearch(); });
  });
}

function displayDetails_default() {
  const container = document.querySelector(".myEntities_details");
  container.classList.remove("course_details");
  container.innerHTML = "";

  const myEntities_title = document.createElement("h1");
  myEntities_title.classList.add("myEntities_noDetails_title");
  myEntities_title.textContent = "MyUniSched";
  container.appendChild(myEntities_title);

  const myEntities_desc = document.createElement("p");
  myEntities_desc.classList.add("myEntities_noDetails_desc");
  myEntities_desc.innerHTML =
    '"Click on any course/lecturer/programme<br>to view details"';
  container.appendChild(myEntities_desc);
}

// ── Shared dropdown initialiser (Bug #4 fix) ─────────────────────────────────
// Guards against double-registration with a data attribute flag.
function initDropdown(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container || container.dataset.dropdownInit) return;
  container.dataset.dropdownInit = "1";

  const selected = container.querySelector("[class$='_selected']");
  const list     = container.querySelector("[class$='_list']");
  if (!selected || !list) return;

  selected.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = list.classList.toggle("active");
    selected.style.borderColor = isOpen ? "#000" : "rgba(0,0,0,0.2)";
    selected.style.outline = "none";
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
  container._dropdownOutsideHandler = outsideHandler;
  document.addEventListener("click", outsideHandler);
}

function toggleProgrammeLevelDropdown() { initDropdown(".programmeLevel_container"); }
function toggleLecturerDropdown()        { initDropdown(".lecturerId_container"); }
function toggleCourseProgrammeDropdown() { initDropdown(".programmeName_container"); }
function toggleCourseDurationDropdown()  { initDropdown(".courseDuration_container"); }

export function updateEntityCards(lecturerCount, programmeCount, courseCount) {
  if (lecturerCount !== null && lecturerCount !== undefined) {
    const el = document.getElementById("entityCountLecturers");
    if (el) el.textContent = lecturerCount;
  }
  if (programmeCount !== null && programmeCount !== undefined) {
    const el = document.getElementById("entityCountProgrammes");
    if (el) el.textContent = programmeCount;
  }
  if (courseCount !== null && courseCount !== undefined) {
    const el = document.getElementById("entityCountCourses");
    if (el) el.textContent = courseCount;
  }
}

// ── Entity search ─────────────────────────────────────────
function getActiveList() {
  return [
    document.querySelector(".myLecturer_list"),
    document.querySelector(".myProgramme_list"),
    document.querySelector(".myCourse_list"),
  ].find((l) => l && l.style.display !== "none");
}

function showNoResultsIfNeeded() {
  const query = document.getElementById("entitySearchInput")?.value.trim() || "";
  const list = getActiveList();
  if (!list || !query) return;
  const cards = list.querySelectorAll(".myLecturer_card, .myProgramme_card, .myCourse_card");
  const visible = [...cards].filter(c => c.style.display !== "none").length;
  let noResults = list.querySelector(".entity_search_no_results");
  if (visible === 0 && cards.length > 0) {
    if (!noResults) {
      noResults = document.createElement("div");
      noResults.className = "entity_search_no_results schedule_empty";
      list.appendChild(noResults);
    }
    noResults.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i><p>No results for "<strong>${query}</strong>"</p>`;
    noResults.style.display = "";
  } else if (noResults) {
    noResults.style.display = "none";
  }
}

function applySearch() {
  const query = (document.getElementById("entitySearchInput")?.value || "").trim();
  const list = getActiveList();
  if (!list) return;
  list.querySelectorAll(".myLecturer_card, .myProgramme_card, .myCourse_card").forEach((card) => {
    card.style.display = (!query || card.textContent.toLowerCase().includes(query.toLowerCase())) ? "" : "none";
  });
  showNoResultsIfNeeded();
}

function initSearch() {
  const input = document.getElementById("entitySearchInput");
  const clearBtn = document.getElementById("entitySearchClear");
  if (!input) return;
  input.addEventListener("input", () => {
    clearBtn.style.display = input.value ? "flex" : "none";
    applySearch();
  });
  clearBtn.addEventListener("click", () => {
    input.value = "";
    clearBtn.style.display = "none";
    applySearch();
    input.focus();
  });
}