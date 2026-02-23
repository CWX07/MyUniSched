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



function showLoginPrompt(activeList) {
  // Default to lecturer list if no list specified
  const target = activeList || document.querySelector(".myLecturer_list");

  if (!target) return;

  // Replace only the active list's content with the login prompt
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

  if (!user) {
    // Show login prompt inside the default (lecturer) list panel only
    showLoginPrompt(document.querySelector(".myLecturer_list"));
  } else {
    loadLecturers();
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

export async function openModal(modal) {
  modal.style.opacity = "1";
  modal.style.zIndex = "300";
}

export async function closeModal(modal) {
  modal.style.opacity = "0";
  modal.style.zIndex = "-100";
}

function toggleEntity() {
  const courseBtn = document.querySelector(".courseBtn");
  const lecturerBtn = document.querySelector(".lecturerBtn");
  const programmeBtn = document.querySelector(".programmeBtn");

  const myCourse_list = document.querySelector(".myCourse_list");
  const myLecturer_list = document.querySelector(".myLecturer_list");
  const myProgramme_list = document.querySelector(".myProgramme_list");

  let currentView = "lecturer";

  courseBtn.addEventListener("click", () => {
    if (currentView === "course") return;
    currentView = "course";
    myCourse_list.style.display = "flex";
    myLecturer_list.style.display = "none";
    myProgramme_list.style.display = "none";
    if (!getCurrentUser()) {
      showLoginPrompt(myCourse_list);
      return;
    }
    displayDetails_default();
    loadCourses();
  });

  lecturerBtn.addEventListener("click", () => {
    if (currentView === "lecturer") return;
    currentView = "lecturer";
    myCourse_list.style.display = "none";
    myLecturer_list.style.display = "flex";
    myProgramme_list.style.display = "none";
    if (!getCurrentUser()) {
      showLoginPrompt(myLecturer_list);
      return;
    }
    displayDetails_default();
    loadLecturers();
  });

  programmeBtn.addEventListener("click", () => {
    if (currentView === "programme") return;
    currentView = "programme";
    myCourse_list.style.display = "none";
    myLecturer_list.style.display = "none";
    myProgramme_list.style.display = "flex";
    if (!getCurrentUser()) {
      showLoginPrompt(myProgramme_list);
      return;
    }
    displayDetails_default();
    loadProgrammes();
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

function toggleProgrammeLevelDropdown() {
  const programmeLevelContainer = document.querySelector(
    ".programmeLevel_container",
  );
  if (!programmeLevelContainer) return;

  const programmeLevelSelected = programmeLevelContainer.querySelector(
    ".programmeLevel_selected",
  );
  const programmeLevelList = programmeLevelContainer.querySelector(
    ".programmeLevel_list",
  );

  programmeLevelSelected.addEventListener("click", () => {
    const isActive = programmeLevelList.classList.toggle("active");
    programmeLevelSelected.style.borderColor = isActive
      ? "#000"
      : "rgba(0,0,0,0.2)";
    programmeLevelSelected.style.outline = "none";
  });

  programmeLevelList.querySelectorAll("li").forEach((option) => {
    option.addEventListener("click", () => {
      programmeLevelSelected.textContent = option.textContent;
      programmeLevelSelected.dataset.value = option.dataset.value;
      programmeLevelList.classList.remove("active");
      programmeLevelSelected.style.borderColor = "rgba(0,0,0,0.2)";
    });
  });

  document.addEventListener("click", (e) => {
    if (!programmeLevelContainer.contains(e.target)) {
      programmeLevelList.classList.remove("active");
      programmeLevelSelected.style.borderColor = "rgba(0,0,0,0.2)";
    }
  });
}

function toggleLecturerDropdown() {
  const lecturerContainer = document.querySelector(".lecturerId_container");
  if (!lecturerContainer) return;

  const lecturerSelected = lecturerContainer.querySelector(
    ".lecturerId_selected",
  );
  const lecturerList = lecturerContainer.querySelector(".lecturerId_list");

  lecturerSelected.addEventListener("click", () => {
    const isActive = lecturerList.classList.toggle("active");
    lecturerSelected.style.borderColor = isActive ? "#000" : "rgba(0,0,0,0.2)";
    lecturerSelected.style.outline = "none";
  });

  lecturerList.addEventListener("click", (e) => {
    if (e.target.tagName === "LI") {
      lecturerSelected.textContent = e.target.textContent;
      lecturerSelected.dataset.value = e.target.dataset.value;
      lecturerList.classList.remove("active");
      lecturerSelected.style.borderColor = "rgba(0,0,0,0.2)";
    }
  });

  document.addEventListener("click", (e) => {
    if (!lecturerContainer.contains(e.target)) {
      lecturerList.classList.remove("active");
      lecturerSelected.style.borderColor = "rgba(0,0,0,0.2)";
    }
  });
}

function toggleCourseProgrammeDropdown() {
  const programmeNameContainer = document.querySelector(
    ".programmeName_container",
  );
  if (!programmeNameContainer) return;

  const programmeNameSelected = programmeNameContainer.querySelector(
    ".programmeName_selected",
  );
  const programmeNameList = programmeNameContainer.querySelector(
    ".programmeName_list",
  );

  programmeNameSelected.addEventListener("click", () => {
    const isActive = programmeNameList.classList.toggle("active");
    programmeNameSelected.style.borderColor = isActive
      ? "#000"
      : "rgba(0,0,0,0.2)";
    programmeNameSelected.style.outline = "none";
  });

  programmeNameList.addEventListener("click", (e) => {
    if (e.target.tagName === "LI") {
      programmeNameSelected.textContent = e.target.textContent;
      programmeNameSelected.dataset.value = e.target.dataset.value;
      programmeNameList.classList.remove("active");
      programmeNameSelected.style.borderColor = "rgba(0,0,0,0.2)";
    }
  });

  document.addEventListener("click", (e) => {
    if (!programmeNameContainer.contains(e.target)) {
      programmeNameList.classList.remove("active");
      programmeNameSelected.style.borderColor = "rgba(0,0,0,0.2)";
    }
  });
}

function toggleCourseDurationDropdown() {
  const durationContainer = document.querySelector(".courseDuration_container");
  if (!durationContainer) return;

  const durationSelected = durationContainer.querySelector(
    ".courseDuration_selected",
  );
  const durationList = durationContainer.querySelector(".courseDuration_list");

  durationSelected.addEventListener("click", () => {
    const isActive = durationList.classList.toggle("active");
    durationSelected.style.borderColor = isActive ? "#000" : "rgba(0,0,0,0.2)";
    durationSelected.style.outline = "none";
  });

  durationList.addEventListener("click", (e) => {
    if (e.target.tagName === "LI") {
      durationSelected.textContent = e.target.textContent;
      durationSelected.dataset.value = e.target.dataset.value;
      durationList.classList.remove("active");
      durationSelected.style.borderColor = "rgba(0,0,0,0.2)";
    }
  });

  document.addEventListener("click", (e) => {
    if (!durationContainer.contains(e.target)) {
      durationList.classList.remove("active");
      durationSelected.style.borderColor = "rgba(0,0,0,0.2)";
    }
  });
}