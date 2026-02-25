// node/populate.js — seed per‑user Firestore subcollections
import { db } from "./db.js";

// testuser1 UID
const TEST_UID = "oxdiBzOCVKR2mPyUG82Mw11PsRI3";

function userCols(uid) {
  const userRef = db.collection("users").doc(uid);
  return {
    lecturers: userRef.collection("lecturers"),
    programmes: userRef.collection("programmes"),
    courses: userRef.collection("courses"),
    counters: userRef.collection("counters"),
  };
}

async function setCounter(uid, type, count) {
  const { counters } = userCols(uid);
  await counters.doc(type).set({ count });
}

async function clearUserData(uid) {
  const { lecturers, programmes, courses, counters } = userCols(uid);

  const collections = [lecturers, programmes, courses, counters];
  for (const col of collections) {
    const snap = await col.get();
    const batch = db.batch();
    snap.forEach((doc) => batch.delete(doc.ref));
    if (!snap.empty) {
      await batch.commit();
    }
  }
}

async function main() {
  try {
    console.log("Clearing existing data for user", TEST_UID, "...");
    await clearUserData(TEST_UID);

    const { lecturers, programmes, courses } = userCols(TEST_UID);

    // 1) Create 15 lecturers under users/{uid}/lecturers
    console.log("Creating lecturers...");
    const lecturerIds = [];
    for (let i = 1; i <= 15; i++) {
      const id = `L${i}`;
      lecturerIds.push(id);
      await lecturers.doc(id).set({
        lecturer_id: id,
        lecturer_name: `Test Lecturer ${i}`,
        createdAt: new Date().toISOString(),
      });
    }
    await setCounter(TEST_UID, "lecturers", lecturerIds.length);

    // 2) Create 8 programmes under users/{uid}/programmes
    console.log("Creating programmes...");
    const levels = ["Foundation", "Diploma", "Degree", "Master"];
    const programmesList = [];
    for (let i = 1; i <= 8; i++) {
      const id = `P${i}`;
      const level = levels[(i - 1) % levels.length];
      const year = ((i - 1) % 3) + 1;
      const name = `Test Programme ${i}`;
      programmesList.push({ id, level, name, year });
      await programmes.doc(id).set({
        programme_id: id,
        programme_name: name,
        programme_level: level,
        programme_year: year,
        createdAt: new Date().toISOString(),
      });
    }
    await setCounter(TEST_UID, "programmes", programmesList.length);

    // 3) Create courses: 4–5 per programme
    console.log("Creating courses (4–5 per programme)...");
    let courseIndex = 1;
    for (let i = 0; i < programmesList.length; i += 1) {
      const programme = programmesList[i];
      const coursesPerProgramme = i % 2 === 0 ? 4 : 5; // alternate 4 and 5

      for (let j = 0; j < coursesPerProgramme; j += 1) {
        const code = `C${courseIndex}`;
        courseIndex += 1;

        const lecturer =
          lecturerIds[Math.floor(Math.random() * lecturerIds.length)];
        const durationHours = [1, 2, 3][Math.floor(Math.random() * 3)];

        await courses.doc(code).set({
          course_code: code,
          course_name: `Test Course ${code}`,
          lecturer_id: lecturer,
          programme_id: programme.id,
          duration_hours: durationHours,
          createdAt: new Date().toISOString(),
        });
      }
    }
    const totalCourses = courseIndex - 1;
    await setCounter(TEST_UID, "courses", totalCourses);

    console.log(
      "Seeding complete for user",
      TEST_UID,
      `: 15 lecturers, 8 programmes, ${totalCourses} courses.`,
    );
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

main();
