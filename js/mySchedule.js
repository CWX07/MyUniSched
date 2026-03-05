import {
  initAuth,
  getCurrentUser,
  showNotification,
  showConfirm,
  showPrompt,
} from "./auth.js";
import { TIME_SLOTS, DAYS } from "./config.js";
import {
  buildGanttTable,
  positionBars,
  buildExportTableHTML,
} from "./timetable_utils.js";

document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  loadSchedules();
});

// ── Load all saved timetables ─────────────────────────────────────────────────

async function loadSchedules() {
  const container = document.getElementById("myScheduleContainer");
  const user = getCurrentUser();

  if (!user) {
    container.innerHTML = `
      <div class="schedule_empty">
        <i class="fa-solid fa-calendar-xmark"></i>
        <p>Please <a href="#" id="loginPrompt">log in</a> to view your saved timetables.</p>
      </div>`;
    document.getElementById("loginPrompt")?.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector(".authModal.login")?.classList.add("active");
    });
    return;
  }

  container.innerHTML = '<p class="loading_msg">Loading your schedules…</p>';

  try {
    const res = await fetch(`/api/timetables?uid=${user.uid}`);
    const timetables = await res.json();
    if (!res.ok || timetables.error)
      throw new Error(timetables.error || "Failed to load");

    if (timetables.length === 0) {
      container.innerHTML = `
        <div class="schedule_empty">
          <i class="fa-solid fa-calendar-plus"></i>
          <p>No saved timetables yet. <a href="./generate.html">Generate one!</a></p>
        </div>`;
      return;
    }

    container.innerHTML = "";
    timetables.forEach((tt) => renderScheduleCard(container, tt));
  } catch (err) {
    container.innerHTML = `<p class="error_msg">Error loading schedules: ${err.message}</p>`;
  }
}

// ── Render one card with inline dropdown ──────────────────────────────────────

function renderScheduleCard(container, tt) {
  const wrapper = document.createElement("div");
  wrapper.className = "schedule_card_wrapper";

  const savedDate = new Date(tt.savedAt).toLocaleString();

  const card = document.createElement("div");
  card.className = "schedule_card";
  card.innerHTML = `
    <div class="schedule_card_info">
      <div class="schedule_card_name">${tt.name}</div>
      <div class="schedule_card_date">
        <i class="fa-regular fa-clock"></i> ${savedDate}
      </div>
    </div>
    <div class="schedule_card_actions">
      <button class="action_bar_btn view_btn">
        <i class="fa-solid fa-chevron-down view_chevron"></i> View
      </button>
      <button class="action_bar_btn rename_btn" title="Rename">
        <i class="fa-solid fa-pencil"></i>
      </button>
      <button class="action_bar_btn duplicate_btn" title="Duplicate">
        <i class="fa-solid fa-copy"></i>
      </button>
      <button class="action_bar_btn download_btn dl_pdf_btn">
        <i class="fa-solid fa-file-pdf"></i> PDF
      </button>
      <button class="action_bar_btn download_btn dl_excel_btn">
        <i class="fa-solid fa-file-excel"></i> Excel
      </button>
      <button class="action_bar_btn delete_tt_btn">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  `;

  const panel = document.createElement("div");
  panel.className = "schedule_card_panel";

  const panelInner = document.createElement("div");
  panelInner.className = "schedule_card_panel_inner";
  panel.appendChild(panelInner);

  let isOpen = false;
  let isLoaded = false;
  let cachedTimetable = null;

  // ── View toggle ──
  const viewBtn = card.querySelector(".view_btn");
  const chevron = card.querySelector(".view_chevron");

  viewBtn.addEventListener("click", async () => {
    isOpen = !isOpen;

    if (isOpen) {
      viewBtn.classList.add("active");
      chevron.classList.add("rotated");
      card.classList.add("card_expanded");
      panel.classList.add("open");

      if (!isLoaded) {
        panelInner.innerHTML = `
          <div class="panel_loading">
            <i class="fa-solid fa-spinner fa-spin"></i> Loading timetable…
          </div>`;
        try {
          cachedTimetable = await fetchTimetable(tt.id);
          isLoaded = true;
          renderTimetableInPanel(panelInner, cachedTimetable);
        } catch (err) {
          panelInner.innerHTML = `<p class="error_msg">Failed to load: ${err.message}</p>`;
          isOpen = false;
          isLoaded = false;
          panel.classList.remove("open");
          card.classList.remove("card_expanded");
          viewBtn.classList.remove("active");
          chevron.classList.remove("rotated");
        }
      }
    } else {
      viewBtn.classList.remove("active");
      chevron.classList.remove("rotated");
      card.classList.remove("card_expanded");
      panel.classList.remove("open");
    }
  });

  // ── Rename (#11) ──
  card.querySelector(".rename_btn").addEventListener("click", async () => {
    const nameEl = card.querySelector(".schedule_card_name");
    const newName = await showPrompt(
      "Enter a new name for this timetable:",
      nameEl.textContent,
    );
    if (!newName || newName === nameEl.textContent) return;

    try {
      const res = await fetch(`/api/timetables/${tt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, uid: getCurrentUser()?.uid }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Rename failed");
      }
      tt.name = newName;
      nameEl.textContent = newName;
      showNotification("Timetable renamed.", "success");
    } catch (err) {
      showNotification("Error: " + err.message, "error");
    }
  });

  // ── Duplicate (#12) ──
  card.querySelector(".duplicate_btn").addEventListener("click", async () => {
    const user = getCurrentUser();
    if (!user) {
      showNotification("Please log in to duplicate a timetable.", "info");
      return;
    }

    const btn = card.querySelector(".duplicate_btn");
    btn.disabled = true;
    try {
      // Always fetch fresh data for the duplicate so repeated duplications or
      // server-side renames don't silently copy stale cached content.
      const freshTimetable = await fetchTimetable(tt.id);
      if (!cachedTimetable) cachedTimetable = freshTimetable;

      const copyName = `${tt.name} (copy)`;
      const res = await fetch(`/api/timetables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          name: copyName,
          timetable: freshTimetable,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Duplicate failed");

      showNotification(`Duplicated as "${copyName}".`, "success");

      // Append new card without a full page reload
      const scheduleContainer = document.getElementById("myScheduleContainer");
      renderScheduleCard(scheduleContainer, {
        id: data.id,
        name: copyName,
        savedAt: new Date().toISOString(),
      });
    } catch (err) {
      showNotification("Error: " + err.message, "error");
    } finally {
      btn.disabled = false;
    }
  });

  // ── PDF ──
  card.querySelector(".dl_pdf_btn").addEventListener("click", async () => {
    try {
      if (!cachedTimetable) cachedTimetable = await fetchTimetable(tt.id);
      openPrintWindow(cachedTimetable, tt.name);
    } catch (err) {
      showNotification("Error: " + err.message, "error");
    }
  });

  // ── Excel ──
  card.querySelector(".dl_excel_btn").addEventListener("click", async () => {
    try {
      if (!cachedTimetable) cachedTimetable = await fetchTimetable(tt.id);
      exportExcel(cachedTimetable, tt.name);
    } catch (err) {
      showNotification("Error: " + err.message, "error");
    }
  });

  // ── Delete ──
  card
    .querySelector(".delete_tt_btn")
    .addEventListener("click", () => deleteTimetable(tt.id, wrapper));

  wrapper.appendChild(card);
  wrapper.appendChild(panel);
  container.appendChild(wrapper);
}

// ── Fetch timetable data ──────────────────────────────────────────────────────

async function fetchTimetable(id) {
  const res = await fetch(`/api/timetables/${id}`);
  if (!res.ok) throw new Error("Failed to fetch timetable");
  const data = await res.json();
  return data.timetable;
}

// ── Render Gantt timetable inside panel ──────────────────────────────────────

function renderTimetableInPanel(container, timetable) {
  container.innerHTML = "";

  const hasCourses = DAYS.some((day) =>
    TIME_SLOTS.some((slot) => (timetable[day]?.[slot.id] || []).length > 0),
  );

  if (!hasCourses) {
    container.innerHTML = `
      <div class="panel_empty">
        <i class="fa-solid fa-calendar-xmark"></i>
        <span>No scheduled courses in this timetable.</span>
      </div>`;
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "timetable_wrapper";

  const tableContainer = document.createElement("div");
  tableContainer.className = "timetable_container";

  const table = buildGanttTable(timetable); // shared util (#18)
  tableContainer.appendChild(table);
  wrapper.appendChild(tableContainer);
  container.appendChild(wrapper);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => positionBars(table)); // shared util (#18)
  });
}

