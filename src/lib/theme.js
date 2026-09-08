/**
 * Erscheinungsbild der Anwendung.
 *
 * Das Theme steht als `data-theme` am <html>-Element. Damit kann reines CSS
 * alles umstellen, ohne dass eine einzige Komponente davon wissen muss — bei
 * rund 1.600 fest verdrahteten Farbangaben in 75 Dateien ist das der einzige
 * Weg, der nicht Wochen dauert und dabei Fluechtigkeitsfehler streut.
 *
 * Die Regeln greifen zusaetzlich nur innerhalb von `.theme-scope`. Diese Klasse
 * setzt jetzt das Theme selbst an den <body> — nicht mehr jede Seite einzeln.
 *
 * Der Umweg ueber eine Klasse statt direkt ueber `[data-theme]` lohnt trotzdem:
 * Waehrend der Erprobung hing sie an genau einer Seite, und sie kann jederzeit
 * wieder enger gezogen werden, ohne dass eine einzige Regel sich aendert. Am
 * Body sitzend erwischt sie ausserdem die Dialoge und Menues, die Radix per
 * Portal dorthin haengt — die lagen ausserhalb jeder Seite und blieben weiss.
 */

const SCOPE_CLASS = 'theme-scope';

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
    // Der Body kann beim ersten Aufruf noch fehlen, wenn das Skript im Kopf
    // laeuft. Dann traegt ihn `initTheme` nach, sobald das Dokument steht.
    if (document.body) document.body.classList.toggle(SCOPE_CLASS, t !== 'default');
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
  const t = applyTheme(readTheme());
  if (typeof document !== 'undefined' && !document.body) {
    document.addEventListener('DOMContentLoaded', () => applyTheme(t), { once: true });
  }
  return t;
}
