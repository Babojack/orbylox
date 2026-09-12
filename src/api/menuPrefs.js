/**
 * Wo die Menü-Anordnung liegt.
 *
 * Im selben Dokument wie die übrigen persönlichen Einstellungen
 * (`UserProjectListPrefs/<uid>`), aber in eigenen Feldern und über einen
 * eigenen kleinen Zugang.
 *
 * WARUM NICHT DURCH DEN BESTEHENDEN HAKEN
 * `useProjectListPrefs` schreibt bei jedem Speichern ALLE seine Felder auf
 * einmal — Favoriten, Ausgeblendete, Fokus. Das ist dort mit gutem Grund so
 * (ein früherer Fehler überschrieb sonst den jeweils anderen Wert), macht
 * ihn aber zu einem Ort, an dem man nichts nebenbei ablegt. Die Anordnung
 * bekommt deshalb ihren eigenen Weg mit `merge: true`: Sie fasst die
 * fremden Felder nicht an, und der andere Weg fasst ihre nicht an.
 *
 * WARUM ÜBERHAUPT IN DIE CLOUD
 * Weil die Anordnung pro Person gilt und nicht pro Gerät. Wer sein Menü am
 * Rechner einrichtet, will am Telefon dasselbe sehen. Ohne Firebase (Demo,
 * lokal) bleibt es beim Browser-Speicher — dieselbe Schnittstelle, damit die
 * Seite überall läuft.
 */

import { doc, getDoc, setDoc } from "firebase/firestore";
import { hasFirebaseConfig } from "@/lib/firebase";
import { db } from "@/lib/firebaseData";
import { normalizeMenu, STANDARD_MENUE } from "@/lib/menuModules";

const COLLECTION = "UserProjectListPrefs";
const LOCAL_KEY = (email) => `orbylox_menu:${email || 'local'}`;

export function readLocalMenu(emailLower) {
  if (typeof window === "undefined") return STANDARD_MENUE;
  try {
    const roh = window.localStorage.getItem(LOCAL_KEY(emailLower));
    return roh ? normalizeMenu(JSON.parse(roh)) : normalizeMenu(null);
  } catch {
    return normalizeMenu(null);
  }
}

export function writeLocalMenu(emailLower, menu) {
  if (typeof window === "undefined") return;
  try {
    const sauber = normalizeMenu(menu);
    window.localStorage.setItem(LOCAL_KEY(emailLower), JSON.stringify(sauber));
  } catch {
    /* Speicher voll oder gesperrt — die Anordnung ist es nicht wert,
       deshalb etwas kaputtgehen zu lassen. */
  }
}

/**
 * Die Anordnung holen.
 *
 * Der Browser-Stand wird zuerst zurückgegeben (sofort da, kein Flackern),
 * die Cloud überschreibt ihn, sobald sie antwortet. Wer das Menü auf einem
 * anderen Gerät geändert hat, sieht die Änderung also beim nächsten Laden —
 * und nicht erst nach dem Abmelden.
 */
export async function fetchMenu(uid, emailLower) {
  const lokal = readLocalMenu(emailLower);
  if (!hasFirebaseConfig || !db || !uid) return lokal;

  try {
    const snap = await getDoc(doc(db, COLLECTION, uid));
    if (!snap.exists()) return lokal;
    const daten = snap.data();
    // Kein Feld heisst "nie etwas eingerichtet" — dann gilt der Browser-Stand
    // weiter, statt eine leere Cloud über eine vorhandene Anordnung zu legen.
    if (!Array.isArray(daten?.menu_order) && !Array.isArray(daten?.menu_hidden)) return lokal;
    const ausDerCloud = normalizeMenu({
      reihenfolge: daten.menu_order,
      versteckt: daten.menu_hidden,
    });
    writeLocalMenu(emailLower, ausDerCloud);
    return ausDerCloud;
  } catch (err) {
    console.warn("[menuPrefs] laden fehlgeschlagen", err?.message || err);
    return lokal;
  }
}

export async function saveMenu(uid, emailLower, menu) {
  const sauber = normalizeMenu(menu);
  writeLocalMenu(emailLower, sauber);
  if (!hasFirebaseConfig || !db || !uid) return sauber;

  // `userId` muss mit: Die Firestore-Regel für diese Sammlung verlangt sie im
  // geschriebenen Dokument, und beim allerersten Speichern gibt es das
  // Dokument noch nicht.
  await setDoc(
    doc(db, COLLECTION, uid),
    {
      userId: uid,
      menu_order: sauber.reihenfolge,
      menu_hidden: sauber.versteckt,
      updated_date: new Date().toISOString(),
    },
    { merge: true },
  );
  return sauber;
}
