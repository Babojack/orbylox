import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { hasFirebaseConfig } from "@/lib/firebase";
import { db } from "@/lib/firebaseData";
import {
  readLocalProjectListPrefs,
  writeLocalProjectListPrefs,
  hasAdoptedLocalPrefs,
  markLocalPrefsAdopted,
} from "@/lib/projectListPrefsLocal";
import { normalizeFocusLock } from "@/lib/focusDay";

const COLLECTION = "UserProjectListPrefs";

export function normalizeProjectIdList(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.filter((x) => typeof x === "string" && x))];
}

/**
 * Wann war jemand zuletzt im Fokus auf einem Projekt?
 *
 * Eine Zuordnung Projektkennung -> Zeitpunkt. Bewusst hier und nicht am
 * Projekt selbst: Es ist eine persoenliche Angabe. Ob ein Kollege gestern
 * konzentriert an demselben Projekt sass, geht niemanden etwas an — und am
 * Projekt gespeichert wuerde jeder Fokus einen Schreibvorgang ausloesen, den
 * alle anderen mitbekommen.
 */
function normalizeFocusLog(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [id, when] of Object.entries(raw)) {
    if (typeof id === "string" && id && typeof when === "string" && when) {
      out[id] = when;
    }
  }
  return out;
}

export function parsePrefsDoc(data) {
  return {
    favoriteIds: normalizeProjectIdList(data?.favorite_project_ids),
    hiddenIds: normalizeProjectIdList(data?.hidden_project_ids),
    focusLog: normalizeFocusLog(data?.focus_log),
    /**
     * Wann jemand ein Projekt zuletzt GEOEFFNET hat.
     *
     * Dieselbe Form wie `focus_log` und aus demselben Grund hier und nicht am
     * Projekt: Es ist eine persoenliche Angabe. Gebraucht wird sie fuer die
     * Vorschlaege in `projectNeglect.js` — welche Projekte lange nichts von
     * einem gehoert haben.
     */
    openLog: normalizeFocusLog(data?.open_log),
    /** Tagesschluessel, an dem das Band der Liegengebliebenen weggeklickt wurde. */
    neglectDismissed: typeof data?.neglect_dismissed === 'string' ? data.neglect_dismissed : null,
    // Solange falsch, pulsiert der Hinweis am Fokus-Knopf.
    focusSeen: data?.focus_seen === true,
    /**
     * Die Tagessperre. Sie steht mit im Dokument, damit der Fokus auf allen
     * Geraeten derselbe ist: Wer am Rechner ein Projekt fuer heute waehlt,
     * findet am Telefon nicht wieder die volle Liste vor.
     */
    focusLock: normalizeFocusLock(data?.focus_lock),
  };
}

const EMPTY_PREFS = {
  favoriteIds: [],
  hiddenIds: [],
  focusLog: {},
  focusSeen: false,
  focusLock: null,
  openLog: {},
  neglectDismissed: null,
};

export async function saveProjectListPrefs(uid, userEmailLower, prefs) {
  const favoriteIds = normalizeProjectIdList(prefs.favoriteIds);
  const hiddenIds = normalizeProjectIdList(prefs.hiddenIds);
  const focusLog = normalizeFocusLog(prefs.focusLog);
  const focusSeen = prefs.focusSeen === true;
  const focusLock = normalizeFocusLock(prefs.focusLock);
  /**
   * `openLog` steht ABSICHTLICH nicht in dieser Liste.
   *
   * Wer hier speichert, schreibt immer den vollständigen Stand — das war die
   * Lehre aus dem verlorenen Favoriten-Klick (siehe `useProjectListPrefs`).
   * Genau deshalb darf die Besuchsmitschrift nicht mitgeschrieben werden: Sie
   * wächst an einer anderen Stelle weiter (`merkeBesuch`, aufgerufen beim
   * Öffnen eines Projekts), und ein Vollstand-Schreiber mit einem Stand von
   * vor zwei Sekunden würde den frischen Besuch stillschweigend wegwerfen.
   * Firestore mischt verschachtelte Felder bei `merge: true` einzeln — solange
   * niemand das ganze Feld überschreibt, kommen sich beide nicht ins Gehege.
   */
  const next = { favoriteIds, hiddenIds, focusLog, focusSeen, focusLock };
  writeLocalProjectListPrefs(userEmailLower, next);

  if (!hasFirebaseConfig || !db || !uid) {
    return next;
  }

  const ref = doc(db, COLLECTION, uid);
  await setDoc(
    ref,
    {
      userId: uid,
      favorite_project_ids: favoriteIds,
      hidden_project_ids: hiddenIds,
      focus_log: focusLog,
      focus_seen: focusSeen,
      focus_lock: focusLock,
      updated_date: new Date().toISOString(),
    },
    { merge: true },
  );
  // Ab jetzt existiert das Dokument. Der Browser-Stand ist damit uebernommen
  // und darf nie wieder als eigene Quelle gelten.
  markLocalPrefsAdopted(userEmailLower);
  return next;
}

