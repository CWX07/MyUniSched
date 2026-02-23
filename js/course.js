import { API_BASE, getProgrammeColor } from "./config.js";
import { getCurrentUser, showNotification, showConfirm } from "./auth.js";

function getUid() {
  const user = getCurrentUser();
  return user ? user.uid : null;
}

let isEditMode = false;
let currentEditCourseCode = null;

// Callback registry — other modules (e.g. generate.js) can register
// a function to be called after a course is successfully updated.
const courseUpdatedCallbacks = [];
export function onCourseUpdated(fn) {
  courseUpdatedCallbacks.push(fn);
}
function fireCourseUpdated(courseCode) {
  courseUpdatedCallbacks.forEach((fn) => fn(courseCode));
}

export async function addCourse() {
  // Add course details through modal form
  const form = document.querySelector(".addCourse_modal_content_form");
  const deleteBtn = document.querySelector(".deleteCourse_btn");

  if (deleteBtn) {
    deleteBtn.style.display = "none";

    deleteBtn.addEventListener("click", async () => {
      if (!isEditMode || !currentEditCourseCode) return;

      const confirmed = await showConfirm(
        "Are you sure you want to delete this course?",
        "Delete Course",
      );
      if (!confirmed) return;

      try {
        const res = await fetch(
          `${API_BASE}/api/courses/${currentEditCourseCode}?uid=${getUid()}`,
          { method: "DELETE" },
        );
        const result = await res.json();

        if (!res.ok) {
          showNotification(result.error || "Failed to delete course", "error");
          return;
        }

        showNotification("Course deleted successfully", "success");
        resetCourseForm();
        const modal = document.querySelector(".addCourse_modal");
        const { closeModal } = await import("./addEntities.js");
        closeModal(modal);
        await loadCourses();
      } catch (err) {
        showNotification("Error deleting course", "error");
      }
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const courseName = document.getElementById("courseName").value;
    const durationElement = document.getElementById("courseDuration");
    const durationHours = Number(durationElement.dataset.value || "2") || 2;

    const lecturerElement = document.getElementById("lecturerId_course");
    const lecturerId = lecturerElement.dataset.value;

    const programmeElement = document.getElementById("programmeName");
    const programmeId = programmeElement.dataset.value;

    if (!lecturerId) {
      showNotification("Please select a lecturer", "error");
      return;
    }

    if (!programmeId) {
      showNotification("Please select a programme", "error");
      return;
    }

    // Debug: log payload before sending
    console.log("[Add/Update Course] Payload:", {
      mode: isEditMode ? "edit" : "add",
      courseName,
      lecturerId,
      programmeId,
      durationHours,
    });

    try {
      let res, result;

      if (isEditMode && currentEditCourseCode) {
        // UPDATE existing course
        const editedCourseCode = currentEditCourseCode;
        res = await fetch(
          `${API_BASE}/api/courses/${currentEditCourseCode}?uid=${getUid()}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              courseName,
              lecturerId,
              programmeId,
              durationHours,
            }),
          },
        );

        result = await res.json();

        if (!res.ok) {
          showNotification(result.error, "error");
        } else {
          showNotification("Course updated successfully", "success");
          resetCourseForm();
          const modal = document.querySelector(".addCourse_modal");
          modal.style.opacity = "0";
          modal.style.zIndex = "-100";
          // Only refresh the course list if we're on the My Entities page
          const courseList = document.querySelector(".myCourse_list");
          if (courseList) {
            await loadCourses();
            await displayCourseDetails(editedCourseCode);
          }
          // Notify any registered listeners (e.g. generate page timetable refresh)
          fireCourseUpdated(editedCourseCode);
        }
      } else {
        // CREATE new course
        res = await fetch(`${API_BASE}/api/courses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseName,
            lecturerId,
            programmeId,
            durationHours,
            uid: getUid(),
          }),
        });

        result = await res.json();

        if (!res.ok) {
          showNotification(result.error, "error");
        } else {
          showNotification(
            `Course added successfully with code: ${result.course_code}`,
            "success",
          );
          resetCourseForm();
        }
        await loadCourses();
      }
    } catch (err) {
      showNotification("Network error", "error");
    }
  });
}

