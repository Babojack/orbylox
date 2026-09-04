import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
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
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

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
const analytics =
  app &&
  typeof window !== "undefined" &&
  firebaseConfig.measurementId
    ? getAnalytics(app)
    : null;
const auth = app ? getAuth(app) : null;
/**
 * Firestore mit dauerhaftem Cache im Geraetespeicher (IndexedDB).
 *
 * Vorher lief alles ueber den fluechtigen Speicher: jeder Seitenaufruf holte
 * jedes Dokument komplett neu vom Server. Jetzt liegt der Bestand lokal,
 * Firestore zieht nur noch Aenderungen nach — der zweite Aufruf ist sofort da,
 * und ohne Netz laesst sich weiter lesen und schreiben (wird spaeter
 * synchronisiert).
 *
 * Mehrere offene Tabs teilen sich den Cache ueber den Tab-Manager. Faellt
 * IndexedDB aus (privater Modus in manchen Browsern), springt der fluechtige
 * Speicher ein — die App laeuft dann wie bisher.
 */
function createDb(firebaseApp) {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (err) {
    console.warn("[Firestore] Dauerhafter Cache nicht verfuegbar, nutze Speicher:", err?.message || err);
    return initializeFirestore(firebaseApp, { localCache: memoryLocalCache() });
  }
}

const db = app ? createDb(app) : null;
const storage = app ? getStorage(app) : null;

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
  analytics,
  auth,
  db,
  storage,
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
