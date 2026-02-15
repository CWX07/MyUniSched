import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/css", express.static(path.join(__dirname, "../css")));
app.use("/js", express.static(path.join(__dirname, "../js")));
app.use("/img", express.static(path.join(__dirname, "../img")));
app.use("/html", express.static(path.join(__dirname, "../html")));

const lecturersCol = db.collection("lecturers");
const programmesCol = db.collection("programmes");
const coursesCol = db.collection("courses");

// ==================== HELPERS ====================

async function getNextId(collectionRef, idField, prefix) {
  const snapshot = await collectionRef.orderBy(idField, "desc").limit(1).get();
  if (snapshot.empty) {
    return `${prefix}1`;
  }
  const last = snapshot.docs[0].data()[idField];
  const number = parseInt(String(last).substring(prefix.length)) + 1;
  return `${prefix}${number}`;
}

// ==================== LECTURERS ====================

// GET -- Lecturers
app.get("/api/lecturers", async (req, res) => {
  try {
    const snapshot = await lecturersCol.orderBy("lecturer_id").get();
    const rows = snapshot.docs.map((doc) => doc.data());
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
    const newId = await getNextId(lecturersCol, "lecturer_id", "L");
    await lecturersCol.doc(newId).set({
      lecturer_id: newId,
      lecturer_name: lecturerName,
    });
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
    const docRef = lecturersCol.doc(oldLecturerId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Lecturer not found" });
    }

    await docRef.update({
      lecturer_name: lecturerName,
    });

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
    const snapshot = await programmesCol.orderBy("programme_id").get();
    const rows = snapshot.docs.map((doc) => doc.data());
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
    const newId = await getNextId(programmesCol, "programme_id", "P");
    await programmesCol.doc(newId).set({
      programme_id: newId,
      programme_name: programmeName,
      programme_level: programmeLevel,
      programme_year: programmeYear,
    });
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
    const docRef = programmesCol.doc(oldProgrammeId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Programme not found" });
    }

    await docRef.update({
      programme_name: programmeName,
      programme_level: programmeLevel,
      programme_year: programmeYear,
    });

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
    const coursesSnap = await coursesCol.orderBy("course_code").get();
    const courses = coursesSnap.docs.map((doc) => doc.data());

    const lecturerIds = [...new Set(courses.map((c) => c.lecturer_id).filter(Boolean))];
    const programmeIds = [...new Set(courses.map((c) => c.programme_id).filter(Boolean))];

    const lecturersMap = {};
    if (lecturerIds.length > 0) {
      const lecturerSnapshots = await Promise.all(
        lecturerIds.map((id) => lecturersCol.doc(id).get()),
      );
      lecturerSnapshots.forEach((snap) => {
        if (snap.exists) {
          lecturersMap[snap.id] = snap.data();
        }
      });
    }

    const programmesMap = {};
    if (programmeIds.length > 0) {
      const programmeSnapshots = await Promise.all(
        programmeIds.map((id) => programmesCol.doc(id).get()),
      );
      programmeSnapshots.forEach((snap) => {
        if (snap.exists) {
          programmesMap[snap.id] = snap.data();
        }
      });
    }

    const rows = courses.map((c) => {
      const lecturer = c.lecturer_id ? lecturersMap[c.lecturer_id] : null;
      const programme = c.programme_id ? programmesMap[c.programme_id] : null;
      return {
        course_code: c.course_code,
        course_name: c.course_name,
        lecturer_id: c.lecturer_id,
        programme_id: c.programme_id,
        lecturer_name: lecturer ? lecturer.lecturer_name : null,
        programme_name: programme ? programme.programme_name : null,
        programme_level: programme ? programme.programme_level : null,
        programme_year: programme ? programme.programme_year : null,
      };
    });

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
    const lecturerSnap = await lecturersCol.doc(lecturerId).get();
    if (!lecturerSnap.exists) {
      return res.status(400).json({
        error: `Lecturer ID '${lecturerId}' does not exist. Please add the lecturer first.`,
      });
    }

    const programmeSnap = await programmesCol.doc(programmeId).get();
    if (!programmeSnap.exists) {
      return res.status(400).json({
        error: `Programme ID '${programmeId}' does not exist. Please add the programme first.`,
      });
    }

    const newCode = await getNextId(coursesCol, "course_code", "C");
    await coursesCol.doc(newCode).set({
      course_code: newCode,
      course_name: courseName,
      lecturer_id: lecturerId,
      programme_id: programmeId,
    });

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
    const courseRef = coursesCol.doc(oldCourseCode);
    const courseSnap = await courseRef.get();
    if (!courseSnap.exists) {
      return res.status(404).json({ error: "Course not found" });
    }

    const lecturerSnap = await lecturersCol.doc(lecturerId).get();
    if (!lecturerSnap.exists) {
      return res.status(400).json({
        error: `Lecturer ID '${lecturerId}' does not exist. Please add the lecturer first.`,
      });
    }

    const programmeSnap = await programmesCol.doc(programmeId).get();
    if (!programmeSnap.exists) {
      return res.status(400).json({
        error: `Programme ID '${programmeId}' does not exist. Please add the programme first.`,
      });
    }

    await courseRef.update({
      course_name: courseName,
      lecturer_id: lecturerId,
      programme_id: programmeId,
    });

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// UptimeRobot Check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});


