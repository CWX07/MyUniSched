// node/migrate-user-data.js
import admin from "firebase-admin";
import { db } from "./db.js"; // uses your env-based config

// EDIT these emails
const OLD_EMAIL = "alex123@gmail.com";
const NEW_EMAIL = "testuser1@gmail.com";

async function main() {
  try {
    // 1. Get UIDs from emails
    const oldUser = await admin.auth().getUserByEmail(OLD_EMAIL);
    const newUser = await admin.auth().getUserByEmail(NEW_EMAIL);

    const oldUid = oldUser.uid;
    const newUid = newUser.uid;

    console.log(`Old UID: ${oldUid}`);
    console.log(`New UID: ${newUid}`);

    // 2. Copy timetables
    const ttSnap = await db
      .collection("timetables")
      .where("uid", "==", oldUid)
      .get();

    console.log(`Found ${ttSnap.size} timetables to migrate...`);

    const batch = db.batch();
    ttSnap.forEach((doc) => {
      const data = doc.data();
      const newRef = db.collection("timetables").doc(); // new ID
      batch.set(newRef, {
        ...data,
        uid: newUid,
        migratedFrom: oldUid,
        migratedAt: new Date().toISOString(),
      });
    });

    // 3. Copy user profile doc (if any)
    const oldUserDocRef = db.collection("users").doc(oldUid);
    const oldUserDoc = await oldUserDocRef.get();
    if (oldUserDoc.exists) {
      const newUserDocRef = db.collection("users").doc(newUid);
      const data = oldUserDoc.data();
      batch.set(newUserDocRef, {
        ...data,
        uid: newUid,
        email: NEW_EMAIL,
        migratedFrom: oldUid,
        migratedAt: new Date().toISOString(),
      });
      console.log("Will copy user profile document.");
    } else {
      console.log("No user profile document for old UID; skipping.");
    }

    await batch.commit();
    console.log("Migration complete.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

main();