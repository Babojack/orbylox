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

  /** Einzige Wahrheit für das, was als Nächstes gespeichert wird. */
  const stateRef = useRef({ favoriteIds: [], hiddenIds: [] });

  const adopt = useCallback((prefs) => {
    const next = {
      favoriteIds: uniq(prefs.favoriteIds || []),
      hiddenIds: uniq(prefs.hiddenIds || []),
    };
    stateRef.current = next;
    setFavoriteIds(next.favoriteIds);
    setHiddenIds(next.hiddenIds);
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
      };
      stateRef.current = next;
      setFavoriteIds(next.favoriteIds);
      setHiddenIds(next.hiddenIds);

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

  return {
    favoriteIds,
    hiddenIds,
    persistFavorites,
    persistHidden,
  };
}
