import { updateEntityCards } from "./addEntities.js";
import { API_BASE } from "./config.js";
import { openDrawer, avatarColor, avatarInitials } from "./drawer.js";
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
        updateEntityCards(await loadLecturers(), null, null);
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
        updateEntityCards(await loadLecturers(), null, null);
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
      updateEntityCards(await loadLecturers(), null, null);
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
    return 0;
  }

  const list = document.querySelector(".myLecturer_list");
  list.innerHTML = "";

  if (data.length === 0) {
    const { showEmptyState } = await import("./addEntities.js");
    showEmptyState(list, "lecturer");
    return 0;
  }

  const numId = (id) => parseInt(id.replace(/^\D+/, ""), 10) || 0;
  data
    .slice()
    .sort((a, b) => numId(a.lecturer_id) - numId(b.lecturer_id))
    .forEach((l, i) => {
      // Create card
      const card = document.createElement("div");
      card.className = "myLecturer_card";
      card.style.setProperty("--card-i", i);

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
        displayLecturerDetails(l);
      });

      card.appendChild(displayId);
      card.appendChild(displayName);
      card.appendChild(btn);

      list.appendChild(card);
    });
  return data.length;
}

async function displayLecturerDetails(lecturerOrId) {
  let lecturer;
  if (typeof lecturerOrId === "string") {
    const res = await fetch(`${API_BASE}/api/lecturers?uid=${getUid()}`);
    const data = await res.json();
    lecturer = data.find((l) => l.lecturer_id === lecturerOrId);
  } else {
    lecturer = lecturerOrId;
  }

  if (!lecturer) return;

  const name = lecturer.lecturer_name || "Lecturer";
  const id = lecturer.lecturer_id || "";
  const color = avatarColor(name);
  const inits = avatarInitials(name);

  openDrawer(`
    <div class="drawer_profile">
      <div class="drawer_avatar" style="background:${color}">${inits}</div>
      <div class="drawer_profile_info">
        <h2 class="drawer_name">${name}</h2>
        <span class="drawer_id_badge">${id}</span>
      </div>
    </div>
    <div class="drawer_type_badge drawer_type_lecturer">
      <i class="fa-solid fa-chalkboard-user"></i> Lecturer
    </div>
    <div class="drawer_fields">
      <div class="drawer_field">
        <span class="drawer_field_label"><i class="fa-solid fa-id-card"></i> Lecturer ID</span>
        <span class="drawer_field_value">${id || "N/A"}</span>
      </div>
      <div class="drawer_field">
        <span class="drawer_field_label"><i class="fa-solid fa-user"></i> Full Name</span>
        <span class="drawer_field_value">${name}</span>
      </div>
    </div>
  `);
}