// ── PDF export ────────────────────────────────────────────────────────────────

function openPrintWindow(timetable, name) {
  const tableHTML = buildExportTableHTML(timetable, "pdf"); // shared util (#18)

  const pw = window.open("", "_blank");
  pw.document.write(`<!DOCTYPE html><html><head><title>${name}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:Arial,sans-serif;margin:16px;font-size:11px;}
    h1{font-size:16px;font-weight:800;margin-bottom:2px;}
    p{font-size:11px;color:#555;margin-bottom:10px;}
    table{border-collapse:collapse;width:100%;}
    td,th{word-break:break-word;overflow:hidden;}
    @media print{@page{size:landscape;margin:8mm;}body{margin:0;}}
  </style></head><body>
  <h1>MyUniSched — ${name}</h1>
  <p>Generated on ${new Date().toLocaleString()}</p>
  ${tableHTML}
  </body></html>`);
  pw.document.close();
  pw.focus();
  setTimeout(() => pw.print(), 400);
}

// ── Excel export ──────────────────────────────────────────────────────────────

function exportExcel(timetable, name) {
  const tableHTML = buildExportTableHTML(timetable, "excel"); // shared util (#18)

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="UTF-8"></head>
  <body>
    <h2 style="font-family:Arial;">${name}</h2>
    <p style="font-family:Arial;font-size:11px;color:#555;">Generated on ${new Date().toLocaleString()}</p>
    ${tableHTML}
  </body></html>`;

  const blob = new Blob([html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/\s+/g, "_")}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function deleteTimetable(id, wrapper) {
  const confirmed = await showConfirm(
    "Delete this timetable? <br> This cannot be undone.",
    "Delete",
  );
  if (!confirmed) return;
  try {
    const res = await fetch(
      `/api/timetables/${id}?uid=${getCurrentUser()?.uid}`,
      { method: "DELETE" },
    );
    if (!res.ok) throw new Error("Delete failed");
    wrapper.remove();

    const container = document.getElementById("myScheduleContainer");
    if (container.children.length === 0) {
      container.innerHTML = `
        <div class="schedule_empty">
          <i class="fa-solid fa-calendar-plus"></i>
          <p>No saved timetables yet. <a href="./generate.html">Generate one!</a></p>
        </div>`;
    }
  } catch (err) {
    showNotification("Error deleting timetable: " + err.message, "error");
  }
}