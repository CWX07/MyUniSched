export async function addCourse() {
    // Add course details through modal form
    const form = document.querySelector(".addCourse_modal_content_form");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const courseCode = document.getElementById("courseCode").value;
        const courseName = document.getElementById("courseName").value;
        const lecturerId = document.getElementById("lecturerId_course").value;
        const courseYear = document.getElementById("courseYear").value;

        const programmeNameElement = document.getElementById("programmeName");
        const programmeName = programmeNameElement.dataset.value;

        try {
            const res = await fetch("/api/courses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseCode, courseName, lecturerId, programmeName, courseYear })
            });

            const result = await res.json();

            if (!res.ok) {
                // Debug alert for lecturer not found
                if (result.error && result.error.includes("does not exist")) {
                    alert(`⚠️ ERROR: Lecturer ID '${lecturerId}' not found!\n\nPlease add the lecturer first or use an existing lecturer ID.`);
                } else {
                    alert(result.error);
                }
            }

            else {
                alert("Course added successfully");
                form.reset();

                // Reset programme text and data
                programmeNameElement.textContent = "Select programme";
                delete programmeNameElement.dataset.value;
            }
            
            loadCourses();

        } catch (err) {
            alert("Network error");
        }
    });
}

// Load and display courses
export async function loadCourses() {
    const res = await fetch("/api/courses");
    const data = await res.json();

    const list = document.querySelector(".myCourse_list");
    list.innerHTML = "";

    data.forEach(c => {
        // Create card
        const card = document.createElement("div");
        card.className = "myCourse_card";

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
            alert(`Course: ${c.course_name} (${c.course_code})`);
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

    const course = data.find(c => c.course_code === courseId);
    
    if (!course) {
        console.error("Course not found:", courseId);
        return;
    }

    const container = document.querySelector(".myEntities_details");
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
    container.appendChild(createDetail("Programme Name", course.programme_name));
    container.appendChild(createDetail("Course Year", course.course_year));
}