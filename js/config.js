// Shared configuration for MyUniSched

// Backend API base URL.
// For local dev, you can leave this as "" and rely on relative paths.
// For production (GitHub Pages + Render backend), set this in HTML
// via a global variable if needed, or hard-code your Render URL here.
export const API_BASE =
  window.MYUNISCHED_API_BASE || "https://myunisched.onrender.com";

// Time slots configuration (1-hour slots, but courses take 2 hours)
export const TIME_SLOTS = [
  { id: 1, time: "08:00" },
  { id: 2, time: "09:00" },
  { id: 3, time: "10:00" },
  { id: 4, time: "11:00" },
  { id: 5, time: "12:00" },
  { id: 6, time: "13:00" },
  { id: 7, time: "14:00" },
  { id: 8, time: "15:00" },
  { id: 9, time: "16:00" },
  { id: 10, time: "17:00" },
];

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
export const COURSE_DURATION = 2; // Each course takes 2 hours (2 slots)

// Default constraints
export const DEFAULT_MIN_COURSES_PER_SLOT = 0;
export const DEFAULT_MAX_COURSES_PER_SLOT = 3;
export const DEFAULT_MAX_SLOTS_PER_COURSE_PER_DAY = 2;

// Programme colors
export const PROGRAMME_COLORS = {
  Foundation: "#3498db",
  Diploma: "#e74c3c",
  Degree: "#2ecc71",
};

export const DEFAULT_COLORS = [
  "#3b82f6", // Bright Blue
  "#ff0000", // Bright Red
  "#10b981", // Emerald Green
  "#f59e0b", // Amber/Orange
  "#8b5cf6", // Violet Purple
  "#ffabd5", // Pink
  "#06b6d4", // Cyan
  "#84cc16", // Lime Green
  "#f97316", // Deep Orange
  "#6366f1", // Indigo
  "#14b8a6", // Teal
  "#eab308", // Yellow
  "#a855f7", // Purple
  "#fb923c", // Light Orange
  "#22d3ee", // Light Cyan
];

// Shared color mapping - single source of truth for consistent colors
const programmeColorMap = new Map();

/**
 * Get consistent color for a programme across the entire application
 * @param {string} programme_level - Programme level (e.g., "Degree")
 * @param {string} programme_name - Programme name (e.g., "Software Engineering")
 * @param {string|number} programme_year - Programme year
 * @returns {string} - Hex color code
 */
export function getProgrammeColor(programme_level, programme_name, programme_year) {
  const key = `${programme_level}_${programme_name}_${programme_year}`;

  if (!programmeColorMap.has(key)) {
    const index = programmeColorMap.size % DEFAULT_COLORS.length;
    programmeColorMap.set(key, DEFAULT_COLORS[index]);
  }

  return programmeColorMap.get(key);
}

/**
 * Reset the color mapping (useful for testing or fresh starts)
 */
export function resetProgrammeColors() {
  programmeColorMap.clear();
}
