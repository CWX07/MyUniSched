import { API_BASE } from "./config.js";
import { getCurrentUser, showNotification, showConfirm } from "./auth.js";

function getUid() {
  const user = getCurrentUser();
  return user ? user.uid : null;
}

let isEditMode = false;
let currentEditLecturerId = null;

export async function addLecturer() {
  // Add lecturer details through modal form
  const form = document.querySelector(".addLecturer_modal_content_form");
  const deleteBtn = document.querySelector(".deleteLecturer_btn");

  if (deleteBtn) {
    // Hidden by default; only shown in edit mode
    deleteBtn.style.display = "none";

    deleteBtn.addEventListener("click", async () => {
      if (!isEditMode || !currentEditLecturerId) return;

      const confirmed = await showConfirm(
        "Are you sure you want to delete this lecturer?",
        "Delete Lecturer",
      );
      if (!confirmed) return;

      try {
        const res = await fetch(
          `${API_BASE}/api/lecturers/${currentEditLecturerId}?uid=${getUid()}`,
          { method: "DELETE" },
        );
        const result = await res.json();

        if (!res.ok) {
          showNotification(
            result.error || "Failed to delete lecturer",
            "error",
          );
          return;
        }

        showNotification("Lecturer deleted successfully", "success");
        resetLecturerForm();
        const modal = document.querySelector(".addLecturer_modal");
        const { closeModal } = await import("./addEntities.js");
        closeModal(modal);
        await loadLecturers();
      } catch (err) {
        showNotification("Error deleting lecturer", "error");
      }
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const lecturerName = document.getElementById("lecturerName").value;

    try {
      let res, result;

      if (isEditMode && currentEditLecturerId) {
        // UPDATE existing lecturer
        const editedLecturerId = currentEditLecturerId;
        res = await fetch(
          `${API_BASE}/api/lecturers/${currentEditLecturerId}?uid=${getUid()}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lecturerName }),
          },
        );

        result = await res.json();

        if (!res.ok) {
          showNotification(result.error, "error");
          return;
        }

        showNotification("Lecturer updated successfully", "success");
        resetLecturerForm();
        const modal = document.querySelector(".addLecturer_modal");
        const { closeModal } = await import("./addEntities.js");
        closeModal(modal);
        await loadLecturers();
        await displayLecturerDetails(editedLecturerId);
      } else {
        // CREATE new lecturer
        res = await fetch(`${API_BASE}/api/lecturers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lecturerName, uid: getUid() }),
        });

        result = await res.json();

        if (!res.ok) {
          showNotification(result.error, "error");
          return;
        }

        showNotification(
          `Lecturer added successfully with ID: ${result.lecturer_id}`,
          "success",
        );
        resetLecturerForm();
      }

      // Refresh list
      await loadLecturers();
    } catch (err) {
      showNotification("Network error", "error");
    }
  });
}

function resetLecturerForm() {
  const form = document.querySelector(".addLecturer_modal_content_form");
  form.reset();

  // Reset to add mode
  isEditMode = false;
  currentEditLecturerId = null;

  // Update modal title and button text
  const modalTitle = document.querySelector(".addLecturer_modal_content h2");
  modalTitle.textContent = "Add Lecturer";

  const submitBtn = document.querySelector(".addLecturer_submit_btn");
  submitBtn.textContent = "Add Lecturer";

  const deleteBtn = document.querySelector(".deleteLecturer_btn");
  if (deleteBtn) {
    deleteBtn.style.display = "none";
  }
}

export function editLecturer(lecturerId) {
  isEditMode = true;
  currentEditLecturerId = lecturerId;

  // Fetch lecturer details and populate form
  fetch(`${API_BASE}/api/lecturers?uid=${getUid()}`)
    .then((res) => res.json())
    .then((data) => {
      const lecturer = data.find((l) => l.lecturer_id === lecturerId);

      if (lecturer) {
        // Update modal title and button
        const modalTitle = document.querySelector(
          ".addLecturer_modal_content h2",
        );
        modalTitle.textContent = "Edit Lecturer";

        const submitBtn = document.querySelector(".addLecturer_submit_btn");
        submitBtn.textContent = "Update Lecturer";

        const deleteBtn = document.querySelector(".deleteLecturer_btn");
        if (deleteBtn) {
          deleteBtn.style.display = "inline-flex";
        }

        // Populate form fields
        document.getElementById("lecturerName").value = lecturer.lecturer_name;

        // Open modal
        const modal = document.querySelector(".addLecturer_modal");
        import("./addEntities.js").then((module) => {
          module.openModal(modal);
        });
      }
    })
    .catch((err) => {
      showNotification("Error loading lecturer details", "error");
    });
}

// Load and display lecturers
export async function loadLecturers() {
  const res = await fetch(`${API_BASE}/api/lecturers?uid=${getUid()}`);
  const data = await res.json();

  if (!res.ok) {
    console.error("Failed to load lecturers:", data.error || res.status);
    // show an error state in the UI
    return;
  }

  const list = document.querySelector(".myLecturer_list");
  list.innerHTML = "";

  data.forEach((l) => {
    // Create card
    const card = document.createElement("div");
    card.className = "myLecturer_card";

    // displayItem1 <-- Lecturer ID
    const displayId = document.createElement("div");
    displayId.className = "displayItem1";
    displayId.textContent = l.lecturer_id;

    // displayItem2 <-- Lecturer Name
    const displayName = document.createElement("div");
    displayName.className = "displayItem2";
    displayName.textContent = l.lecturer_name;

    // viewEntity_btn
    const btn = document.createElement("button");
    btn.className = "viewEntity_btn";
    btn.innerHTML = "&#9881;"; // gear icon

    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent card click from firing
      editLecturer(l.lecturer_id);
    });

    card.dataset.lecturerId = l.lecturer_id;

    // Add click event to show details
    card.addEventListener("click", () => {
      const lecturerId = card.dataset.lecturerId;
      displayLecturerDetails(lecturerId);
    });

    card.appendChild(displayId);
    card.appendChild(displayName);
    card.appendChild(btn);

    list.appendChild(card);
  });
}

async function displayLecturerDetails(lecturerId) {
  const res = await fetch(`${API_BASE}/api/lecturers?uid=${getUid()}`);
  const data = await res.json();
  const lecturer = data.find((l) => l.lecturer_id === lecturerId);

  if (!lecturer) {
    console.error("Lecturer not found:", lecturerId);
    return;
  }

  const container = document.querySelector(".myEntities_details");
  container.classList.remove("course_details");
  container.innerHTML = "";

  // Title: lecturer name + ID, then separator line
  const title = document.createElement("h1");
  const namePart = lecturer.lecturer_name || "Lecturer";
  const idPart = lecturer.lecturer_id ? ` (${lecturer.lecturer_id})` : "";
  title.textContent = `${namePart}${idPart}`;
  container.appendChild(title);

  const separator = document.createElement("hr");
  container.appendChild(separator);

  function createDetail(label, value) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("lecturerDetails");

    const titleDiv = document.createElement("div");
    titleDiv.classList.add("lecturerDetails_title");

    const h3 = document.createElement("h3");
    h3.textContent = label;

    const colon = document.createElement("span");
    colon.textContent = ":";

    titleDiv.appendChild(h3);
    titleDiv.appendChild(colon);

    const ans = document.createElement("div");
    ans.classList.add("lecturerDetailsAns");
    ans.textContent = value || "N/A";

    wrapper.appendChild(titleDiv);
    wrapper.appendChild(ans);

    return wrapper;
  }

  container.appendChild(createDetail("Lecturer Name", lecturer.lecturer_name));
}
