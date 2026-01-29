import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/css", express.static(path.join(__dirname, "../css")));
app.use("/js", express.static(path.join(__dirname, "../js")));
app.use("/img", express.static(path.join(__dirname, "../img")));
app.use("/", express.static(path.join(__dirname, "../docs")));

// GET -- Lecturers
app.get("/api/lecturers", async (req, res) => {
    try {
        const [rows] = await pool.execute(
        "SELECT * FROM lecturers"
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});


// GET -- Courses
app.get("/api/courses", async (req, res) => {
    try {
        const [rows] = await pool.execute(
        "SELECT * FROM courses"
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// POST -- Lecturers
app.post("/api/lecturers", async (req, res) => {
    const { lecturerId, lecturerName } = req.body;

    console.log("Received POST:", req.body); // <--- debug

    if (!lecturerId || !lecturerName) {
        return res.status(400).json({ error: "Missing fields" });
    }

    try {
        await pool.execute(
        "INSERT INTO lecturers (lecturer_id, lecturer_name) VALUES (?, ?)",
        [lecturerId, lecturerName]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// POST -- Courses
app.post("/api/courses", async (req, res) => {
    const { courseCode, courseName, lecturerId, courseYear, courseSemester } = req.body;

    console.log("Received POST:", req.body); // <--- debug

    if (!courseCode || !courseName || !lecturerId || !courseYear || !courseSemester) {
        return res.status(400).json({ error: "Missing fields" });
    }

    try {
        await pool.execute(
        "INSERT INTO courses (course_code, course_name, lecturer_id, course_year, course_semester) VALUES (?, ?, ?, ?, ?)",
        [courseCode, courseName, lecturerId, courseYear, courseSemester]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../docs/index.html"));
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));