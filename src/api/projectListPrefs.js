import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db, hasFirebaseConfig } from "@/lib/firebase";
import {
  readLocalProjectListPrefs,
  writeLocalProjectListPrefs,
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
  return { favoriteIds, hiddenIds };
}

async function mergeLocalIntoCloudIfNeeded(uid, userEmailLower) {
  const ref = doc(db, COLLECTION, uid);
  const snap = await getDoc(ref);
  const local = readLocalProjectListPrefs(userEmailLower);

  if (!snap.exists()) {
    if (local.favoriteIds.length || local.hiddenIds.length) {
      await saveProjectListPrefs(uid, userEmailLower, local);
    }
    return local;
  }

  const remote = parsePrefsDoc(snap.data());
  const merged = {
    favoriteIds: normalizeProjectIdList([
      ...remote.favoriteIds,
      ...local.favoriteIds,
    ]),
    hiddenIds: normalizeProjectIdList([
      ...remote.hiddenIds,
      ...local.hiddenIds,
    ]),
  };

  const same =
    merged.favoriteIds.length === remote.favoriteIds.length &&
    merged.hiddenIds.length === remote.hiddenIds.length &&
    merged.favoriteIds.every((id) => remote.favoriteIds.includes(id)) &&
    merged.hiddenIds.every((id) => remote.hiddenIds.includes(id));

  if (!same) {
    return saveProjectListPrefs(uid, userEmailLower, merged);
  }

  writeLocalProjectListPrefs(userEmailLower, remote);
  return remote;
}

export async function fetchProjectListPrefs(uid, userEmailLower) {
  if (!userEmailLower) {
    return { favoriteIds: [], hiddenIds: [] };
  }
  if (!hasFirebaseConfig || !db || !uid) {
    return readLocalProjectListPrefs(userEmailLower);
  }
  try {
    return await mergeLocalIntoCloudIfNeeded(uid, userEmailLower);
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
      onChange(parsed);
    },
    (err) => {
      console.warn("[projectListPrefs] snapshot", err?.message || err);
    },
  );
}
