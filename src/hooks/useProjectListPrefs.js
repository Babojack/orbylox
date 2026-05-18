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

export function useProjectListPrefs(user) {
  const userEmailLower = user?.email?.toLowerCase();
  const uid = user?.uid;

  const [favoriteIds, setFavoriteIds] = useState([]);
  const [hiddenIds, setHiddenIds] = useState([]);
  const favoriteIdsRef = useRef(favoriteIds);
  const hiddenIdsRef = useRef(hiddenIds);

  useEffect(() => {
    favoriteIdsRef.current = favoriteIds;
  }, [favoriteIds]);

  useEffect(() => {
    hiddenIdsRef.current = hiddenIds;
  }, [hiddenIds]);

  useEffect(() => {
    if (!userEmailLower) return;
    const local = readLocalProjectListPrefs(userEmailLower);
    setFavoriteIds(local.favoriteIds);
    setHiddenIds(local.hiddenIds);
  }, [userEmailLower]);

  useEffect(() => {
    if (!userEmailLower) return undefined;

    if (!uid || !hasFirebaseConfig) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        const prefs = await fetchProjectListPrefs(uid, userEmailLower);
        if (!cancelled) {
          setFavoriteIds(prefs.favoriteIds);
          setHiddenIds(prefs.hiddenIds);
        }
      } catch (err) {
        console.warn("[useProjectListPrefs] load", err?.message || err);
      }
    })();

    const unsub = subscribeProjectListPrefs(uid, userEmailLower, (prefs) => {
      if (!cancelled) {
        setFavoriteIds(prefs.favoriteIds);
        setHiddenIds(prefs.hiddenIds);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [uid, userEmailLower]);

  const persistFavorites = useCallback(
    (next) => {
      const uniqNext = uniq(next);
      setFavoriteIds(uniqNext);
      saveProjectListPrefs(uid, userEmailLower, {
        favoriteIds: uniqNext,
        hiddenIds: hiddenIdsRef.current,
      }).catch((err) => {
        console.warn("[useProjectListPrefs] save favorites", err?.message || err);
      });
    },
    [uid, userEmailLower],
  );

  const persistHidden = useCallback(
    (next) => {
      const uniqNext = uniq(next);
      setHiddenIds(uniqNext);
      saveProjectListPrefs(uid, userEmailLower, {
        favoriteIds: favoriteIdsRef.current,
        hiddenIds: uniqNext,
      }).catch((err) => {
        console.warn("[useProjectListPrefs] save hidden", err?.message || err);
      });
    },
    [uid, userEmailLower],
  );

  return {
    favoriteIds,
    hiddenIds,
    persistFavorites,
    persistHidden,
  };
}
