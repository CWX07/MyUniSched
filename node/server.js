import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./db.js";
import fetch from "node-fetch";

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

// Global timetables collection stays as-is (already uid-scoped by field)
const timetablesCol = db.collection("timetables");
const usersCol = db.collection("users");

// ==================== HELPERS ====================

/**
 * Returns per-user subcollection references.
 * Structure: users/{uid}/lecturers, users/{uid}/programmes, users/{uid}/courses
 */
function userCols(uid) {
  const userRef = usersCol.doc(uid);
  return {
    lecturers: userRef.collection("lecturers"),
    programmes: userRef.collection("programmes"),
    courses: userRef.collection("courses"),
    counters: userRef.collection("counters"),
  };
}

/**
 * Atomically increments a per-user counter and returns the next ID string.
 * Counter doc lives at: users/{uid}/counters/{type}
 * e.g. type="lecturers", prefix="L"  →  "L1", "L2", ...
 */
async function getNextId(uid, type, prefix) {
  const { counters } = userCols(uid);
  const counterRef = counters.doc(type);

  const newCount = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists ? snap.data().count : 0;
    const next = current + 1;
    tx.set(counterRef, { count: next }, { merge: true });
    return next;
  });

  return `${prefix}${newCount}`;
}

// ==================== AUTH ====================

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

