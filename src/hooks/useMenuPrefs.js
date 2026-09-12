import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMenu, readLocalMenu, saveMenu } from "@/api/menuPrefs";
import { menueGleich, normalizeMenu, verschieben } from "@/lib/menuModules";

/**
 * Die Menü-Anordnung als Zustand.
 *
 * Der Browser-Stand steht sofort, die Cloud zieht nach. Umgekehrt wäre das
 * Menü bei jedem Seitenaufruf einen Wimpernschlag lang die Standardliste und
 * würde dann umspringen — genau das, was man von einer selbst eingerichteten
 * Leiste am wenigsten erwartet.
 *
 * Gespeichert wird nur, wenn sich wirklich etwas geändert hat: Beim Ziehen
 * schickt die Bibliothek auch dann ein Ereignis, wenn das Modul dort wieder
 * abgelegt wurde, wo es herkam.
 */
export function useMenuPrefs(user) {
  const uid = user?.uid;
  const emailLower = user?.email?.toLowerCase();

  const [menu, setMenuState] = useState(() => readLocalMenu(emailLower));
  const menuRef = useRef(menu);
  menuRef.current = menu;

  useEffect(() => {
    if (!emailLower && !uid) return undefined;
    let abgemeldet = false;
    // Erst den Browser-Stand dieses Kontos, dann die Cloud.
    setMenuState(readLocalMenu(emailLower));
    fetchMenu(uid, emailLower).then((ausDerCloud) => {
      if (!abgemeldet) setMenuState(ausDerCloud);
    });
    return () => { abgemeldet = true; };
  }, [uid, emailLower]);

  const setMenu = useCallback((naechstes) => {
    const sauber = normalizeMenu(naechstes);
    if (menueGleich(sauber, menuRef.current)) return;
    menuRef.current = sauber;
    setMenuState(sauber);
    saveMenu(uid, emailLower, sauber).catch((err) => {
      console.warn("[menuPrefs] speichern fehlgeschlagen", err?.message || err);
    });
  }, [uid, emailLower]);

  /** Ein Modul an eine neue Stelle setzen — die Rechnung liegt in menuModules. */
  const modulVerschieben = useCallback((id, ziel, index) => {
    setMenu(verschieben(menuRef.current, id, ziel, index));
  }, [setMenu]);

  return { menu, setMenu, modulVerschieben };
}
