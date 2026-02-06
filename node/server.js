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

// ==================== LECTURERS ====================

// GET -- Lecturers
app.get("/api/lecturers", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM lecturers ORDER BY lecturer_id",
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST -- Lecturers (Auto-generate ID)
app.post("/api/lecturers", async (req, res) => {
  const { lecturerName } = req.body;

  console.log("Received POST:", req.body);

  if (!lecturerName) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    // Get the highest lecturer ID to generate next one
    const [rows] = await pool.execute(
      "SELECT lecturer_id FROM lecturers ORDER BY lecturer_id DESC LIMIT 1",
    );

    let newId;
    if (rows.length === 0) {
      newId = "L1";
    } else {
      const lastId = rows[0].lecturer_id;
      const number = parseInt(lastId.substring(1)) + 1;
      newId = `L${number}`;
    }

    await pool.execute(
      "INSERT INTO lecturers (lecturer_id, lecturer_name) VALUES (?, ?)",
      [newId, lecturerName],
    );
    res.json({ success: true, lecturer_id: newId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// PUT -- Update Lecturer
app.put("/api/lecturers/:id", async (req, res) => {
  const oldLecturerId = req.params.id;
  const { lecturerName } = req.body;

  console.log("Received PUT:", req.body);

  if (!lecturerName) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    // Check if lecturer exists
    const [existing] = await pool.execute(
      "SELECT lecturer_id FROM lecturers WHERE lecturer_id = ?",
      [oldLecturerId],
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Lecturer not found" });
    }

    // Update lecturer
    await pool.execute(
      "UPDATE lecturers SET lecturer_name = ? WHERE lecturer_id = ?",
      [lecturerName, oldLecturerId],
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// ==================== PROGRAMMES ====================

// GET -- Programmes
app.get("/api/programmes", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM programmes ORDER BY programme_id",
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST -- Programmes (Auto-generate ID)
app.post("/api/programmes", async (req, res) => {
  const { programmeName, programmeLevel, programmeYear } = req.body;

  console.log("Received POST:", req.body);

  if (!programmeName || !programmeLevel || !programmeYear) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    // Get the highest programme ID to generate next one
    const [rows] = await pool.execute(
      "SELECT programme_id FROM programmes ORDER BY programme_id DESC LIMIT 1",
    );

    let newId;
    if (rows.length === 0) {
      newId = "P1";
    } else {
      const lastId = rows[0].programme_id;
      const number = parseInt(lastId.substring(1)) + 1;
      newId = `P${number}`;
    }

    await pool.execute(
      "INSERT INTO programmes (programme_id, programme_name, programme_level, programme_year) VALUES (?, ?, ?, ?)",
      [newId, programmeName, programmeLevel, programmeYear],
    );
    res.json({ success: true, programme_id: newId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// PUT -- Update Programme
app.put("/api/programmes/:id", async (req, res) => {
  const oldProgrammeId = req.params.id;
  const { programmeName, programmeLevel, programmeYear } = req.body;

  console.log("Received PUT:", req.body);

  if (!programmeName || !programmeLevel || !programmeYear) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    // Check if programme exists
    const [existing] = await pool.execute(
      "SELECT programme_id FROM programmes WHERE programme_id = ?",
      [oldProgrammeId],
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Programme not found" });
    }

    // Update programme
    await pool.execute(
      "UPDATE programmes SET programme_name = ?, programme_level = ?, programme_year = ? WHERE programme_id = ?",
      [programmeName, programmeLevel, programmeYear, oldProgrammeId],
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// ==================== COURSES ====================

// GET -- Courses
app.get("/api/courses", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT 
                c.course_code, 
                c.course_name, 
                c.lecturer_id, 
                c.programme_id,
                l.lecturer_name,
                p.programme_name,
                p.programme_level,
                p.programme_year
            FROM courses c
            LEFT JOIN lecturers l ON c.lecturer_id = l.lecturer_id
            LEFT JOIN programmes p ON c.programme_id = p.programme_id
            ORDER BY c.course_code`,
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST -- Courses (Auto-generate ID)
app.post("/api/courses", async (req, res) => {
  const { courseName, lecturerId, programmeId } = req.body;

  console.log("Received POST:", req.body);

  if (!courseName || !lecturerId || !programmeId) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    // Check if lecturer exists
    const [lecturer] = await pool.execute(
      "SELECT lecturer_id FROM lecturers WHERE lecturer_id = ?",
      [lecturerId],
    );

    if (lecturer.length === 0) {
      return res.status(400).json({
        error: `Lecturer ID '${lecturerId}' does not exist. Please add the lecturer first.`,
      });
    }

    // Check if programme exists
    const [programme] = await pool.execute(
      "SELECT programme_id FROM programmes WHERE programme_id = ?",
      [programmeId],
    );

    if (programme.length === 0) {
      return res.status(400).json({
        error: `Programme ID '${programmeId}' does not exist. Please add the programme first.`,
      });
    }

    // Get the highest course code to generate next one
    const [rows] = await pool.execute(
      "SELECT course_code FROM courses ORDER BY course_code DESC LIMIT 1",
    );

    let newCode;
    if (rows.length === 0) {
      newCode = "C1";
    } else {
      const lastCode = rows[0].course_code;
      const number = parseInt(lastCode.substring(1)) + 1;
      newCode = `C${number}`;
    }

    await pool.execute(
      "INSERT INTO courses (course_code, course_name, lecturer_id, programme_id) VALUES (?, ?, ?, ?)",
      [newCode, courseName, lecturerId, programmeId],
    );
    res.json({ success: true, course_code: newCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// PUT -- Update Course
app.put("/api/courses/:id", async (req, res) => {
  const oldCourseCode = req.params.id;
  const { courseName, lecturerId, programmeId } = req.body;

  console.log("Received PUT:", req.body);

  if (!courseName || !lecturerId || !programmeId) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    // Check if course exists
    const [existing] = await pool.execute(
      "SELECT course_code FROM courses WHERE course_code = ?",
      [oldCourseCode],
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Check if lecturer exists
    const [lecturer] = await pool.execute(
      "SELECT lecturer_id FROM lecturers WHERE lecturer_id = ?",
      [lecturerId],
    );

    if (lecturer.length === 0) {
      return res.status(400).json({
        error: `Lecturer ID '${lecturerId}' does not exist. Please add the lecturer first.`,
      });
    }

    // Check if programme exists
    const [programme] = await pool.execute(
      "SELECT programme_id FROM programmes WHERE programme_id = ?",
      [programmeId],
    );

    if (programme.length === 0) {
      return res.status(400).json({
        error: `Programme ID '${programmeId}' does not exist. Please add the programme first.`,
      });
    }

    // Update course
    await pool.execute(
      "UPDATE courses SET course_name = ?, lecturer_id = ?, programme_id = ? WHERE course_code = ?",
      [courseName, lecturerId, programmeId, oldCourseCode],
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

app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../index.html"));
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
