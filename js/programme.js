import { getProgrammeColor } from "./config.js";

let isEditMode = false;
let currentEditProgrammeId = null;

export async function addProgramme() {
  // Add programme details through modal form
  const form = document.querySelector(".addProgramme_modal_content_form");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const programmeName = document.getElementById("programmeName_input").value;
    const programmeYear = document.getElementById("programmeYear").value;

    const programmeLevelElement = document.getElementById("programmeLevel");
    const programmeLevel = programmeLevelElement.dataset.value;

    if (!programmeLevel) {
      alert("Please select a programme level");
      return;
    }

    try {
      let res, result;

      if (isEditMode && currentEditProgrammeId) {
        // UPDATE existing programme
        const editedProgrammeId = currentEditProgrammeId;
        res = await fetch(`/api/programmes/${currentEditProgrammeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            programmeName,
            programmeLevel,
            programmeYear,
          }),
        });

        result = await res.json();

        if (!res.ok) {
          alert(result.error);
          return;
        }

        alert("Programme updated successfully");
        resetProgrammeForm();
        const modal = document.querySelector(".addProgramme_modal");
        const { closeModal } = await import("./addEntities.js");
        closeModal(modal);
        await loadProgrammes();
        await displayProgrammeDetails(editedProgrammeId);
      } else {
        // CREATE new programme
        res = await fetch("/api/programmes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            programmeName,
            programmeLevel,
            programmeYear,
          }),
        });

        result = await res.json();

        if (!res.ok) {
          alert(result.error);
          return;
        }

        alert(`Programme added successfully with ID: ${result.programme_id}`);
        resetProgrammeForm();
      }

      // Refresh list
      await loadProgrammes();
    } catch (err) {
      alert("Network error");
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
}

export function editProgramme(programmeId) {
  isEditMode = true;
  currentEditProgrammeId = programmeId;

  // Fetch programme details and populate form
  fetch("/api/programmes")
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
      alert("Error loading programme details");
    });
}

// Load and display programmes
export async function loadProgrammes() {
  const res = await fetch("/api/programmes");
  const data = await res.json();

  const list = document.querySelector(".myProgramme_list");
  if (!list) return; // If programme list doesn't exist yet

  list.innerHTML = "";

  // Sort programmes: level -> name -> year
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

      return Number(a.programme_year) - Number(b.programme_year);
    })
    .forEach((p) => {
    // Create card
    const card = document.createElement("div");
    card.className = "myProgramme_card";

    // Apply color-coded left border based on programme
    const color = getProgrammeColor(
      p.programme_level,
      p.programme_name,
      p.programme_year
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
      const programmeId = card.dataset.programmeId;
      displayProgrammeDetails(programmeId);
    });

    card.appendChild(displayId);
    card.appendChild(displayName);
    card.appendChild(btn);

    list.appendChild(card);
  });
}

async function displayProgrammeDetails(programmeId) {
  const res = await fetch("/api/programmes");
  const data = await res.json();

  const programme = data.find((p) => p.programme_id === programmeId);

  if (!programme) {
    console.error("Programme not found:", programmeId);
    return;
  }

  const container = document.querySelector(".myEntities_details");
  container.classList.remove("course_details");
  container.innerHTML = "";

  const title = document.createElement("h1");
  title.textContent = "Programme Details";
  container.appendChild(title);

  function createDetail(label, value) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("programmeDetails");

    const titleDiv = document.createElement("div");
    titleDiv.classList.add("programmeDetails_title");

    const h3 = document.createElement("h3");
    h3.textContent = label;

    const colon = document.createElement("span");
    colon.textContent = ":";

    titleDiv.appendChild(h3);
    titleDiv.appendChild(colon);

    const ans = document.createElement("div");
    ans.textContent = value || "N/A";

    wrapper.appendChild(titleDiv);
    wrapper.appendChild(ans);

    return wrapper;
  }

  container.appendChild(createDetail("Programme ID", programme.programme_id));
  container.appendChild(
    createDetail("Programme Name", programme.programme_name),
  );
  container.appendChild(
    createDetail("Programme Level", programme.programme_level),
  );
  container.appendChild(
    createDetail("Programme Year", programme.programme_year),
  );
}