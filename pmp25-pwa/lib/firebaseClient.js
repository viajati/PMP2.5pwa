import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseMissingConfig = Object.entries(firebaseConfig)
  .filter(([key]) => key !== "measurementId")
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const isFirebaseConfigured = firebaseMissingConfig.length === 0;
export const isFacebookLoginEnabled =
  process.env.NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN === "true";

export const firebaseApp = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const firestoreDb = firebaseApp ? getFirestore(firebaseApp) : null;

export function assertFirebaseConfigured() {
  if (!isFirebaseConfigured || !firebaseAuth || !firestoreDb) {
    throw new Error(
      `Firebase is not configured. Missing: ${firebaseMissingConfig.join(", ")}`
    );
  }
}
