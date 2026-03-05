import { updateEntityCards } from "./addEntities.js";
import { API_BASE, getProgrammeColor, resetProgrammeColors } from "./config.js";
import { openDrawer, avatarColor, avatarInitials } from "./drawer.js";
import { getCurrentUser, showNotification, showConfirm } from "./auth.js";

function getUid() {
  const user = getCurrentUser();
  return user ? user.uid : null;
}

let isEditMode = false;
let currentEditProgrammeId = null;

export async function addProgramme() {
  // Add programme details through modal form
  const form = document.querySelector(".addProgramme_modal_content_form");
  const deleteBtn = document.querySelector(".deleteProgramme_btn");

  if (deleteBtn) {
    deleteBtn.style.display = "none";

    deleteBtn.addEventListener("click", async () => {
      if (!isEditMode || !currentEditProgrammeId) return;

      const confirmed = await showConfirm(
        "Are you sure you want to delete this programme?",
        "Delete Programme",
      );
      if (!confirmed) return;

      try {
        const res = await fetch(
          `${API_BASE}/api/programmes/${currentEditProgrammeId}?uid=${getUid()}`,
          {
            method: "DELETE",
          },
        );
        const result = await res.json();

        if (!res.ok) {
          showNotification(
            result.error || "Failed to delete programme",
            "error",
          );
          return;
        }

        showNotification("Programme deleted successfully", "success");
        resetProgrammeColors();
        resetProgrammeForm();
        const modal = document.querySelector(".addProgramme_modal");
        const { closeModal } = await import("./addEntities.js");
        closeModal(modal);
        updateEntityCards(null, await loadProgrammes(), null);
      } catch (err) {
        showNotification("Error deleting programme", "error");
      }
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const programmeName = document.getElementById("programmeName_input").value;
    const programmeYear = document.getElementById("programmeYear").value;

    const programmeLevelElement = document.getElementById("programmeLevel");
    const programmeLevel = programmeLevelElement.dataset.value;

    if (!programmeLevel) {
      showNotification("Please select a programme level", "error");
      return;
    }

    try {
      let res, result;

      if (isEditMode && currentEditProgrammeId) {
        // UPDATE existing programme
        const editedProgrammeId = currentEditProgrammeId;
        res = await fetch(
          `${API_BASE}/api/programmes/${currentEditProgrammeId}?uid=${getUid()}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              programmeName,
              programmeLevel,
              programmeYear,
            }),
          },
        );

        result = await res.json();

        if (!res.ok) {
          showNotification(result.error, "error");
          return;
        }

        showNotification("Programme updated successfully", "success");
        resetProgrammeColors();
        resetProgrammeForm();
        const modal = document.querySelector(".addProgramme_modal");
        const { closeModal } = await import("./addEntities.js");
        closeModal(modal);
        updateEntityCards(null, await loadProgrammes(), null);
        await displayProgrammeDetails(editedProgrammeId);
      } else {
        // CREATE new programme
        res = await fetch(`${API_BASE}/api/programmes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            programmeName,
            programmeLevel,
            programmeYear,
            uid: getUid(),
          }),
        });

        result = await res.json();

        if (!res.ok) {
          showNotification(result.error, "error");
          return;
        }

        showNotification(
          `Programme added successfully with ID: ${result.programme_id}`,
          "success",
        );
        resetProgrammeColors();
        resetProgrammeForm();
      }

      // Refresh list
      updateEntityCards(null, await loadProgrammes(), null);
    } catch (err) {
      showNotification("Network error", "error");
    }
  });
}

function resetProgrammeForm() {
  const form = document.querySelector(".addProgramme_modal_content_form");
  form.reset();

  const programmeLevelElement = document.getElementById("programmeLevel");
  programmeLevelElement.textContent = "Select level";
  delete programmeLevelElement.dataset.value;

  // Reset to add mode
  isEditMode = false;
  currentEditProgrammeId = null;

  // Update modal title and button text
  const modalTitle = document.querySelector(".addProgramme_modal_content h2");
  modalTitle.textContent = "Add Programme";

  const submitBtn = document.querySelector(".addProgramme_submit_btn");
  submitBtn.textContent = "Add Programme";

  const deleteBtn = document.querySelector(".deleteProgramme_btn");
  if (deleteBtn) {
    deleteBtn.style.display = "none";
  }
}

export function editProgramme(programmeId) {
  isEditMode = true;
  currentEditProgrammeId = programmeId;

  // Fetch programme details and populate form
  fetch(`${API_BASE}/api/programmes?uid=${getUid()}`)
    .then((res) => res.json())
    .then((data) => {
      const programme = data.find((p) => p.programme_id === programmeId);

      if (programme) {
        // Update modal title and button
        const modalTitle = document.querySelector(
          ".addProgramme_modal_content h2",
        );
        modalTitle.textContent = "Edit Programme";

        const submitBtn = document.querySelector(".addProgramme_submit_btn");
        submitBtn.textContent = "Update Programme";

        const deleteBtn = document.querySelector(".deleteProgramme_btn");
        if (deleteBtn) {
          deleteBtn.style.display = "inline-flex";
        }

        // Populate form fields
        document.getElementById("programmeName_input").value =
          programme.programme_name;
        document.getElementById("programmeYear").value =
          programme.programme_year;

        // Set programme level dropdown
        const programmeLevelElement = document.getElementById("programmeLevel");
        programmeLevelElement.textContent = programme.programme_level;
        programmeLevelElement.dataset.value = programme.programme_level;

        // Open modal
        const modal = document.querySelector(".addProgramme_modal");
        import("./addEntities.js").then((module) => {
          module.openModal(modal);
        });
      }
    })
    .catch((err) => {
      showNotification("Error loading programme details", "error");
    });
}

