import { getProgrammeColor } from "./config.js";

let isEditMode = false;
let currentEditCourseCode = null;

export async function addCourse() {
  // Add course details through modal form
  const form = document.querySelector(".addCourse_modal_content_form");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const courseName = document.getElementById("courseName").value;

    const lecturerElement = document.getElementById("lecturerId_course");
    const lecturerId = lecturerElement.dataset.value;

    const programmeElement = document.getElementById("programmeName");
    const programmeId = programmeElement.dataset.value;

    if (!lecturerId) {
      alert("Please select a lecturer");
      return;
    }

    if (!programmeId) {
      alert("Please select a programme");
      return;
    }

    try {
      let res, result;

      if (isEditMode && currentEditCourseCode) {
        // UPDATE existing course
        const editedCourseCode = currentEditCourseCode;
        res = await fetch(`/api/courses/${currentEditCourseCode}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseName, lecturerId, programmeId }),
        });

        result = await res.json();

        if (!res.ok) {
          alert(result.error);
        } else {
          alert("Course updated successfully");
          resetCourseForm();
          const modal = document.querySelector(".addCourse_modal");
          const { closeModal } = await import("./addEntities.js");
          closeModal(modal);
          await loadCourses();
          await displayCourseDetails(editedCourseCode);
        }
      } else {
        // CREATE new course
        res = await fetch("/api/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseName, lecturerId, programmeId }),
        });

        result = await res.json();

        if (!res.ok) {
          alert(result.error);
        } else {
          alert(`Course added successfully with code: ${result.course_code}`);
          resetCourseForm();
        }
        await loadCourses();
      }
    } catch (err) {
      alert("Network error");
    }
  });
}

function resetCourseForm() {
  const form = document.querySelector(".addCourse_modal_content_form");
  form.reset();

  const lecturerElement = document.getElementById("lecturerId_course");
  lecturerElement.textContent = "Select lecturer";
  delete lecturerElement.dataset.value;

  const programmeElement = document.getElementById("programmeName");
  programmeElement.textContent = "Select programme";
  delete programmeElement.dataset.value;

  // Reset to add mode
  isEditMode = false;
  currentEditCourseCode = null;

  // Update modal title and button text
  const modalTitle = document.querySelector(".addCourse_modal_content h2");
  modalTitle.textContent = "Add Course";

  const submitBtn = document.querySelector(".addCourse_submit_btn");
  submitBtn.textContent = "Add Course";
}

export async function editCourse(courseCode) {
  isEditMode = true;
  currentEditCourseCode = courseCode;

  // Fetch course details and populate form
  try {
    const res = await fetch("/api/courses");
    const data = await res.json();
    const course = data.find((c) => c.course_code === courseCode);

    if (course) {
      // Update modal title and button
      const modalTitle = document.querySelector(".addCourse_modal_content h2");
      modalTitle.textContent = "Edit Course";

      const submitBtn = document.querySelector(".addCourse_submit_btn");
      submitBtn.textContent = "Update Course";

      // Populate form fields
      document.getElementById("courseName").value = course.course_name;

      // Set lecturer dropdown
      const lecturerElement = document.getElementById("lecturerId_course");
      lecturerElement.textContent = `${course.lecturer_id} - ${course.lecturer_name}`;
      lecturerElement.dataset.value = course.lecturer_id;

      // Set programme dropdown
      const programmeElement = document.getElementById("programmeName");
      programmeElement.textContent = `${course.programme_id} - ${course.programme_level} in ${course.programme_name} Year ${course.programme_year}`;
      programmeElement.dataset.value = course.programme_id;

      // Populate dropdowns
      await populateLecturerDropdown();
      await populateProgrammeDropdown();

      // Open modal
      const modal = document.querySelector(".addCourse_modal");
      const { openModal } = await import("./addEntities.js");
      openModal(modal);
    }
  } catch (err) {
    alert("Error loading course details");
  }
}

// Populate lecturer dropdown
export async function populateLecturerDropdown() {
  try {
    const res = await fetch("/api/lecturers");
    const lecturers = await res.json();

    const lecturerList = document.querySelector(".lecturerId_list");
    lecturerList.innerHTML = "";

    lecturers.forEach((lecturer) => {
      const li = document.createElement("li");
      li.textContent = `${lecturer.lecturer_id} - ${lecturer.lecturer_name}`;
      li.dataset.value = lecturer.lecturer_id;
      lecturerList.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading lecturers:", err);
  }
}

// Populate programme dropdown
export async function populateProgrammeDropdown() {
  try {
    const res = await fetch("/api/programmes");
    const programmes = await res.json();

    const programmeList = document.querySelector(".programmeName_list");
    programmeList.innerHTML = "";

    programmes.forEach((programme) => {
      const li = document.createElement("li");
      li.textContent = `${programme.programme_id} - ${programme.programme_level} in ${programme.programme_name} Year ${programme.programme_year}`;
      li.dataset.value = programme.programme_id;
      programmeList.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading programmes:", err);
  }
}

// Load and display courses
export async function loadCourses() {
  const res = await fetch("/api/courses");
  const data = await res.json();

  const list = document.querySelector(".myCourse_list");
  list.innerHTML = "";

  // Sort courses: programme level -> programme name -> year -> course name
  const levelOrder = ["Foundation", "Diploma", "Degree", "Master", "PhD"];

  data
    .slice()
    .sort((a, b) => {
      const levelDiff =
        levelOrder.indexOf(a.programme_level) -
        levelOrder.indexOf(b.programme_level);
      if (levelDiff !== 0) return levelDiff;

      const progNameDiff = a.programme_name.localeCompare(b.programme_name);
      if (progNameDiff !== 0) return progNameDiff;

      const yearDiff =
        Number(a.programme_year) - Number(b.programme_year);
      if (yearDiff !== 0) return yearDiff;

      return a.course_name.localeCompare(b.course_name);
    })
    .forEach((c) => {
    // Create card
    const card = document.createElement("div");
    card.className = "myCourse_card";

    // Apply color-coded left border based on programme
    const color = getProgrammeColor(
      c.programme_level,
      c.programme_name,
      c.programme_year
    );
    card.style.borderLeft = `4px solid ${color}`;

    // displayItem1 <-- Course Code
    const displayId = document.createElement("div");
    displayId.className = "displayItem1";
    displayId.textContent = c.course_code;

    // displayItem2 <-- Course Name
    const displayName = document.createElement("div");
    displayName.className = "displayItem2";
    displayName.textContent = c.course_name;

    // viewEntity_btn
    const btn = document.createElement("button");
    btn.className = "viewEntity_btn";
    btn.innerHTML = "&#9881;";

    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent card click from firing
      editCourse(c.course_code);
    });

    // Store course code for later use
    card.dataset.courseId = c.course_code;

    // Add click event to show details
    card.addEventListener("click", () => {
      const courseId = card.dataset.courseId;
      displayCourseDetails(courseId);
    });

    card.appendChild(displayId);
    card.appendChild(displayName);
    card.appendChild(btn);

    list.appendChild(card);
  });
}

async function displayCourseDetails(courseId) {
  const res = await fetch("/api/courses");
  const data = await res.json();

  const course = data.find((c) => c.course_code === courseId);

  if (!course) {
    console.error("Course not found:", courseId);
    return;
  }

  const container = document.querySelector(".myEntities_details");
  container.classList.add("course_details");
  container.innerHTML = "";

  const title = document.createElement("h1");
  title.textContent = "Course Details";
  container.appendChild(title);

  function createDetail(label, value) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("courseDetails");

    const titleDiv = document.createElement("div");
    titleDiv.classList.add("courseDetails_title");

    const h3 = document.createElement("h3");
    h3.textContent = label;

    const colon = document.createElement("span");
    colon.textContent = ":";

    titleDiv.appendChild(h3);
    titleDiv.appendChild(colon);

    const ans = document.createElement("div");
    ans.classList.add("courseDetailsAns");
    ans.textContent = value || "N/A";

    wrapper.appendChild(titleDiv);
    wrapper.appendChild(ans);

    return wrapper;
  }

  // Use snake_case property names from API response
  container.appendChild(createDetail("Course Code", course.course_code));
  container.appendChild(createDetail("Course Name", course.course_name));
  container.appendChild(createDetail("Lecturer ID", course.lecturer_id));
  container.appendChild(createDetail("Lecturer Name", course.lecturer_name));
  container.appendChild(createDetail("Programme ID", course.programme_id));
  container.appendChild(createDetail("Programme Name", course.programme_name));
  container.appendChild(
    createDetail("Programme Level", course.programme_level),
  );
  container.appendChild(createDetail("Programme Year", course.programme_year));
}