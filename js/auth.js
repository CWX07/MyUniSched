// auth.js — Firebase Auth (client-side) for login / sign-up
// Uses our Express backend (`API_BASE` from config.js) as a proxy,
// so no Firebase API key is needed in the browser.

import { API_BASE } from "./config.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getCurrentUser() {
  const raw = localStorage.getItem("musUser");
  return raw ? JSON.parse(raw) : null;
}

function setCurrentUser(user) {
  if (user) localStorage.setItem("musUser", JSON.stringify(user));
  else localStorage.removeItem("musUser");
}

// ── API calls (go through our Express server) ────────────────────────────────

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function signUp(email, password, displayName) {
  const data = await apiPost("/api/auth/signup", {
    email,
    password,
    displayName,
  });
  if (data.error) throw new Error(data.error);
  setCurrentUser(data.user);
  return data.user;
}

export async function logIn(email, password) {
  const data = await apiPost("/api/auth/login", { email, password });
  if (data.error) throw new Error(data.error);
  setCurrentUser(data.user);
  return data.user;
}

export function logOut() {
  setCurrentUser(null);
  window.location.reload();
}

// ── UI helpers ────────────────────────────────────────────────────────────────

export function updateNavForUser(user) {
  const dropdown = document.querySelector(".profile_menu .dropdown");
  if (!dropdown) return;

  if (user) {
    // Swap default <img> for a letter avatar
    const name = user.displayName || user.email;
    const letter = name.charAt(0).toUpperCase();
    const profileImg = document.querySelector(".profile_menu .profile_img");
    const existingAvatar = document.querySelector(
      ".profile_menu .profile_avatar",
    );
    if (profileImg && !existingAvatar) {
      const avatar = document.createElement("div");
      avatar.className = "profile_img profile_avatar";
      avatar.textContent = letter;
      avatar.title = name;
      profileImg.replaceWith(avatar);
    } else if (existingAvatar) {
      existingAvatar.textContent = letter;
      existingAvatar.title = name;
    }

    dropdown.innerHTML = `
      <span class="nav_user_name">${name}</span>
      <a href="#" id="logOutBtn">Log Out</a>
    `;
    document.getElementById("logOutBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      logOut();
    });
  } else {
    // Restore default profile image
    const avatar = document.querySelector(".profile_menu .profile_avatar");
    if (avatar) {
      const img = document.createElement("img");
      img.src = "../img/pfp_icon.png";
      img.className = "profile_img";
      img.alt = "";
      avatar.replaceWith(img);
    }

    dropdown.innerHTML = `
      <a href="#" id="openLogIn">Log In</a>
      <a href="#" id="openSignUp">Sign up</a>
    `;
    document.getElementById("openLogIn")?.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector(".authModal.login")?.classList.add("active");
    });
    document.getElementById("openSignUp")?.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector(".authModal.signup")?.classList.add("active");
    });
  }
}

// ── Modal injection ───────────────────────────────────────────────────────────

// ── Clear form fields (defeats browser autofill re-injection) ────────────────
function clearForm(formId, fieldIds) {
  const form = document.getElementById(formId);
  if (form) form.reset();
  // Manually blank each field after a tick — defeats autofill re-population
  setTimeout(() => {
    fieldIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) { el.value = ""; el.removeAttribute("value"); }
    });
  }, 50);
}

