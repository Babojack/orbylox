/**
 * Erscheinungsbild der Anwendung.
 *
 * Das Theme steht als `data-theme` am <html>-Element. Damit kann reines CSS
 * alles umstellen, ohne dass eine einzige Komponente davon wissen muss — bei
 * rund 1.600 fest verdrahteten Farbangaben in 75 Dateien ist das der einzige
 * Weg, der nicht Wochen dauert und dabei Fluechtigkeitsfehler streut.
 *
 * Die Regeln greifen zusaetzlich nur innerhalb von `.theme-scope`. So laesst
 * sich ein Theme auf einer Seite ausprobieren, bevor es die ganze Anwendung
 * betrifft: Die Klasse an eine weitere Seite haengen, und sie zieht mit.
 */

const KEY = 'orbylox_theme';
export const THEMES = ['default', 'retro'];

export function readTheme() {
  if (typeof window === 'undefined') return 'default';
  try {
    const v = window.localStorage.getItem(KEY);
    return THEMES.includes(v) ? v : 'default';
  } catch {
    return 'default';
  }
}

export function applyTheme(theme) {
  const t = THEMES.includes(theme) ? theme : 'default';
  if (typeof document !== 'undefined') {
    // 'default' ohne Attribut: So greift kein einziger Selektor, und das
    // gewohnte Aussehen kostet nichts.
    if (t === 'default') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }
  try {
    window.localStorage.setItem(KEY, t);
  } catch {
    // Privater Modus: gilt dann nur fuer diese Sitzung.
  }
  return t;
}

/** Beim Start anwenden, damit die Seite nicht kurz im falschen Kleid steht. */
export function initTheme() {
  return applyTheme(readTheme());
}
