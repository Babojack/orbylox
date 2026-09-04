import { useCallback, useEffect, useRef, useState } from "react";
import {
  CONTACT_CARE_DEFAULTS,
  fetchContactCare,
  saveContactCare,
  subscribeContactCare,
  isContactCareDue,
  nextContactCareAt,
} from "@/api/contactCare";

/**
 * Kontaktpflege-Zustand für die angemeldete Person.
 *
 * Gleiche Bauweise wie useProjectListPrefs nach dem Fix: `stateRef` hält den
 * aktuellen Stand und wird sofort gesetzt, damit zwei schnelle Änderungen
 * (Intervall umstellen, dann einschalten) sich nicht gegenseitig überschreiben.
 */
export function useContactCare(user) {
  const uid = user?.uid;
  const email = user?.email?.toLowerCase();

  const [prefs, setPrefs] = useState({ ...CONTACT_CARE_DEFAULTS });
  const [loaded, setLoaded] = useState(false);
  const stateRef = useRef(prefs);

  const adopt = useCallback((next) => {
    stateRef.current = next;
    setPrefs(next);
  }, []);

  useEffect(() => {
    if (!email) return undefined;
    let cancelled = false;
    fetchContactCare(uid, email).then((p) => {
      if (!cancelled) {
        adopt(p);
        setLoaded(true);
      }
    });
    const unsub = subscribeContactCare(uid, email, (p) => {
      if (!cancelled) adopt(p);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [uid, email, adopt]);

  const update = useCallback(
    (patch) => {
      const next = { ...stateRef.current, ...patch };
      adopt(next);
      return saveContactCare(uid, email, next).catch((err) => {
        console.warn("[useContactCare] save", err?.message || err);
      });
    },
    [uid, email, adopt],
  );

  /** Drei Namen eingetragen → Erinnerung erfüllt, Uhr läuft neu. */
  const complete = useCallback(
    (names) => {
      const clean = (names || []).map((n) => String(n || "").trim()).filter(Boolean);
      if (clean.length < 3) return Promise.resolve(false);
      const now = new Date().toISOString();
      return update({
        lastDoneAt: now,
        log: [...(stateRef.current.log || []), { at: now, names: clean.slice(0, 3) }],
      }).then(() => true);
    },
    [update],
  );

  return {
    prefs,
    loaded,
    due: isContactCareDue(prefs),
    nextAt: nextContactCareAt(prefs),
    setEnabled: (enabled) => update({ enabled }),
    setIntervalDays: (intervalDays) => update({ intervalDays }),
    complete,
  };
}
