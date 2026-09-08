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
const THEME_EVENT = 'orbylox:theme';

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

/**
 * Was gerade tatsächlich gilt — abgelesen am Dokument, nicht am Speicher.
 *
 * Der Unterschied zu `readTheme` ist der Zeitpunkt: `readTheme` sagt, was beim
 * nächsten Start gelten wird, `currentTheme` sagt, was der Betrachter in
 * diesem Moment sieht. Für die Figur zählt das Zweite.
 */
export function currentTheme() {
  if (typeof document === 'undefined') return readTheme();
  const t = document.documentElement.getAttribute('data-theme');
  return THEMES.includes(t) ? t : 'default';
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
  /**
   * Bescheid geben, dass sich das Aussehen geaendert hat.
   *
   * Das Theme wirkt sonst rein ueber CSS, und CSS sieht React nicht. Was aber
   * am Theme haengt und KEIN CSS ist — welche Figur im runden Knopf steht —,
   * erfaehrt vom Wechsel nichts und zeigt bis zum naechsten Neuladen den
   * Roboter. Ein Ereignis am `window` erreicht alle, ohne dass ein Kontext
   * durch den halben Baum gereicht werden muss.
   */
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme: t } }));
  }
  return t;
}

/** Zuhoeren, wenn das Aussehen wechselt. Gibt die Abmeldefunktion zurueck. */
export function onThemeChange(handler) {
  if (typeof window === 'undefined') return () => {};
  const fn = (e) => handler(e.detail?.theme || currentTheme());
  window.addEventListener(THEME_EVENT, fn);
  return () => window.removeEventListener(THEME_EVENT, fn);
}

/** Beim Start anwenden, damit die Seite nicht kurz im falschen Kleid steht. */
export function initTheme() {
  const t = applyTheme(readTheme());
  if (typeof document !== 'undefined' && !document.body) {
    document.addEventListener('DOMContentLoaded', () => applyTheme(t), { once: true });
  }
  return t;
}