// Load and display programmes
export async function loadProgrammes() {
  const list = document.querySelector(".myProgramme_list");
  if (!list) return 0;

  const res = await fetch(`${API_BASE}/api/programmes?uid=${getUid()}`);
  if (!res.ok) {
    console.error("Failed to load programmes:", res.status);
    return 0;
  }
  const data = await res.json();

  list.innerHTML = "";

  if (data.length === 0) {
    const { showEmptyState } = await import("./addEntities.js");
    showEmptyState(list, "programme");
    return 0;
  }

  // Sort programmes: level -> name -> year -> numeric programme_id
  const numId = (id) => parseInt(id.replace(/^\D+/, ""), 10) || 0;
  const levelOrder = ["Foundation", "Diploma", "Degree", "Master", "PhD"];
  data
    .slice()
    .sort((a, b) => {
      const levelDiff =
        levelOrder.indexOf(a.programme_level) -
        levelOrder.indexOf(b.programme_level);
      if (levelDiff !== 0) return levelDiff;

      const nameDiff = a.programme_name.localeCompare(b.programme_name);
      if (nameDiff !== 0) return nameDiff;

      const yearDiff = Number(a.programme_year) - Number(b.programme_year);
      if (yearDiff !== 0) return yearDiff;

      return numId(a.programme_id) - numId(b.programme_id);
    })
    .forEach((p) => {
      // Create card
      const card = document.createElement("div");
      card.className = "myProgramme_card";

      // Apply color-coded left border based on programme
      const color = getProgrammeColor(
        p.programme_level,
        p.programme_name,
        p.programme_year,
      );
      card.style.borderLeft = `4px solid ${color}`;

      // displayItem1 <-- Programme ID
      const displayId = document.createElement("div");
      displayId.className = "displayItem1";
      displayId.textContent = p.programme_id;

      // displayItem2 <-- Programme Name
      const displayName = document.createElement("div");
      displayName.className = "displayItem2";
      displayName.textContent = `${p.programme_level} in ${p.programme_name} Year ${p.programme_year}`;

      // viewEntity_btn
      const btn = document.createElement("button");
      btn.className = "viewEntity_btn";
      btn.innerHTML = "&#9881;"; // gear icon

      btn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent card click from firing
        editProgramme(p.programme_id);
      });

      card.dataset.programmeId = p.programme_id;

      // Add click event to show details
      card.addEventListener("click", () => {
        displayProgrammeDetails(p);
      });

      card.appendChild(displayId);
      card.appendChild(displayName);
      card.appendChild(btn);

      list.appendChild(card);
    });
  return data.length;
}

async function displayProgrammeDetails(programmeOrId) {
  let programme;
  if (typeof programmeOrId === "string") {
    const res = await fetch(`${API_BASE}/api/programmes?uid=${getUid()}`);
    const data = await res.json();
    programme = data.find((p) => p.programme_id === programmeOrId);
  } else {
    programme = programmeOrId;
  }

  if (!programme) return;

  const name  = programme.programme_name  || "Programme";
  const level = programme.programme_level || "";
  const year  = programme.programme_year  || "";
  const id    = programme.programme_id    || "";
  const color = getProgrammeColor(level, name, year);
  const inits = avatarInitials(name);

  openDrawer(`
    <div class="drawer_profile">
      <div class="drawer_avatar" style="background:${color}">${inits}</div>
      <div class="drawer_profile_info">
        <h2 class="drawer_name">${name}</h2>
        <span class="drawer_id_badge">${id}</span>
      </div>
    </div>
    <div class="drawer_type_badge drawer_type_programme">
      <i class="fa-solid fa-graduation-cap"></i> Programme
    </div>
    <div class="drawer_fields">
      <div class="drawer_field">
        <span class="drawer_field_label"><i class="fa-solid fa-id-card"></i> Programme ID</span>
        <span class="drawer_field_value">${id || "N/A"}</span>
      </div>
      <div class="drawer_field">
        <span class="drawer_field_label"><i class="fa-solid fa-font"></i> Name</span>
        <span class="drawer_field_value">${name}</span>
      </div>
      <div class="drawer_field">
        <span class="drawer_field_label"><i class="fa-solid fa-layer-group"></i> Level</span>
        <span class="drawer_field_value">${level || "N/A"}</span>
      </div>
      <div class="drawer_field">
        <span class="drawer_field_label"><i class="fa-solid fa-calendar"></i> Year</span>
        <span class="drawer_field_value">${year ? "Year " + year : "N/A"}</span>
      </div>
    </div>
  `);
}