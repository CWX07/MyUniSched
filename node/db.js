import admin from "firebase-admin";

/**
 * Initialise Firebase Admin SDK for Firestore.
 *
 * This version is Render‑friendly: it reads credentials
 * from environment variables instead of a local JSON file.
 *
 * Required env vars (Render Dashboard → Environment):
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY (paste key with \n escaped, e.g. \\n)
 */

if (!admin.apps.length) {
  try {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } =
      process.env;

    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
      throw new Error(
        "Missing Firebase env vars. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.",
      );
    }

    const privateKey = FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  } catch (err) {
    console.error("Failed to initialize Firebase Admin SDK:", err);
    throw err;
  }
}

export const db = admin.firestore();
