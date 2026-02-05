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
    { id: 10, time: "17:00" }
];

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
export const COURSE_DURATION = 2; // Each course takes 2 hours (2 slots)

// Default constraints
export const DEFAULT_MIN_COURSES_PER_SLOT = 0;
export const DEFAULT_MAX_COURSES_PER_SLOT = 3;

// Programme colors
export const PROGRAMME_COLORS = {
    "Foundation": "#3498db",
    "Diploma": "#e74c3c",
    "Degree": "#2ecc71"
};

export const DEFAULT_COLORS = ["#3498db", "#e74c3c", "#2ecc71", "#f39c12", "#9b59b6"];