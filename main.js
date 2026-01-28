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
});

function openModal(modal) {
    modal.style.opacity = "1";
    modal.style.zIndex = "100";
}

function closeModal(modal) {
    modal.style.opacity = "0";
    modal.style.zIndex = "-100";
}