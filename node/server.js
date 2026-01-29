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
app.use("/html", express.static(path.join(__dirname, "../html")));

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
            `SELECT 
                c.course_code, 
                c.course_name, 
                c.lecturer_id, 
                c.programme_name, 
                c.course_year,
                l.lecturer_name
            FROM courses c
            LEFT JOIN lecturers l ON c.lecturer_id = l.lecturer_id`
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
    const { courseCode, courseName, lecturerId, programmeName, courseYear } = req.body;

    console.log("Received POST:", req.body); // <--- debug

    if (!courseCode || !courseName || !lecturerId || !programmeName || !courseYear ) {
        return res.status(400).json({ error: "Missing fields" });
    }

    try {
        // Check if lecturer exists
        const [lecturer] = await pool.execute(
            "SELECT lecturer_id FROM lecturers WHERE lecturer_id = ?",
            [lecturerId]
        );

        if (lecturer.length === 0) {
            return res.status(400).json({ error: `Lecturer ID '${lecturerId}' does not exist. Please add the lecturer first.` });
        }

        await pool.execute(
            "INSERT INTO courses (course_code, course_name, lecturer_id, programme_name, course_year) VALUES (?, ?, ?, ?, ?)",
            [courseCode, courseName, lecturerId, programmeName, courseYear]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../index.html"));
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));