/**
 * Cloud-Stand holen — und den Browser-Stand hoechstens EINMAL uebernehmen.
 *
 * Vorher wurden beide Listen vereinigt. Eine Vereinigung kann aber nur
 * hinzufuegen, niemals entfernen. Wer ein Projekt wieder einblendete, hatte es
 * damit nur so lange eingeblendet, bis irgendein Geraet mit dem alten Stand die
 * Seite oeffnete: dessen localStorage kannte die Kennung noch, die Vereinigung
 * hielt sie fuer eine Neuigkeit und schrieb sie zurueck. Auf allen Geraeten war
 * das Projekt danach wieder ausgeblendet.
 *
 * Richtig ist eine Richtung: der Browser-Stand ist nur Startkapital fuer die
 * erste Anmeldung. Sobald er uebernommen wurde, ist die Cloud die Wahrheit —
 * auch dann, wenn sie leer ist. Leer heisst jetzt "nichts ausgeblendet" und
 * nicht mehr "keine Information".
 */
async function loadFromCloud(uid, userEmailLower) {
  const ref = doc(db, COLLECTION, uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const remote = parsePrefsDoc(snap.data());
    writeLocalProjectListPrefs(userEmailLower, remote);
    markLocalPrefsAdopted(userEmailLower);
    return remote;
  }

  // Kein Dokument in der Cloud. Zwei Faelle, die gleich aussehen:
  if (hasAdoptedLocalPrefs(userEmailLower)) {
    // Schon einmal uebernommen -> hier wurde bewusst alles geleert.
    writeLocalProjectListPrefs(userEmailLower, EMPTY_PREFS);
    return EMPTY_PREFS;
  }

  // Erste Anmeldung auf diesem Konto -> Browser-Stand als Startkapital.
  const local = readLocalProjectListPrefs(userEmailLower);
  if (local.favoriteIds.length || local.hiddenIds.length) {
    await saveProjectListPrefs(uid, userEmailLower, local);
  }
  markLocalPrefsAdopted(userEmailLower);
  return local;
}

export async function fetchProjectListPrefs(uid, userEmailLower) {
  if (!userEmailLower) {
    return EMPTY_PREFS;
  }
  if (!hasFirebaseConfig || !db || !uid) {
    return readLocalProjectListPrefs(userEmailLower);
  }
  try {
    return await loadFromCloud(uid, userEmailLower);
  } catch (err) {
    console.warn("[projectListPrefs] fetch failed", err?.message || err);
    return readLocalProjectListPrefs(userEmailLower);
  }
}

