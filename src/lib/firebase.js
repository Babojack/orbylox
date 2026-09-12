import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const hasFirebaseConfig = !!firebaseConfig.apiKey;

if (!hasFirebaseConfig) {
  console.warn(
    "[Firebase] Missing VITE_FIREBASE_* env vars. Add them to .env in the project root and restart the dev server."
  );
}

const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
/**
 * Die Zaehlung wird NACH dem Aufbau nachgeladen.
 *
 * Sie misst Seitenaufrufe und wird von keiner Zeile der Anwendung gelesen —
 * ihre 10 kB im Startbuendel verzoegerten also nur das erste Bild. Als
 * nachgeladenes Modul im Leerlauf zaehlt sie genauso, nur spaeter.
 */
if (app && typeof window !== "undefined" && firebaseConfig.measurementId) {
  const spaeter = window.requestIdleCallback || ((fn) => setTimeout(fn, 2000));
  spaeter(() => {
    import("firebase/analytics")
      .then(({ getAnalytics }) => getAnalytics(app))
      .catch(() => {});
  });
}
const auth = app ? getAuth(app) : null;
/* Firestore und Dateispeicher stehen in `firebaseData.js` — sie werden
   erst nach dem Anmelden gebraucht und gehoeren nicht ins Startbuendel. */

const googleProvider = app ? new GoogleAuthProvider() : null;

export function mapFirebaseUser(fbUser) {
  if (!fbUser) return null;
  return {
    uid: fbUser.uid,
    email: fbUser.email || null,
    displayName: fbUser.displayName || null,
    full_name: fbUser.displayName || null,
    photoURL: fbUser.photoURL || null,
    avatar_url: fbUser.photoURL || null,
    emailVerified: fbUser.emailVerified,
    plan: fbUser.plan || "basic",
  };
}

export {
  app,
  auth,
  hasFirebaseConfig,
  googleProvider,
  signInWithPopup,
  firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
};
