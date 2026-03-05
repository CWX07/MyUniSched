// ── Shared entity detail drawer ───────────────────────────────────────────────

export function openDrawer(html) {
  const drawer   = document.getElementById("entityDrawer");
  const backdrop = document.getElementById("entityDrawerBackdrop");
  const content  = document.getElementById("entityDrawerContent");

  content.innerHTML = html;
  drawer.classList.add("open");
  backdrop.classList.add("open");
  document.body.style.overflow = "hidden";
}

export function closeDrawer() {
  const drawer   = document.getElementById("entityDrawer");
  const backdrop = document.getElementById("entityDrawerBackdrop");

  drawer.classList.remove("open");
  backdrop.classList.remove("open");
  document.body.style.overflow = "";
}

export function initDrawer() {
  document.getElementById("entityDrawerClose")
    ?.addEventListener("click", closeDrawer);
  document.getElementById("entityDrawerBackdrop")
    ?.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });
}

// Generate a consistent color from a string (for avatars)
export function avatarColor(str = "") {
  const colors = [
    "#6366f1","#8b5cf6","#ec4899","#f59e0b",
    "#10b981","#3b82f6","#ef4444","#14b8a6",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function avatarInitials(name = "") {
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() || "").slice(0, 2).join("");
}