/**
 * Einen Projektbesuch vermerken.
 *
 * DER EINZIGE SCHREIBER DIESES FELDES
 * Aufgerufen aus dem Rahmen, sobald eine Seite mit einem Projekt offen ist —
 * egal ob über die Liste, ein Lesezeichen oder den Zurück-Knopf. Deshalb
 * schreibt er auch nur DIESES eine Feld: `setDoc` mit `merge: true` mischt
 * verschachtelte Felder einzeln, die Favoriten und die Ausgeblendeten bleiben
 * unangetastet.
 *
 * WARUM HÖCHSTENS EINMAL PRO STUNDE
 * Das Feld beantwortet die Frage "seit wann nicht mehr angefasst?" — auf die
 * Stunde genau. Bei jedem Seitenwechsel innerhalb desselben Projekts zu
 * schreiben, hiesse ein Schreibvorgang pro Klick, für eine Angabe, die sich
 * dadurch nicht ändert.
 *
 * Fehler bleiben still: Ein Besuch, der nicht gespeichert wird, kostet
 * schlimmstenfalls einen Vorschlag zu viel.
 */
const BESUCH_ABSTAND_MS = 60 * 60 * 1000;

export async function merkeBesuch(uid, userEmailLower, projectId) {
  if (!projectId || !userEmailLower) return;

  const lokal = readLocalProjectListPrefs(userEmailLower);
  const openLog = { ...(lokal.openLog || {}) };
  const zuletzt = new Date(openLog[projectId] || 0).getTime();
  if (Number.isFinite(zuletzt) && Date.now() - zuletzt < BESUCH_ABSTAND_MS) return;

  const jetzt = new Date().toISOString();
  openLog[projectId] = jetzt;
  writeLocalProjectListPrefs(userEmailLower, { ...lokal, openLog });

  if (!hasFirebaseConfig || !db || !uid) return;
  try {
    await setDoc(
      doc(db, COLLECTION, uid),
      { userId: uid, open_log: { [projectId]: jetzt }, updated_date: jetzt },
      { merge: true },
    );
  } catch (err) {
    console.warn('[projectListPrefs] Besuch nicht gemerkt', err?.message || err);
  }
}

/**
 * "Heute nicht mehr" für das Band der Liegengebliebenen.
 *
 * Auch dies ein Einzelfeld-Schreiber, aus demselben Grund wie oben.
 */
export async function merkeBandWeggeklickt(uid, userEmailLower, tagesschluessel) {
  if (!userEmailLower) return;
  const lokal = readLocalProjectListPrefs(userEmailLower);
  writeLocalProjectListPrefs(userEmailLower, { ...lokal, neglectDismissed: tagesschluessel });

  if (!hasFirebaseConfig || !db || !uid) return;
  try {
    await setDoc(
      doc(db, COLLECTION, uid),
      { userId: uid, neglect_dismissed: tagesschluessel, updated_date: new Date().toISOString() },
      { merge: true },
    );
  } catch (err) {
    console.warn('[projectListPrefs] Wegklicken nicht gemerkt', err?.message || err);
  }
}

export function subscribeProjectListPrefs(uid, userEmailLower, onChange) {
  if (!hasFirebaseConfig || !db || !uid || !userEmailLower) {
    return () => {};
  }

  const ref = doc(db, COLLECTION, uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        // Auch hier gilt: nach der einmaligen Uebernahme ist ein fehlendes
        // Dokument eine Aussage ("nichts ausgeblendet") und keine Luecke, die
        // aus dem Browser aufgefuellt werden darf. Sonst holt der Live-Abgleich
        // zurueck, was der Ladevorgang gerade richtig geloescht hat.
        if (hasAdoptedLocalPrefs(userEmailLower)) {
          writeLocalProjectListPrefs(userEmailLower, EMPTY_PREFS);
          onChange(EMPTY_PREFS);
          return;
        }
        const local = readLocalProjectListPrefs(userEmailLower);
        onChange(local);
        if (local.favoriteIds.length || local.hiddenIds.length) {
          saveProjectListPrefs(uid, userEmailLower, local).catch((err) => {
            console.warn("[projectListPrefs] seed failed", err?.message || err);
          });
        }
        return;
      }
      const parsed = parsePrefsDoc(snap.data());
      writeLocalProjectListPrefs(userEmailLower, parsed);
      markLocalPrefsAdopted(userEmailLower);
      onChange(parsed);
    },
    (err) => {
      console.warn("[projectListPrefs] snapshot", err?.message || err);
    },
  );
}