export function resetCourseForm() {
  const form = document.querySelector(".addCourse_modal_content_form");
  form.reset();

  const lecturerElement = document.getElementById("lecturerId_course");
  lecturerElement.textContent = "Select lecturer";
  delete lecturerElement.dataset.value;

  const programmeElement = document.getElementById("programmeName");
  programmeElement.textContent = "Select programme";
  delete programmeElement.dataset.value;

  const durationElement = document.getElementById("courseDuration");
  if (durationElement) {
    durationElement.textContent = "2 hours";
    durationElement.dataset.value = "2";
  }

  // Reset to add mode
  isEditMode = false;
  currentEditCourseCode = null;

  // Update modal title and button text
  const modalTitle = document.querySelector(".addCourse_modal_content h2");
  modalTitle.textContent = "Add Course";

  const submitBtn = document.querySelector(".addCourse_submit_btn");
  submitBtn.textContent = "Add Course";

  const deleteBtn = document.querySelector(".deleteCourse_btn");
  if (deleteBtn) {
    deleteBtn.style.display = "none";
  }
}

export async function editCourse(courseCode) {
  isEditMode = true;
  currentEditCourseCode = courseCode;

  // Fetch course details and populate form
  try {
    const res = await fetch(`${API_BASE}/api/courses?uid=${getUid()}`);
    const data = await res.json();
    const course = data.find((c) => c.course_code === courseCode);

    if (course) {
      // Update modal title and button
      const modalTitle = document.querySelector(".addCourse_modal_content h2");
      modalTitle.textContent = "Edit Course";

      const submitBtn = document.querySelector(".addCourse_submit_btn");
      submitBtn.textContent = "Update Course";

      const deleteBtn = document.querySelector(".deleteCourse_btn");
      if (deleteBtn) {
        deleteBtn.style.display = "inline-flex";
      }

      // Populate form fields
      document.getElementById("courseName").value = course.course_name;

      const durationElement = document.getElementById("courseDuration");
      if (durationElement) {
        const dur = String(course.duration_hours || 2);
        durationElement.dataset.value = dur;
        durationElement.textContent = dur === "1" ? "1 hour" : `${dur} hours`;
      }

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
    showNotification("Error loading course details", "error");
  }
}

// Populate lecturer dropdown
export async function populateLecturerDropdown() {
  try {
    const res = await fetch(`${API_BASE}/api/lecturers?uid=${getUid()}`);
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
    const res = await fetch(`${API_BASE}/api/programmes?uid=${getUid()}`);
    const programmes = await res.json();

    const programmeList = document.querySelector(".programmeName_list");
    programmeList.innerHTML = "";

    // Sort to match legend/My Entities order:
    // level -> programme name -> year
    const levelOrder = ["Foundation", "Diploma", "Degree", "Master", "PhD"];

    programmes
      .slice()
      .sort((a, b) => {
        const levelDiff =
          levelOrder.indexOf(a.programme_level) -
          levelOrder.indexOf(b.programme_level);
        if (levelDiff !== 0) return levelDiff;

        const nameDiff = a.programme_name.localeCompare(b.programme_name);
        if (nameDiff !== 0) return nameDiff;

        return Number(a.programme_year) - Number(b.programme_year);
      })
      .forEach((programme) => {
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
  const res = await fetch(`${API_BASE}/api/courses?uid=${getUid()}`);
  const data = await res.json();

  if (!res.ok) {
    console.error("Failed to load lecturers:", data.error || res.status);
    // show an error state in the UI
    return;
  }

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

      const yearDiff = Number(a.programme_year) - Number(b.programme_year);
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
        c.programme_year,
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
  const res = await fetch(`${API_BASE}/api/courses?uid=${getUid()}`);
  const data = await res.json();

  const course = data.find((c) => c.course_code === courseId);

  if (!course) {
    console.error("Course not found:", courseId);
    return;
  }

  const container = document.querySelector(".myEntities_details");
  container.classList.add("course_details");
  container.innerHTML = "";

  // Title: course name + code, then separator line
  const title = document.createElement("h1");
  const namePart = course.course_name || "Course";
  const codePart = course.course_code ? ` (${course.course_code})` : "";
  title.textContent = `${namePart}${codePart}`;
  container.appendChild(title);

  const separator = document.createElement("hr");
  container.appendChild(separator);

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

  // Display only the key details (code is already in title)
  container.appendChild(createDetail("Course Name", course.course_name));

  const durationHours = course.duration_hours || 2;
  const durationLabel =
    durationHours === 1 ? "1 hour" : `${durationHours} hours`;
  container.appendChild(createDetail("Duration", durationLabel));

  const lecturerLabel =
    course.lecturer_name && course.lecturer_id
      ? `${course.lecturer_id} - ${course.lecturer_name}`
      : course.lecturer_name || course.lecturer_id || "N/A";
  container.appendChild(createDetail("Lecturer", lecturerLabel));

  const programmeLabel =
    course.programme_level && course.programme_name && course.programme_year
      ? `${course.programme_level} in ${course.programme_name} Year ${course.programme_year}`
      : course.programme_name || course.programme_id || "N/A";
  container.appendChild(createDetail("Programme", programmeLabel));
}
