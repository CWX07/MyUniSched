/**
 * sidebar.js — Collapsible sidebar navigation for MyUniSched
 *
 * AUTH STRATEGY
 * ─────────────
 * auth.js's updateNavForUser() targets:
 *   • .profile_menu .dropdown  — rewrites innerHTML with login/logout links
 *   • .profile_menu .profile_img — replaced with .profile_avatar div
 *
 * We keep those elements in the DOM (so auth.js works unchanged), but hide
 * the raw dropdown from users. Instead, sidebar.js reads the auth state and
 * renders a clean, always-visible auth panel at the bottom of the sidebar:
 *
 *   Logged OUT → two visible buttons: "Log In"  "Sign Up"
 *   Logged IN  → avatar + name + a "Log Out" icon button
 *
 * A MutationObserver watches .profile_menu for any innerHTML change by
 * auth.js and immediately re-syncs the visible panel.
 */

const STORAGE_KEY = "mus_sidebar_open";

export function initSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const toggle = document.querySelector(".sidebar_toggle");
  const authPanel = document.querySelector(".sidebar_auth_panel");
  const profileMenu = document.querySelector(".sidebar_profile .profile_menu");

  if (!sidebar || !toggle) return;

  /* ── 1. Restore persisted state ─────────────────────────── */
  if (localStorage.getItem(STORAGE_KEY) === "true") {
    document.body.classList.add("sidebar_open");
  }

  /* ── 2. Toggle ──────────────────────────────────────────── */
  toggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("sidebar_open");
    localStorage.setItem(STORAGE_KEY, String(open));
    // Notify generate_ui that layout has shifted so bars can reposition
    setTimeout(() => window.dispatchEvent(new Event("resize")), 350);
  });

  /* ── 3. Active nav link ─────────────────────────────────── */
  const pageFile = window.location.pathname.split("/").pop() || "index.html";
  sidebar.querySelectorAll(".sidebar_nav a").forEach((link) => {
    const linkFile = (link.getAttribute("href") || "").split("/").pop();
    if (linkFile === pageFile) link.classList.add("active");
  });

  /* ── 4. Auth panel sync ─────────────────────────────────── */
  // Reads the hidden .dropdown content that auth.js wrote and
  // renders a clean visible UI in .sidebar_auth_panel.
  function syncAuthPanel() {
    if (!authPanel) return;
    const dropdown = profileMenu?.querySelector(".dropdown");
    const avatar = profileMenu?.querySelector(".profile_avatar");
    const logoutEl = dropdown?.querySelector("#logOutBtn");
    const isLoggedIn = !!logoutEl;

    if (isLoggedIn) {
      // ── Logged in state ──
      const name = avatar?.title || "User";
      const letter = name.charAt(0).toUpperCase();

      authPanel.innerHTML = `
        <div class="sb_auth_user">
          <div class="sb_avatar" title="${name}">${letter}</div>
          <span class="sb_user_name">${name}</span>
          <button class="sb_logout_btn" title="Log Out">
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>`;

      authPanel
        .querySelector(".sb_logout_btn")
        ?.addEventListener("click", () => {
          // Trigger auth.js's logout by clicking the hidden #logOutBtn
          profileMenu?.querySelector("#logOutBtn")?.click();
        });
    } else {
      // ── Logged out state ──
      authPanel.innerHTML = `
        <div class="sb_auth_btns">
          <button class="sb_login_btn">
            <i class="fa-solid fa-right-to-bracket"></i>
            <span class="sidebar_nav_label">Log In</span>
          </button>
          <button class="sb_signup_btn">
            <i class="fa-solid fa-user-plus"></i>
            <span class="sidebar_nav_label">Sign Up</span>
          </button>
        </div>`;

      authPanel
        .querySelector(".sb_login_btn")
        ?.addEventListener("click", () => {
          document.querySelector(".authModal.login")?.classList.add("active");
        });
      authPanel
        .querySelector(".sb_signup_btn")
        ?.addEventListener("click", () => {
          document.querySelector(".authModal.signup")?.classList.add("active");
        });
    }
  }

  // Run now (auth.js may have already called updateNavForUser)
  syncAuthPanel();

  // Re-sync whenever auth.js rewrites .profile_menu DOM
  if (profileMenu) {
    new MutationObserver(syncAuthPanel).observe(profileMenu, {
      childList: true,
      subtree: true,
    });
  }
}