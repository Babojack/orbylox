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