async function firebaseAuthRequest(endpoint, payload) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// POST /api/auth/signup
app.post("/api/auth/signup", async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });

  try {
    const data = await firebaseAuthRequest("signUp", {
      email,
      password,
      returnSecureToken: true,
    });

    if (data.error) {
      return res
        .status(400)
        .json({
          error: friendlyAuthError(data.error.message || "Sign-up failed"),
        });
    }

    const uid = data.localId;
    const name = displayName || email.split("@")[0];

    await firebaseAuthRequest("update", {
      idToken: data.idToken,
      displayName: name,
      returnSecureToken: false,
    });

    await usersCol.doc(uid).set({
      uid,
      email,
      displayName: name,
      createdAt: new Date().toISOString(),
    });

    return res.json({
      user: { uid, email, displayName: name, idToken: data.idToken },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Server error during sign-up" });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });

  try {
    const data = await firebaseAuthRequest("signInWithPassword", {
      email,
      password,
      returnSecureToken: true,
    });

    if (data.error) {
      return res
        .status(401)
        .json({
          error: friendlyAuthError(data.error.message || "Login failed"),
        });
    }

    const uid = data.localId;
    const userDoc = await usersCol.doc(uid).get();
    const displayName = userDoc.exists
      ? userDoc.data().displayName
      : data.displayName || email.split("@")[0];

    if (!userDoc.exists) {
      await usersCol
        .doc(uid)
        .set({ uid, email, displayName, createdAt: new Date().toISOString() });
    }

    return res.json({
      user: { uid, email, displayName, idToken: data.idToken },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error during login" });
  }
});

function friendlyAuthError(msg) {
  if (msg.includes("EMAIL_EXISTS"))
    return "An account with this email already exists.";
  if (msg.includes("INVALID_EMAIL")) return "Invalid email address.";
  if (msg.includes("WEAK_PASSWORD"))
    return "Password must be at least 6 characters.";
  if (msg.includes("EMAIL_NOT_FOUND"))
    return "No account found with this email.";
  if (
    msg.includes("INVALID_PASSWORD") ||
    msg.includes("INVALID_LOGIN_CREDENTIALS")
  )
    return "Incorrect password.";
  if (msg.includes("TOO_MANY_ATTEMPTS"))
    return "Too many attempts. Please try again later.";
  return msg;
}

// ==================== TIMETABLES ====================
// Timetables stay in a global collection — they're already uid-scoped by field.

app.get("/api/timetables", async (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.status(400).json({ error: "uid required" });
  try {
    const snap = await timetablesCol
      .where("uid", "==", uid)
      .orderBy("savedAt", "desc")
      .get();
    const rows = snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, name: data.name, savedAt: data.savedAt };
    });
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/timetables/:id", async (req, res) => {
  try {
    const doc = await timetablesCol.doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Not found" });
    return res.json(doc.data());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/timetables", async (req, res) => {
  const { uid, name, timetable, constraints } = req.body;
  if (!uid || !timetable)
    return res.status(400).json({ error: "uid and timetable are required" });
  try {
    const docRef = timetablesCol.doc();
    const savedAt = new Date().toISOString();
    await docRef.set({
      uid,
      name: name || `Timetable ${savedAt.slice(0, 10)}`,
      timetable,
      constraints: constraints || {},
      savedAt,
    });
    return res.json({ success: true, id: docRef.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Database error" });
  }
});

app.delete("/api/timetables/:id", async (req, res) => {
  try {
    const doc = await timetablesCol.doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Not found" });
    await timetablesCol.doc(req.params.id).delete();
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Database error" });
  }
});

// ==================== LECTURERS ====================

app.get("/api/lecturers", async (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  try {
    const snapshot = await userCols(uid).lecturers.orderBy("lecturer_id").get();
    res.json(snapshot.docs.map((doc) => doc.data()));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/lecturers", async (req, res) => {
  const { lecturerName, uid } = req.body;
  if (!lecturerName || !uid)
    return res.status(400).json({ error: "Missing fields" });
  try {
    const newId = await getNextId(uid, "lecturers", "L");
    await userCols(uid).lecturers.doc(newId).set({
      lecturer_id: newId,
      lecturer_name: lecturerName,
    });
    res.json({ success: true, lecturer_id: newId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.put("/api/lecturers/:id", async (req, res) => {
  const { lecturerName, uid: bodyUid } = req.body;
  const uid = bodyUid || req.query.uid;
  if (!lecturerName || !uid)
    return res.status(400).json({ error: "Missing fields" });
  try {
    const docRef = userCols(uid).lecturers.doc(req.params.id);
    const snap = await docRef.get();
    if (!snap.exists)
      return res.status(404).json({ error: "Lecturer not found" });
    await docRef.update({ lecturer_name: lecturerName });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.delete("/api/lecturers/:id", async (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  try {
    const docRef = userCols(uid).lecturers.doc(req.params.id);
    const snap = await docRef.get();
    if (!snap.exists)
      return res.status(404).json({ error: "Lecturer not found" });
    await docRef.delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// ==================== PROGRAMMES ====================

app.get("/api/programmes", async (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  try {
    const snapshot = await userCols(uid)
      .programmes.orderBy("programme_id")
      .get();
    res.json(snapshot.docs.map((d) => d.data()));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/programmes", async (req, res) => {
  const { programmeName, programmeLevel, programmeYear, uid } = req.body;
  if (!programmeName || !programmeLevel || !programmeYear || !uid)
    return res.status(400).json({ error: "Missing fields" });
  try {
    const newId = await getNextId(uid, "programmes", "P");
    await userCols(uid).programmes.doc(newId).set({
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

app.put("/api/programmes/:id", async (req, res) => {
  const { programmeName, programmeLevel, programmeYear, uid: bodyUid } = req.body;
  const uid = bodyUid || req.query.uid;
  if (!programmeName || !programmeLevel || !programmeYear || !uid)
    return res.status(400).json({ error: "Missing fields" });
  try {
    const docRef = userCols(uid).programmes.doc(req.params.id);
    const snap = await docRef.get();
    if (!snap.exists)
      return res.status(404).json({ error: "Programme not found" });
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

app.delete("/api/programmes/:id", async (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  try {
    const docRef = userCols(uid).programmes.doc(req.params.id);
    const snap = await docRef.get();
    if (!snap.exists)
      return res.status(404).json({ error: "Programme not found" });
    await docRef.delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// ==================== COURSES ====================

app.get("/api/courses", async (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { courses, lecturers, programmes } = userCols(uid);

    const coursesSnap = await courses.orderBy("course_code").get();
    const courseData = coursesSnap.docs.map((doc) => doc.data());

    // Fetch all lecturers and programmes for this user in two reads
    const [lecturersSnap, programmesSnap] = await Promise.all([
      lecturers.get(),
      programmes.get(),
    ]);

    const lecturersMap = {};
    lecturersSnap.forEach((d) => {
      lecturersMap[d.id] = d.data();
    });

    const programmesMap = {};
    programmesSnap.forEach((d) => {
      programmesMap[d.id] = d.data();
    });

    const rows = courseData.map((c) => {
      const lecturer = c.lecturer_id ? lecturersMap[c.lecturer_id] : null;
      const programme = c.programme_id ? programmesMap[c.programme_id] : null;
      return {
        course_code: c.course_code,
        course_name: c.course_name,
        lecturer_id: c.lecturer_id,
        programme_id: c.programme_id,
        lecturer_name: lecturer?.lecturer_name ?? null,
        programme_name: programme?.programme_name ?? null,
        programme_level: programme?.programme_level ?? null,
        programme_year: programme?.programme_year ?? null,
        duration_hours: c.duration_hours || 2,
      };
    });

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/courses", async (req, res) => {
  const { courseName, lecturerId, programmeId, durationHours, uid } = req.body;
  if (!courseName || !lecturerId || !programmeId || !uid)
    return res.status(400).json({ error: "Missing fields" });

  try {
    const { lecturers, programmes, courses } = userCols(uid);

    // Validate that the lecturer and programme belong to this user
    const [lecturerSnap, programmeSnap] = await Promise.all([
      lecturers.doc(lecturerId).get(),
      programmes.doc(programmeId).get(),
    ]);

    if (!lecturerSnap.exists)
      return res
        .status(400)
        .json({ error: `Lecturer ID '${lecturerId}' does not exist.` });
    if (!programmeSnap.exists)
      return res
        .status(400)
        .json({ error: `Programme ID '${programmeId}' does not exist.` });

    const newCode = await getNextId(uid, "courses", "C");
    await courses.doc(newCode).set({
      course_code: newCode,
      course_name: courseName,
      lecturer_id: lecturerId,
      programme_id: programmeId,
      duration_hours: Number(durationHours) || 2,
    });
    res.json({ success: true, course_code: newCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.put("/api/courses/:id", async (req, res) => {
  const { courseName, lecturerId, programmeId, durationHours, uid: bodyUid } = req.body;
  const uid = bodyUid || req.query.uid;
  if (!courseName || !lecturerId || !programmeId || !uid)
    return res.status(400).json({ error: "Missing fields" });

  try {
    const { lecturers, programmes, courses } = userCols(uid);

    const [courseSnap, lecturerSnap, programmeSnap] = await Promise.all([
      courses.doc(req.params.id).get(),
      lecturers.doc(lecturerId).get(),
      programmes.doc(programmeId).get(),
    ]);

    if (!courseSnap.exists)
      return res.status(404).json({ error: "Course not found" });
    if (!lecturerSnap.exists)
      return res
        .status(400)
        .json({ error: `Lecturer ID '${lecturerId}' does not exist.` });
    if (!programmeSnap.exists)
      return res
        .status(400)
        .json({ error: `Programme ID '${programmeId}' does not exist.` });

    await courses.doc(req.params.id).update({
      course_name: courseName,
      lecturer_id: lecturerId,
      programme_id: programmeId,
      duration_hours: Number(durationHours) || 2,
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.delete("/api/courses/:id", async (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  try {
    const docRef = userCols(uid).courses.doc(req.params.id);
    const snap = await docRef.get();
    if (!snap.exists)
      return res.status(404).json({ error: "Course not found" });
    await docRef.delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// ==================== STATIC / ROOT ====================

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "../index.html")));
app.get("/index.html", (req, res) =>
  res.sendFile(path.join(__dirname, "../index.html")),
);
app.get("/health", (req, res) => res.status(200).send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));