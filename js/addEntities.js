import { loadCourses } from "./course.js";
import { loadLecturers } from "./lecturer.js";

document.addEventListener("DOMContentLoaded", () => {
    toggleAddEntitiesModal();

    loadCourses();
    toggleEntity();

    toggleCourseProgrammeDropdown();
});

function toggleAddEntitiesModal() {
    const addCourseBtn = document.getElementById("addCourse");
    const addLecturerBtn = document.getElementById("addLecturer");

    const addCourseModal = document.querySelector(".addCourse_modal");
    const addLecturerModal = document.querySelector(".addLecturer_modal");

    const addCourseCloseBtn = document.querySelector(".addCourse_close");
    const addLecturerCloseBtn = document.querySelector(".addLecturer_close");

    addCourseBtn.addEventListener("click", () => {
        openModal(addCourseModal);
    });

    addLecturerBtn.addEventListener("click", () => {
        openModal(addLecturerModal);
    });

    addCourseCloseBtn.addEventListener("click", () => {
        closeModal(addCourseModal);
    });

    addLecturerCloseBtn.addEventListener("click", () => {
        closeModal(addLecturerModal);
    });

    window.addEventListener("click", (e) => {
        if (e.target === addCourseModal) closeModal(addCourseModal);
        if (e.target === addLecturerModal) closeModal(addLecturerModal);
    });
}

function openModal(modal) {
    modal.style.opacity = "1";
    modal.style.zIndex = "100";
}

function closeModal(modal) {
    modal.style.opacity = "0";
    modal.style.zIndex = "-100";
}

function toggleEntity() {
    const courseBtn = document.querySelector(".courseBtn");
    const lecturerBtn = document.querySelector(".lecturerBtn");

    const myCourse_list = document.querySelector(".myCourse_list");
    const myLecturer_list = document.querySelector(".myLecturer_list");

    let isCourse = true;

    courseBtn.addEventListener("click", () => {
        if(!isCourse) {
            displayDetails_default();
            myCourse_list.style.display = "flex";
            myLecturer_list.style.display = "none";
            loadCourses();

            isCourse = true;
        }

        console.log("Course button clicked");
    });

    lecturerBtn.addEventListener("click", () => {
        if(isCourse) {
            displayDetails_default();
            myCourse_list.style.display = "none";
            myLecturer_list.style.display = "flex";
            loadLecturers();

            isCourse = false;
        }

        console.log("Lecturer button clicked");
    });
}

function displayDetails_default() {
    const container = document.querySelector(".myEntities_details");
    container.innerHTML = "";

    const myEntities_title = document.createElement("h1");
    myEntities_title.classList.add("myEntities_noDetails_title");
    myEntities_title.textContent = "MyUniSched";

    container.appendChild(myEntities_title);

    const myEntities_desc = document.createElement("p");
    myEntities_desc.classList.add("myEntities_noDetails_desc");
    myEntities_desc.textContent = "\"Click on any course/lecturer to view details\"";

    container.appendChild(myEntities_desc);
}

function toggleCourseProgrammeDropdown() {
    const programmeNameContainer = document.querySelector(".programmeName_container");
    const programmeNameSelected = programmeNameContainer.querySelector(".programmeName_selected");
    const programmeNameList = programmeNameContainer.querySelector(".programmeName_list");
    const programmeNameOptions = programmeNameList.querySelectorAll("li");

    programmeNameSelected.addEventListener("click", () => {
        const isActive = programmeNameList.classList.toggle("active");
        programmeNameSelected.style.borderColor = isActive ? "#000" : "rgba(0,0,0,0.2)";
        programmeNameSelected.style.outline = "none";
    });

    programmeNameOptions.forEach(option => {
        option.addEventListener("click", () => {
            programmeNameSelected.textContent = option.textContent;
            programmeNameSelected.dataset.value = option.dataset.value;
            programmeNameList.classList.remove("active");
            programmeNameSelected.style.borderColor = "rgba(0,0,0,0.2)";
        });
    });

    document.addEventListener("click", (e) => {
        if (!programmeNameContainer.contains(e.target)) {
            programmeNameList.classList.remove("active");
            programmeNameSelected.style.borderColor = "rgba(0,0,0,0.2)";
        }
    });
}