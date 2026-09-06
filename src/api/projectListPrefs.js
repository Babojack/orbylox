import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db, hasFirebaseConfig } from "@/lib/firebase";
import {
  readLocalProjectListPrefs,
  writeLocalProjectListPrefs,
  hasAdoptedLocalPrefs,
  markLocalPrefsAdopted,
} from "@/lib/projectListPrefsLocal";

const COLLECTION = "UserProjectListPrefs";

export function normalizeProjectIdList(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.filter((x) => typeof x === "string" && x))];
}

export function parsePrefsDoc(data) {
  return {
    favoriteIds: normalizeProjectIdList(data?.favorite_project_ids),
    hiddenIds: normalizeProjectIdList(data?.hidden_project_ids),
  };
}

export async function saveProjectListPrefs(uid, userEmailLower, prefs) {
  const favoriteIds = normalizeProjectIdList(prefs.favoriteIds);
  const hiddenIds = normalizeProjectIdList(prefs.hiddenIds);
  writeLocalProjectListPrefs(userEmailLower, { favoriteIds, hiddenIds });

  if (!hasFirebaseConfig || !db || !uid) {
    return { favoriteIds, hiddenIds };
  }

  const ref = doc(db, COLLECTION, uid);
  await setDoc(
    ref,
    {
      userId: uid,
      favorite_project_ids: favoriteIds,
      hidden_project_ids: hiddenIds,
      updated_date: new Date().toISOString(),
    },
    { merge: true },
  );
  // Ab jetzt existiert das Dokument. Der Browser-Stand ist damit uebernommen
  // und darf nie wieder als eigene Quelle gelten.
  markLocalPrefsAdopted(userEmailLower);
  return { favoriteIds, hiddenIds };
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
    const empty = { favoriteIds: [], hiddenIds: [] };
    writeLocalProjectListPrefs(userEmailLower, empty);
    return empty;
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
    return { favoriteIds: [], hiddenIds: [] };
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
          const empty = { favoriteIds: [], hiddenIds: [] };
          writeLocalProjectListPrefs(userEmailLower, empty);
          onChange(empty);
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
