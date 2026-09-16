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

/**
 * Die Stilbögen der Themes kommen erst, wenn jemand sie anschaltet.
 *
 * WARUM DAS SO WICHTIG IST
 * Sie standen als feste Importe in `main.jsx` und landeten damit in DER EINEN
 * Stildatei, die den Seitenaufbau blockiert. Gemessen am gebauten Ergebnis:
 * 283 KB insgesamt, davon 73 KB Retro und 82 KB Halloween — 55 Prozent für
 * ein Aussehen, das die allermeisten Besucher nie einschalten. Jeder wartete
 * beim ersten Bild auf Spinnweben und Holzmaserung.
 *
 * `import()` mit einer CSS-Datei ist kein Kunstgriff, sondern der vorgesehene
 * Weg: Vite macht daraus einen eigenen Stilbogen und hängt ihn beim Aufruf
 * als <link> ins Dokument. Die Zuordnung Name → Ladefunktion steht
 * ausgeschrieben da, weil Vite den Pfad beim Bauen sehen muss; eine
 * zusammengesetzte Zeichenkette könnte es nicht auflösen.
 *
 * Das Versprechen wird gemerkt: Zweimal umschalten lädt nicht zweimal.
 */
const STIL_LADER = {
  retro: () => import('@/styles/theme-retro.css'),
  halloween: () => import('@/styles/theme-halloween.css'),
};
const stilVersprechen = {};

/**
 * Den Stilbogen eines Themes holen. Gibt ein Versprechen zurück, das hält,
 * sobald der Browser ihn angewandt hat.
 *
 * Fehler werden verschluckt und nur ins Protokoll geschrieben: Ein Aussehen,
 * das nicht laden kann, ist ärgerlich — eine Anwendung, die deshalb stehen
 * bleibt, ist schlimmer. Ohne den Bogen sieht man das gewohnte Kleid.
 */
export function themeStilLaden(theme) {
  const lader = STIL_LADER[theme];
  if (!lader) return Promise.resolve();
  if (!stilVersprechen[theme]) {
    stilVersprechen[theme] = lader().catch((err) => {
      console.error(`[theme] Stilbogen "${theme}" konnte nicht geladen werden`, err);
    });
  }
  return stilVersprechen[theme];
}

const KEY = 'orbylox_theme';
export const THEMES = ['default', 'retro', 'halloween'];

/**
 * Die Themes in der Reihenfolge, in der sie im Umschalter stehen.
 *
 * Der Schluessel steht im Speicher und darf sich nie aendern; die
 * Beschriftung darf. `kurz` ist das, was neben dem Symbol Platz hat.
 */
export const THEME_LISTE = [
  { id: 'default',   de: 'Normal',    en: 'Normal',    kurz: { de: 'Design', en: 'Theme' } },
  { id: 'retro',     de: 'Retro',     en: 'Retro',     kurz: { de: 'Retro', en: 'Retro' } },
  { id: 'halloween', de: 'Halloween', en: 'Halloween', kurz: { de: 'Spooky', en: 'Spooky' } },
];

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
  // Anstossen, nicht abwarten: Das Attribut soll sofort stehen. Wer beim
  // Umschalten eine Zehntelsekunde das alte Kleid sieht, hat gerade selbst
  // geklickt und weiss, dass etwas passiert. Beim START ist das anders —
  // `initTheme` wartet deshalb dort ausdrücklich.
  themeStilLaden(t);
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

/**
 * Beim Start anwenden, damit die Seite nicht kurz im falschen Kleid steht.
 *
 * Gibt ein Versprechen zurück, das erst hält, wenn auch der Stilbogen da ist.
 * `main.jsx` wartet darauf, bevor es rendert — sonst sähe ein Retro-Besucher
 * für einen Moment die weisse Voreinstellung, und das ist genau das Blitzen,
 * das diese Funktion seit jeher verhindern soll.
 *
 * Für das gewohnte Aussehen hält das Versprechen sofort: `themeStilLaden`
 * gibt dort ein bereits erfülltes zurück, es wird nichts nachgeladen und
 * nichts gewartet. Die Kosten dieser Zeile trägt nur, wer Retro oder
 * Halloween eingeschaltet hat.
 */
export function initTheme() {
  const t = applyTheme(readTheme());
  if (typeof document !== 'undefined' && !document.body) {
    document.addEventListener('DOMContentLoaded', () => applyTheme(t), { once: true });
  }
  return themeStilLaden(t).then(() => t);
}
