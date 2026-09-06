const STORAGE_PREFIX = "orbylox_projects_v1:";

function safeJsonParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function projectListPrefsStorageKey(userEmailLower, suffix) {
  return `${STORAGE_PREFIX}${userEmailLower || "anon"}:${suffix}`;
}

function readStringArray(key) {
  if (typeof window === "undefined") return [];
  return safeJsonParse(window.localStorage.getItem(key), []).filter(
    (x) => typeof x === "string" && x,
  );
}

function writeStringArray(key, arr) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    key,
    JSON.stringify(Array.isArray(arr) ? arr : []),
  );
}

export function readLocalProjectListPrefs(userEmailLower) {
  const favoritesKey = projectListPrefsStorageKey(userEmailLower, "favorites");
  const hiddenKey = projectListPrefsStorageKey(userEmailLower, "hidden");
  return {
    favoriteIds: readStringArray(favoritesKey),
    hiddenIds: readStringArray(hiddenKey),
  };
}

export function writeLocalProjectListPrefs(userEmailLower, { favoriteIds, hiddenIds }) {
  writeStringArray(
    projectListPrefsStorageKey(userEmailLower, "favorites"),
    favoriteIds,
  );
  writeStringArray(
    projectListPrefsStorageKey(userEmailLower, "hidden"),
    hiddenIds,
  );
}

/**
 * Merker: Wurde der Browser-Stand schon einmal in die Cloud uebernommen?
 *
 * Ohne diesen Merker laesst sich "hier steht nichts, weil es geloescht wurde"
 * nicht von "hier steht nichts, weil noch nie etwas uebernommen wurde"
 * unterscheiden. Genau daran scheiterte das Wiedereinblenden: der alte
 * Browser-Stand wurde immer wieder als vermeintlich neue Information
 * hochgeschoben.
 */
export function hasAdoptedLocalPrefs(userEmailLower) {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem(
        projectListPrefsStorageKey(userEmailLower, "cloud"),
      ) === "1"
    );
  } catch {
    return false;
  }
}

export function markLocalPrefsAdopted(userEmailLower) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      projectListPrefsStorageKey(userEmailLower, "cloud"),
      "1",
    );
  } catch {
    // Privater Modus o. Ae. — dann bleibt es beim bisherigen Verhalten.
  }
}
