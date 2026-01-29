document.addEventListener("DOMContentLoaded", () => {
    // Add lecturer details through modal form
    const form = document.querySelector(".addLecturer_modal_content_form");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const lecturerId = document.getElementById("lecturerId").value;
        const lecturerName = document.getElementById("lecturerName").value;

        try {
            const res = await fetch("/api/lecturers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lecturerId, lecturerName })
            });

            const result = await res.json();

            if (!res.ok) {
                alert(result.error);
                return;
            }

            alert("Lecturer added successfully");
            form.reset();

            // Optional: close modal & refresh list
            loadLecturers();

        } catch (err) {
            alert("Network error");
        }
    });
});

// Load and display lecturers
export async function loadLecturers() {
    const res = await fetch("/api/lecturers");
    const data = await res.json();

    const list = document.querySelector(".myLecturer_list");
    list.innerHTML = "";

    data.forEach(l => {
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
            alert(`Lecturer: ${l.lecturer_name} (${l.lecturer_id})`);
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
    const res = await fetch("/api/lecturers");
    const data = await res.json();

    // Find lecturer using snake_case property name
    const lecturer = data.find(l => l.lecturer_id === lecturerId);
    
    if (!lecturer) {
        console.error("Lecturer not found:", lecturerId);
        return;
    }

    const container = document.querySelector(".myEntities_details");
    container.innerHTML = "";

    const title = document.createElement("h1");
    title.textContent = "Lecturer Details";
    container.appendChild(title);

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

    container.appendChild(createDetail("Lecturer ID", lecturer.lecturer_id));
    container.appendChild(createDetail("Lecturer Name", lecturer.lecturer_name));
}