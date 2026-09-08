import { useCallback, useEffect, useRef, useState } from "react";
import { hasFirebaseConfig } from "@/lib/firebase";
import { readLocalProjectListPrefs } from "@/lib/projectListPrefsLocal";
import {
  fetchProjectListPrefs,
  saveProjectListPrefs,
  subscribeProjectListPrefs,
} from "@/api/projectListPrefs";

function uniq(arr) {
  return [...new Set(arr)];
}

/**
 * Favoriten und ausgeblendete Projekte.
 *
 * Beide Listen liegen zusammen in EINEM Dokument. Jeder Speichervorgang
 * schreibt daher immer beide — und genau da lag der Fehler:
 *
 * Früher lasen die Speicherfunktionen den jeweils anderen Wert aus einem Ref,
 * das erst in einem useEffect NACH dem Rendern nachgezogen wurde. Wer schnell
 * hintereinander zwei Dinge tat (Projekt favorisieren und direkt wieder
 * einblenden), schrieb beim zweiten Klick noch den alten Favoritenstand mit —
 * und überschrieb damit den ersten Klick. Nach dem Neuladen war die Änderung
 * weg.
 *
 * Jetzt hält `stateRef` den aktuellen Stand und wird SOFORT beim Auslösen
 * gesetzt, nicht erst nach dem Rendern. Gespeichert wird immer der vollständige,
 * frische Stand.
 */
export function useProjectListPrefs(user) {
  const userEmailLower = user?.email?.toLowerCase();
  const uid = user?.uid;

  const [favoriteIds, setFavoriteIds] = useState([]);
  const [hiddenIds, setHiddenIds] = useState([]);
  /** Projektkennung -> Zeitpunkt des letzten Fokus. */
  const [focusLog, setFocusLog] = useState({});
  /** Wurde der Fokus schon einmal benutzt? Steuert den Neu-Hinweis. */
  const [focusSeen, setFocusSeen] = useState(false);

  /** Einzige Wahrheit für das, was als Nächstes gespeichert wird. */
  const stateRef = useRef({ favoriteIds: [], hiddenIds: [], focusLog: {}, focusSeen: false });

  const adopt = useCallback((prefs) => {
    const next = {
      favoriteIds: uniq(prefs.favoriteIds || []),
      hiddenIds: uniq(prefs.hiddenIds || []),
      focusLog: prefs.focusLog && typeof prefs.focusLog === 'object' ? prefs.focusLog : {},
      focusSeen: prefs.focusSeen === true,
    };
    stateRef.current = next;
    setFavoriteIds(next.favoriteIds);
    setHiddenIds(next.hiddenIds);
    setFocusLog(next.focusLog);
    setFocusSeen(next.focusSeen);
  }, []);

  useEffect(() => {
    if (!userEmailLower) return;
    adopt(readLocalProjectListPrefs(userEmailLower));
  }, [userEmailLower, adopt]);

  useEffect(() => {
    if (!userEmailLower) return undefined;
    if (!uid || !hasFirebaseConfig) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const prefs = await fetchProjectListPrefs(uid, userEmailLower);
        if (!cancelled) adopt(prefs);
      } catch (err) {
        console.warn("[useProjectListPrefs] load", err?.message || err);
      }
    })();

    const unsub = subscribeProjectListPrefs(uid, userEmailLower, (prefs) => {
      if (!cancelled) adopt(prefs);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [uid, userEmailLower, adopt]);

  /** Beide Listen zusammen fortschreiben und vollständig speichern. */
  const applyAndSave = useCallback(
    (patch) => {
      const next = {
        favoriteIds: uniq(patch.favoriteIds ?? stateRef.current.favoriteIds),
        hiddenIds: uniq(patch.hiddenIds ?? stateRef.current.hiddenIds),
        focusLog: patch.focusLog ?? stateRef.current.focusLog,
        focusSeen: patch.focusSeen ?? stateRef.current.focusSeen,
      };
      stateRef.current = next;
      setFavoriteIds(next.favoriteIds);
      setHiddenIds(next.hiddenIds);
      setFocusLog(next.focusLog);
      setFocusSeen(next.focusSeen);

      saveProjectListPrefs(uid, userEmailLower, next).catch((err) => {
        console.warn("[useProjectListPrefs] save", err?.message || err);
      });
    },
    [uid, userEmailLower],
  );

  const persistFavorites = useCallback(
    (nextFavorites) => applyAndSave({ favoriteIds: nextFavorites }),
    [applyAndSave],
  );

  const persistHidden = useCallback(
    (nextHidden) => applyAndSave({ hiddenIds: nextHidden }),
    [applyAndSave],
  );

  /**
   * Fokus vermerken. Beim ersten Mal verschwindet damit auch der Neu-Hinweis
   * — zwei Angaben, ein Schreibvorgang, weil beide im selben Dokument liegen.
   */
  const markFocused = useCallback(
    (projectId) => {
      if (!projectId) return;
      applyAndSave({
        focusLog: { ...stateRef.current.focusLog, [projectId]: new Date().toISOString() },
        focusSeen: true,
      });
    },
    [applyAndSave],
  );

  return {
    favoriteIds,
    hiddenIds,
    focusLog,
    focusSeen,
    persistFavorites,
    persistHidden,
    markFocused,
  };
}