export function injectAuthModals() {
  const html = `
  <!-- Login Modal -->
  <div class="authModal login">
    <div class="authModal_content">
      <span class="authModal_close" data-modal="login">&times;</span>
      <h2>Log In</h2>
      <div class="authError login_error" style="display:none"></div>
      <form class="authForm" id="loginForm" autocomplete="off">
        <label>Email</label>
        <input type="email" id="loginEmail" class="input_field" placeholder="Enter email" required />
        <label>Password</label>
        <input type="password" id="loginPassword" class="input_field" placeholder="Enter password" autocomplete="new-password" required />
        <div class="auth_demo_btns">
          <span class="auth_demo_label">Demo accounts:</span>
          <button type="button" class="auth_demo_btn" data-email="testuser1@gmail.com" data-password="testuser1">User 1</button>
          <button type="button" class="auth_demo_btn" data-email="testuser2@gmail.com" data-password="testuser2">User 2</button>
        </div>
        <button type="submit" class="auth_submit_btn">Log In</button>
      </form>
      <p class="authSwitch">Don't have an account? <a href="#" id="switchToSignUp">Sign Up</a></p>
    </div>
  </div>

  <!-- Sign Up Modal -->
  <div class="authModal signup">
    <div class="authModal_content">
      <span class="authModal_close" data-modal="signup">&times;</span>
      <h2>Sign Up</h2>
      <div class="authError signup_error" style="display:none"></div>
      <form class="authForm" id="signupForm" autocomplete="off">
        <label>Name</label>
        <input type="text" id="signupName" class="input_field" placeholder="Your name" required />
        <label>Email</label>
        <input type="email" id="signupEmail" class="input_field" placeholder="Enter email" required />
        <label>Password</label>
        <input type="password" id="signupPassword" class="input_field" placeholder="Min 6 characters" autocomplete="new-password" required />
        <button type="submit" class="auth_submit_btn">Create Account</button>
      </form>
      <p class="authSwitch">Already have an account? <a href="#" id="switchToLogIn">Log In</a></p>
    </div>
  </div>
  `;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  // Demo autofill buttons
  document.querySelectorAll(".auth_demo_btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("loginEmail").value    = btn.dataset.email;
      document.getElementById("loginPassword").value = btn.dataset.password;
    });
  });

  // Close buttons
  document.querySelectorAll(".authModal_close").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelector(`.authModal.${btn.dataset.modal}`)?.classList.remove("active");
      if (btn.dataset.modal === "login") clearForm("loginForm", ["loginEmail", "loginPassword"]);
      if (btn.dataset.modal === "signup") clearForm("signupForm", ["signupName", "signupEmail", "signupPassword"]);
    });
  });

  // Overlay close
  document.querySelectorAll(".authModal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target !== modal) return;
      modal.classList.remove("active");
      if (modal.classList.contains("login")) clearForm("loginForm", ["loginEmail", "loginPassword"]);
      if (modal.classList.contains("signup")) clearForm("signupForm", ["signupName", "signupEmail", "signupPassword"]);
    });
  });

  // Switch links
  document.getElementById("switchToSignUp")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector(".authModal.login")?.classList.remove("active");
    document.querySelector(".authModal.signup")?.classList.add("active");
  });
  document.getElementById("switchToLogIn")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector(".authModal.signup")?.classList.remove("active");
    document.querySelector(".authModal.login")?.classList.add("active");
  });

  // Login form
  document
    .getElementById("loginForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.querySelector(".login_error");
      errEl.style.display = "none";
      try {
        const user = await logIn(
          document.getElementById("loginEmail").value,
          document.getElementById("loginPassword").value,
        );
        document.querySelector(".authModal.login")?.classList.remove("active");
        clearForm("loginForm", ["loginEmail", "loginPassword"]);
        errEl.style.display = "none";
        updateNavForUser(user);
        window.location.reload();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = "block";
      }
    });

  // Signup form
  document
    .getElementById("signupForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.querySelector(".signup_error");
      errEl.style.display = "none";
      try {
        const user = await signUp(
          document.getElementById("signupEmail").value,
          document.getElementById("signupPassword").value,
          document.getElementById("signupName").value,
        );
        document.querySelector(".authModal.signup")?.classList.remove("active");
        clearForm("signupForm", ["signupName", "signupEmail", "signupPassword"]);
        errEl.style.display = "none";
        updateNavForUser(user);
        window.location.reload();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = "block";
      }
    });
}

// ── Bootstrap (call on every page) ───────────────────────────────────────────

export function initAuth() {
  injectAuthModals();
  const user = getCurrentUser();
  updateNavForUser(user);

  // Wire up open-modal links (in case they exist in HTML)
  document.getElementById("openLogIn")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector(".authModal.login")?.classList.add("active");
  });
  document.getElementById("openSignUp")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector(".authModal.signup")?.classList.add("active");
  });
}

// ── Shared notification toast (replaces alert) ────────────────────────────────

export function showNotification(message, type = "success") {
  document.querySelector(".app_notification")?.remove();
  const el = document.createElement("div");
  el.className = `app_notification ${type}`;
  el.innerHTML = `
    <i class="fa-solid ${type === "success" ? "fa-circle-check" : type === "error" ? "fa-circle-xmark" : "fa-circle-info"}"></i>
    <span>${message}</span>
    <button class="app_notification_close"><i class="fa-solid fa-xmark"></i></button>`;
  el.querySelector(".app_notification_close").addEventListener("click", () =>
    el.remove(),
  );
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 4000);
}
// ── Custom confirm dialog ─────────────────────────────────────────────────────
export function showConfirm(
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  variant = "danger",  // "danger" = red, "warn" = neutral dark
) {
  return new Promise((resolve) => {
    document.querySelector(".app_confirm")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "app_confirm";
    overlay.innerHTML = `
      <div class="app_confirm_box">
        <p class="app_confirm_msg">${message}</p>
        <div class="app_confirm_actions">
          <button class="app_confirm_cancel">${cancelLabel}</button>
          <button class="app_confirm_ok ${variant}">${confirmLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector(".app_confirm_ok").addEventListener("click", () => {
      overlay.remove();
      resolve(true);
    });
    overlay
      .querySelector(".app_confirm_cancel")
      .addEventListener("click", () => {
        overlay.remove();
        resolve(false);
      });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
  });
}

// ── Custom prompt dialog ──────────────────────────────────────────────────────
export function showPrompt(message, defaultValue = "") {
  return new Promise((resolve) => {
    document.querySelector(".app_prompt")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "app_prompt";
    overlay.innerHTML = `
      <div class="app_confirm_box">
        <p class="app_confirm_msg">${message}</p>
        <input class="app_prompt_input input_field" type="text" value="${defaultValue}" />
        <div class="app_confirm_actions">
          <button class="app_prompt_cancel">Cancel</button>
          <button class="app_prompt_ok">Save</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector(".app_prompt_input");
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
    const confirmFn = () => {
      const val = input.value.trim();
      overlay.remove();
      resolve(val || null);
    };
    overlay
      .querySelector(".app_prompt_ok")
      .addEventListener("click", confirmFn);
    overlay
      .querySelector(".app_prompt_cancel")
      .addEventListener("click", () => {
        overlay.remove();
        resolve(null);
      });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirmFn();
      if (e.key === "Escape") {
        overlay.remove();
        resolve(null);
      }
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(null);
      }
    });
  });
}