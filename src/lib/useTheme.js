import { useEffect, useState } from 'react';
import { currentTheme, onThemeChange } from '@/lib/theme';

/**
 * Das gerade geltende Aussehen — als React-Zustand.
 *
 * Getrennt von `lib/theme.js`, damit dort kein React steckt: Die Datei wird
 * in `main.jsx` vor dem ersten Rendern aufgerufen und soll das bleiben können.
 *
 * Der Anfangswert kommt aus einer Funktion, nicht aus einem Aufruf im Rumpf:
 * `currentTheme()` liest das Dokument, und das gibt es beim ersten Rendern auf
 * dem Server nicht.
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => currentTheme());
  useEffect(() => onThemeChange(setTheme), []);
  return theme;
}
