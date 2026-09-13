import { normalizeFocusLock } from "@/lib/focusDay";

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

function readJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    return safeJsonParse(window.localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Privater Modus: dann gilt es eben nur fuer diese Sitzung.
  }
}

export function readLocalProjectListPrefs(userEmailLower) {
  const favoritesKey = projectListPrefsStorageKey(userEmailLower, "favorites");
  const hiddenKey = projectListPrefsStorageKey(userEmailLower, "hidden");
  const focusLog = readJson(projectListPrefsStorageKey(userEmailLower, "focuslog"), {});
  const openLog = readJson(projectListPrefsStorageKey(userEmailLower, "openlog"), {});
  return {
    favoriteIds: readStringArray(favoritesKey),
    hiddenIds: readStringArray(hiddenKey),
    focusLog: focusLog && typeof focusLog === "object" ? focusLog : {},
    /** Projektkennung -> wann zuletzt geoeffnet. Siehe `projectNeglect.js`. */
    openLog: openLog && typeof openLog === "object" ? openLog : {},
    /** Tagesschluessel, an dem das Band der Liegengebliebenen weggeklickt wurde. */
    neglectDismissed: readJson(projectListPrefsStorageKey(userEmailLower, "neglectoff"), null),
    focusSeen: readJson(projectListPrefsStorageKey(userEmailLower, "focusseen"), false) === true,
    focusLock: normalizeFocusLock(
      readJson(projectListPrefsStorageKey(userEmailLower, "focuslock"), null),
    ),
  };
}

export function writeLocalProjectListPrefs(
  userEmailLower,
  { favoriteIds, hiddenIds, focusLog, focusSeen, focusLock, openLog, neglectDismissed },
) {
  writeStringArray(
    projectListPrefsStorageKey(userEmailLower, "favorites"),
    favoriteIds,
  );
  writeStringArray(
    projectListPrefsStorageKey(userEmailLower, "hidden"),
    hiddenIds,
  );
  writeJson(projectListPrefsStorageKey(userEmailLower, "focuslog"), focusLog || {});
  writeJson(projectListPrefsStorageKey(userEmailLower, "focusseen"), focusSeen === true);
  writeJson(
    projectListPrefsStorageKey(userEmailLower, "focuslock"),
    normalizeFocusLock(focusLock),
  );
  /**
   * `openLog` und der Wegklick-Vermerk werden nur geschrieben, wenn sie
   * MITGEGEBEN wurden.
   *
   * Der Grund steht in `projectListPrefs.js`: Die Besuchsmitschrift hat genau
   * einen Schreiber. Alle anderen Speichervorgänge (Favorit setzen,
   * ausblenden, Fokus) kennen sie gar nicht — und dürfen sie deshalb auch
   * nicht mit einem leeren Objekt überschreiben, nur weil das Feld in ihrem
   * Aufruf fehlt.
   */
  if (openLog !== undefined) {
    writeJson(projectListPrefsStorageKey(userEmailLower, "openlog"), openLog || {});
  }
  if (neglectDismissed !== undefined) {
    writeJson(projectListPrefsStorageKey(userEmailLower, "neglectoff"), neglectDismissed ?? null);
  }
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
