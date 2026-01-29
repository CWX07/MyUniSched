import { loadCourses } from "./course.js";
import { loadLecturers } from "./lecturer.js";

document.addEventListener("DOMContentLoaded", () => {
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

    loadCourses();
    toggleEntity();
});

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