import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyAlmyAlnOZpSy2DgttEkLkzb1TPmMR8W9M",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "orbylox.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "orbylox",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "orbylox.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "506677939965",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:506677939965:web:9829189c145834a5453894",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "G-RB4QV5X99F",
};

const app = initializeApp(firebaseConfig);
const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, analytics, auth, db, storage };
