import { initAuth, getCurrentUser } from "./auth.js";
import { initSidebar } from "./sidebar.js";

document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initSidebar();
  initHome();
});

async function initHome() {
  const user = getCurrentUser();

  if (!user) {
    showLoggedOut();
    return;
  }

  showLoggedIn(user);
  await loadStats(user.uid);
}

// ── Show logged-in state ──────────────────────────────────────────────────────

function showLoggedIn(user) {
  const name = user.displayName || user.email || "there";
  const firstName = name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const greetEl = document.querySelector(".home_greeting");
  greetEl.textContent = `${greeting}, ${firstName} 👋`;
  greetEl.style.display = "block";

  document.querySelector(".home_stats_grid").style.display = "grid";
  document.querySelector(".home_actions").style.display = "flex";
}

// ── Show logged-out state ─────────────────────────────────────────────────────

function showLoggedOut() {
  document.querySelector(".home_loggedout").style.display = "flex";

  document.getElementById("homeLoginBtn")?.addEventListener("click", () => {
    document.querySelector(".authModal.login")?.classList.add("active");
  });
  document.getElementById("homeSignupBtn")?.addEventListener("click", () => {
    document.querySelector(".authModal.signup")?.classList.add("active");
  });
}

// ── Fetch and fill stat counts ────────────────────────────────────────────────

async function loadStats(uid) {
  const [courses, lecturers, programmes, timetables] = await Promise.allSettled([
    fetchCount(`/api/courses?uid=${uid}`),
    fetchCount(`/api/lecturers?uid=${uid}`),
    fetchCount(`/api/programmes?uid=${uid}`),
    fetchCount(`/api/timetables?uid=${uid}`),
  ]);

  setStatValue("statCourses",    courses);
  setStatValue("statLecturers",  lecturers);
  setStatValue("statProgrammes", programmes);
  setStatValue("statSchedules",  timetables);
}

async function fetchCount(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("fetch failed");
  const data = await res.json();
  return Array.isArray(data) ? data.length : 0;
}

function setStatValue(cardId, result) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const valueEl = card.querySelector(".home_stat_value");
  if (!valueEl) return;
  valueEl.textContent = result.status === "fulfilled" ? result.value : "—";
}