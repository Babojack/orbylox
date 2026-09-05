import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db, hasFirebaseConfig } from "@/lib/firebase";

/**
 * Kontaktpflege — persönliche Einstellung, nicht projektgebunden.
 *
 * Liegt im selben Dokument wie die Projektlisten-Vorlieben
 * (UserProjectListPrefs/{uid}), unter dem Feld `contact_care`. Grund: die
 * Firestore-Regeln erlauben dem Nutzer dort bereits Lesen und Schreiben —
 * eine neue Sammlung hätte einen neuen Regel-Deploy erfordert.
 *
 * Ohne Firebase (Demo/lokal) landet alles im localStorage.
 */

const COLLECTION = "UserProjectListPrefs";
const LOCAL_KEY = (email) => `orbylox_contact_care:${email}`;

export const CONTACT_CARE_DEFAULTS = Object.freeze({
  enabled: false,
  intervalDays: 7,
  lastDoneAt: null,
  log: [],
  // Wird mitgespeichert, damit der Cron-Job auf dem Server weiss, wohin die
  // Vorschlags-Mail gehen soll. Firestore kennt dort keinen angemeldeten
  // Nutzer und kommt an die Firebase-Anmeldedaten nicht heran.
  email: '',
});

export const INTERVAL_CHOICES = [1, 2, 3, 7, 14, 30];
const MAX_LOG = 30;

export function parseContactCare(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  const interval = Number(d.interval_days);
  return {
    enabled: !!d.enabled,
    intervalDays: Number.isFinite(interval) && interval >= 1 ? Math.min(interval, 365) : 7,
    lastDoneAt: typeof d.last_done_at === "string" ? d.last_done_at : null,
    email: typeof d.email === "string" ? d.email : "",
    log: Array.isArray(d.log)
      ? d.log
          .filter((e) => e && typeof e.at === "string" && Array.isArray(e.names))
          .slice(-MAX_LOG)
      : [],
  };
}

function toDoc(prefs) {
  return {
    enabled: !!prefs.enabled,
    interval_days: prefs.intervalDays,
    last_done_at: prefs.lastDoneAt,
    log: (prefs.log || []).slice(-MAX_LOG),
    email: String(prefs.email || "").toLowerCase(),
  };
}

function readLocal(email) {
  if (!email || typeof window === "undefined") return { ...CONTACT_CARE_DEFAULTS };
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY(email));
    return raw ? parseContactCare(JSON.parse(raw)) : { ...CONTACT_CARE_DEFAULTS };
  } catch {
    return { ...CONTACT_CARE_DEFAULTS };
  }
}

function writeLocal(email, prefs) {
  if (!email || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_KEY(email), JSON.stringify(toDoc(prefs)));
  } catch {
    /* Speicher voll oder gesperrt — dann eben nur die Cloud */
  }
}

export async function fetchContactCare(uid, email) {
  const local = readLocal(email);
  if (!hasFirebaseConfig || !db || !uid) return local;
  try {
    const snap = await getDoc(doc(db, COLLECTION, uid));
    if (!snap.exists() || !snap.data()?.contact_care) return local;
    const remote = parseContactCare(snap.data().contact_care);
    writeLocal(email, remote);
    return remote;
  } catch (err) {
    console.warn("[contactCare] fetch", err?.message || err);
    return local;
  }
}

export async function saveContactCare(uid, email, prefs) {
  // E-Mail immer mitschreiben — der Server braucht sie fuer den Versand.
  const next = parseContactCare(toDoc({ ...prefs, email: prefs.email || email || "" }));
  writeLocal(email, next);
  if (!hasFirebaseConfig || !db || !uid) return next;
  await setDoc(
    doc(db, COLLECTION, uid),
    { userId: uid, contact_care: toDoc(next), updated_date: new Date().toISOString() },
    { merge: true },
  );
  return next;
}

export function subscribeContactCare(uid, email, onChange) {
  if (!hasFirebaseConfig || !db || !uid) return () => {};
  return onSnapshot(
    doc(db, COLLECTION, uid),
    (snap) => {
      if (!snap.exists() || !snap.data()?.contact_care) return;
      const parsed = parseContactCare(snap.data().contact_care);
      writeLocal(email, parsed);
      onChange(parsed);
    },
    (err) => console.warn("[contactCare] snapshot", err?.message || err),
  );
}

/** Ist die Erinnerung fällig? */
export function isContactCareDue(prefs, now = Date.now()) {
  if (!prefs?.enabled) return false;
  if (!prefs.lastDoneAt) return true;
  const last = new Date(prefs.lastDoneAt).getTime();
  if (!Number.isFinite(last)) return true;
  return now - last >= prefs.intervalDays * 86400000;
}

/** Wann ist es das nächste Mal so weit? */
export function nextContactCareAt(prefs) {
  if (!prefs?.enabled || !prefs.lastDoneAt) return null;
  const last = new Date(prefs.lastDoneAt).getTime();
  if (!Number.isFinite(last)) return null;
  return new Date(last + prefs.intervalDays * 86400000);
}
