import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// Uses GOOGLE_APPLICATION_CREDENTIALS env var or falls back to project ID only
if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // If service account JSON is provided as env var
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Fallback: initialize with just project ID (works for ID token verification)
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'onmovie-944fa',
    });
  }
}

export const firebaseAdmin = admin;
export const firebaseAuth = admin.auth();
