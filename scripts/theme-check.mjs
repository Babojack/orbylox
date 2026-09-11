/**
 * Prüft das Retro-Theme gegen das GEBAUTE CSS.
 *
 *   npm run build && npm run check:theme
 *
 * WARUM ES DIESE DATEI GIBT
 * Das Theme ist reines CSS. Es lässt sich nicht durch einen Aufruf testen,
 * sondern nur, indem man fragt: Welche Regel gewinnt an diesem Element? Genau
 * daran ist es zweimal gescheitert:
 *
 *   1. `theme-scope` hing an der Ladeansicht statt am Inhalt. Sichtbar änderte
 *      sich nur die Schrift — die erbt über `body` —, jede klassenbasierte
 *      Regel lief ins Leere.
 *   2. `index.css` erklärt gesättigte Flächen für `!important`. Ohne eine
 *      zweite Wichtig-Erklärung wären alle farbigen Plaketten schwarz.
 *
 * Beides sind Kaskadenfehler, keine Tippfehler. Ein Blick auf die Datei findet
 * sie nicht, ein Blick auf das Ergebnis schon.
 *
 * WARUM DIE KASKADE HIER SELBST GERECHNET WIRD
 * `getComputedStyle` aus jsdom behandelt konkurrierende `!important`-Regeln
 * falsch: Es nimmt die zuerst gefundene statt der stärkeren. Für Fall 2 wäre
 * das Ergebnis also wertlos. Deshalb: Regeln aus dem Stylesheet sammeln, mit
 * `element.matches()` filtern (das kann jsdom zuverlässig) und nach Vorschrift
 * sortieren — wichtig vor normal, dann Spezifität, dann Reihenfolge.
 *
 * Braucht jsdom (nur zur Entwicklung): npm i -D jsdom
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(wurzel, 'dist', 'assets');

let JSDOM;
try {
  ({ JSDOM } = await import('jsdom'));
} catch {
  console.error('jsdom fehlt. Einmalig: npm i -D jsdom');
  process.exit(2);
}

if (!fs.existsSync(assets)) {
  console.error('Kein dist/assets — bitte zuerst: npm run build');
  process.exit(2);
}
const cssDatei = fs.readdirSync(assets).find((f) => /^index-.*\.css$/.test(f));
if (!cssDatei) {
  console.error('Keine gebaute CSS-Datei in dist/assets gefunden.');
  process.exit(2);
}
const css = fs.readFileSync(path.join(assets, cssDatei), 'utf8');

/* ------------------------------------------------------------- Kaskade */

function spezifitaet(sel) {
  const s = sel.replace(/\\./g, 'x');
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const klassen =
    (s.match(/\.[\w-]+/g) || []).length +
    (s.match(/\[[^\]]*\]/g) || []).length +
    (s.match(/:(?!:)(?!not\()[\w-]+/g) || []).length;
  const elemente = (
    s.replace(/\[[^\]]*\]/g, '').match(/(^|[\s>+~(])([a-zA-Z][\w-]*)/g) || []
  ).length;
  return ids * 10000 + klassen * 100 + elemente;
}

const regeln = [];
let lfd = 0;
postcss.parse(css).walkRules((rule) => {
  const decls = {};
  rule.walkDecls((d) => {
    decls[d.prop] = { wert: d.value, wichtig: !!d.important };
  });
  for (const sel of rule.selectors || []) {
    regeln.push({ sel, decls, spez: spezifitaet(sel), ord: lfd++ });
  }
});

/** Welche Deklaration setzt sich an diesem Element für diese Eigenschaft durch? */
function gewinner(el, prop) {
  let best = null;
  for (const r of regeln) {
    const d = r.decls[prop];
    if (!d) continue;
    let passt = false;
    try {
      passt = el.matches(r.sel);
    } catch {
      continue; // Selektoren, die jsdom nicht kennt (z. B. ::-webkit-…)
    }
    if (!passt) continue;
    const rang = [d.wichtig ? 1 : 0, r.spez, r.ord];
    const besser =
      !best ||
      rang[0] > best.rang[0] ||
      (rang[0] === best.rang[0] && rang[1] > best.rang[1]) ||
      (rang[0] === best.rang[0] && rang[1] === best.rang[1] && rang[2] > best.rang[2]);
    if (besser) best = { wert: d.wert, rang, sel: r.sel };
  }
  return best;
}

/* --------------------------------------------------------------- Aufbau */

/** Nachbau der echten Struktur aus Layout.jsx, ProjectsList, ScrumBoard. */
const MARKUP = `
  <aside class="w-64 border-r border-slate-100 flex flex-col fixed h-full bg-white z-50">
    <span class="text-slate-800" id="navtext">Dashboard</span>
    <span class="bg-sky-500" id="navpunkt"></span>
    <div class="bg-slate-100" id="navaktiv">aktiv</div>
    <button id="schliessknopf" class="text-slate-400 hover:text-slate-600">X</button>
    <button id="abmelden" class="w-full flex items-center gap-3 px-4 py-3 bg-red-500 rounded-xl"><span class="text-sm text-white">Abmelden</span></button>
  </aside>
  <main class="flex-1 bg-white min-h-screen flex flex-col">
    <header class="h-16 border-b border-slate-50 sticky top-0 bg-white/95 z-50">
      <h1 class="font-semibold text-slate-800" id="projektname">Website-Relaunch</h1>
      <button id="themeknopf" class="h-9 px-3 border-2 border-black bg-white text-xs uppercase">Retro</button>
      <button data-avatar="" id="avatarknopf" class="focus:outline-none"><img src="/a.png" /></button>
    </header>
    <div class="max-w-7xl mx-auto px-6 py-12">
      <div class="rounded-lg border-2 border-slate-200 bg-white shadow-sm" id="karte">
        <h3 class="text-slate-900" id="kartentitel">Projekt</h3>
        <p class="text-sm text-slate-500" id="kartentext">Beschreibung</p>
        <button class="h-9 px-3 border-2 border-black bg-[#ef5a24] text-white uppercase" id="cta">Los</button>
        <input id="feld" />
      </div>
      <div class="rounded-xl bg-slate-50 border border-slate-200" id="spalte">
        <span class="bg-emerald-500 text-white rounded-full" id="fertig">fertig</span>
        <span class="bg-teal-500" id="tuerkis"></span>
        <span class="bg-purple-500" id="lila"></span>
        <span class="bg-amber-50 text-amber-700" id="gelb"></span>
        <span class="bg-red-500" id="rot"></span>
      </div>
      <div class="bg-gradient-to-br from-indigo-500 to-purple-600" id="verlauf"></div>
      <div class="bg-slate-500 text-white" id="dunkel">Einstellungen</div>
      <img src="/screens/hero-devices.webp" data-screenshot="" id="aufnahme" />
      <img src="/covers/projekt.png" id="normalesbild" />
      <div class="bg-slate-50" id="hell"></div>
      <div data-landing="">
      <section class="bg-[#f5f5f5]" id="wiese">
        <h2 class="text-slate-900" id="wiesentitel">Module</h2>
        <p class="text-slate-500" id="wiesentext">Beschreibung</p>
        <div class="bg-white" id="wiesenkarte"><p class="text-slate-600" id="karteninhalt">Text</p></div>
      </section>
      </div>
      <input type="text" id="textfeld" />
      <div class="cursor-grab" id="greifen"></div>
      <button data-menu="" class="h-9 w-9 text-slate-600 hover:text-slate-900 hover:bg-slate-100" id="menue"></button>
      <button data-assistant-button="" id="assistent" class="fixed z-40 grid place-items-center w-14 h-14 rounded-full right-[calc(1rem_+_env(safe-area-inset-right,0px))] bottom-[calc(1rem_+_env(safe-area-inset-bottom,0px))] border-2 border-black bg-[#ef5a24] overflow-hidden shadow-lg"></button>
      <div id="erwaehnung" class="fixed right-4 z-[100] bottom-[calc(5.25rem_+_env(safe-area-inset-bottom,0px))] w-[calc(100vw-2rem)] max-w-sm"></div>
      <div class="bg-blue-50" id="spalteblau"></div>
      <p class="text-slate-500" id="freitext">Neuigkeiten, Ankündigungen und Team-Diskussionen.</p>
      <div class="bg-white rounded-xl" id="tafel"><p class="text-slate-500" id="tafeltext">Nebensache</p></div>
      <div data-kanban-board="" class="flex gap-3 overflow-auto pb-4 flex-1" id="brett">
        <div data-kanban-column="" class="bg-slate-50/50 rounded-2xl border min-h-[60vh]" id="kanbanspalte">
          <div class="bg-white rounded-xl border-2 border-black" id="kanbankarte">Aufgabe</div>
        </div>
      </div>
      <section class="bg-[#f5f5f5]" id="woanders"><span class="text-[#ef5a24]" id="markentext">x</span></section>
    </div>
  </main>
  <div role="dialog" class="bg-white rounded-2xl shadow-2xl" id="dialog">
    <h2 id="dialogtitel">Projekt löschen</h2>
    <div data-datumspaar="" class="grid grid-cols-2 gap-4" id="datumspaar">
      <div class="min-w-0"><input type="datetime-local" id="startfeld" /></div>
      <div class="min-w-0"><input type="datetime-local" id="endefeld" /></div>
    </div>
  </div>`;

function baum(mitTheme) {
  const dom = new JSDOM(
    `<!doctype html><html${mitTheme ? ' data-theme="retro"' : ''}>` +
      `<body class="${mitTheme ? 'theme-scope' : ''}">${MARKUP}</body></html>`,
  );
  return dom.window.document;
}

const R = baum(true);
const N = baum(false);
const w = (doc, sel, prop) => {
  const el = sel.startsWith('#') ? doc.getElementById(sel.slice(1)) : doc.querySelector(sel);
  const g = gewinner(el, prop);
  return g ? g.wert : null;
};

/* ------------------------------------------------------------- Kontrast */

/**
 * Der zweite Teil der Prüfung: Ist das Ergebnis lesbar?
 *
 * Struktur allein genügt nicht. Eine Regel kann greifen und trotzdem Unsinn
 * ergeben — grüne Schrift auf grüner Fläche, weiße Schrift auf Pergament. Also
 * werden alle Klassenkombinationen aus dem Quelltext gesammelt, durch dieselbe
 * Kaskade geschickt und ausgerechnet.
 */

const palette = Object.fromEntries(
  [...fs.readFileSync(path.join(wurzel, 'src/styles/theme-retro.css'), 'utf8')
      .matchAll(/(--r-[\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]),
);

const zuRgb = (h) => {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [
    parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16),
    h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
  ];
};

function farbe(wert) {
  if (!wert) return null;
  const w = wert.trim();
  const v = /^var\((--[\w-]+)/.exec(w);
  if (v) return palette[v[1]] ? zuRgb(palette[v[1]]) : null;
  if (w.startsWith('#')) return zuRgb(w);
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:[,/]\s*([\d.]+|var\([^)]*\)))?\s*\)/.exec(w);
  if (m) return [+m[1], +m[2], +m[3], m[4] && !m[4].startsWith('var') ? parseFloat(m[4]) : 1];
  if (w === 'white') return [255, 255, 255, 1];
  if (w === 'transparent') return [0, 0, 0, 0];
  return null;
}
const ueber = (v, h) => (!v ? h : v[3] >= 1 ? v
  : [0, 1, 2].map((i) => Math.round(v[i] * v[3] + h[i] * (1 - v[3]))).concat(1));
const leuchte = (c) => {
  const f = (x) => ((x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const kontrast = (a, b) => {
  const l1 = leuchte(a); const l2 = leuchte(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

function jsDateien(dir, raus = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) jsDateien(p, raus);
    else if (/\.jsx?$/.test(e.name)) raus.push(p);
  }
  return raus;
}

const kombis = new Map();
for (const f of jsDateien(path.join(wurzel, 'src'))) {
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/className\s*=\s*(\{`([\s\S]*?)`\}|"([^"]*)"|\{"([^"]*)"\}|\{'([^']*)'\})/g)) {
    const roh = m[2] ?? m[3] ?? m[4] ?? m[5] ?? '';
    const tok = roh.replace(/\$\{[\s\S]*?\}/g, ' ').split(/[\s`'"]+/).filter(Boolean)
      .map((t) => t.replace(/^[^a-zA-Z[]+/, ''));
    const bgs = tok.filter((t) => /^bg-/.test(t));
    const txt = tok.filter((t) => /^text-/.test(t)
      && !/^text-(xs|sm|base|lg|xl|\dxl|left|right|center|justify|transparent)$/.test(t)
      && !/^text-\[\d/.test(t));
    if (!bgs.length || !txt.length) continue;
    const zeile = text.slice(0, m.index).split('\n').length;
    for (const b of bgs) for (const t of txt) {
      const key = `${b} ${t}`;
      if (!kombis.has(key)) kombis.set(key, { b, t, f: path.relative(wurzel, f), zeile });
    }
  }
}

/**
 * Drei Kombinationen bleiben unter der Schwelle — alle drei auch OHNE Theme.
 * Sie stehen hier namentlich, damit sie niemanden mehr aufhalten und trotzdem
 * niemand vergisst, dass es sie gibt:
 *   - zwei helle Schriften auf halbdurchsichtigen Flaechen ueber Fotos
 *     (dort traegt das Bild den Kontrast, nicht die Flaeche)
 *   - Weiss auf der Markenfarbe: 3,41:1, unveraendert seit jeher
 */
const BEKANNT = new Set([
  'bg-white/10 text-white',
  'bg-black/30 text-white',
  'bg-[#ef5a24] text-white',
]);
const SCHWELLE = 3.5;

function messen(klassen, mitTheme) {
  const dom = new JSDOM(`<!doctype html><html${mitTheme ? ' data-theme="retro"' : ''}>` +
    `<body class="${mitTheme ? 'theme-scope' : ''}"><span id="x" class="${klassen}"></span></body></html>`);
  const el = dom.window.document.getElementById('x');
  return { bg: farbe(gewinner(el, 'background-color')?.wert), fg: farbe(gewinner(el, 'color')?.wert) };
}

const PERGAMENT = zuRgb(palette['--r-parch']);
const schwach = [];
for (const [key, k] of kombis) {
  if (BEKANNT.has(key)) continue;
  const r = messen(`${k.b} ${k.t}`, true);
  if (!r.bg || !r.fg) continue;
  const grund = ueber(r.bg, PERGAMENT);
  const wert = kontrast(grund, ueber(r.fg, grund));
  if (wert < SCHWELLE) schwach.push({ ...k, wert: wert.toFixed(2) });
}

/* ------------------------------------------------------------- Prüfungen */

const faelle = [
  // Flächen
  ['Grundfläche wird Wiese', () => w(R, 'body', 'background-color') === 'var(--r-grass)'],
  ['Seitenleiste wird Holz', () => w(R, 'aside', 'background-color') === 'var(--r-wood)'],
  ['Kopfzeile wird Holz', () => w(R, 'header', 'background-color') === 'var(--r-wood)'],
  ['Karte wird Pergament', () => w(R, '#karte', 'background-color') === 'var(--r-parch)'],
  ['Kanban-Spalte wird Pergament', () => w(R, '#spalte', 'background-color') === 'var(--r-parch)'],
  ['Dialog wird Pergament', () => w(R, '#dialog', 'background-color') === 'var(--r-parch)'],
  ['Eingabe wird Pergament', () => w(R, '#feld', 'background-color') === 'var(--r-parch)'],
  ['Marke bleibt Flamme', () => w(R, '#cta', 'background-color') === 'var(--r-flame)'],

  // Schrift und Form
  ['Titel wird Tinte', () => w(R, '#kartentitel', 'color') === 'var(--r-ink)'],
  ['Nebentext wird gedämpft', () => w(R, '#kartentext', 'color') === 'var(--r-ink-dim)'],
  ['Text auf Holz wird hell', () => w(R, '#projektname', 'color') === 'var(--r-parch)'],
  ['Knopf bekommt Pixelschrift', () => /Press Start 2P/.test(w(R, '#cta', 'font-family') || '')],
  ['Karte wird eckig', () => w(R, '#karte', 'border-radius') === '0'],
  ['Verlauf wird glatte Fläche', () => w(R, '#verlauf', 'background-image') === 'none'],

  // Die Farbfamilien — hier steht !important gegen !important.
  // Die Werte sind die nachgedunkelten Vollfarben aus dem Farbblock, nicht die
  // rohen Palettenvariablen: Sie sind so gewählt, dass helle Schrift darauf
  // über 4,5:1 liegt.
  ['Grün wird Moos', () => w(R, '#fertig', 'background-color') === '#33742f'],
  ['Türkis fällt auf Blau', () => w(R, '#tuerkis', 'background-color') === '#2b65be'],
  ['Lila fällt auf Pflaume', () => w(R, '#lila', 'background-color') === '#7d4fa8'],
  ['Rot wird Blut', () => w(R, '#rot', 'background-color') === '#ba392a'],
  // Helle Stufe bleibt hell — das war der Fehler bei der "online"-Plakette.
  ['bg-amber-50 bleibt zart', () => w(R, '#gelb', 'background-color') === '#e8d7b0'],

  // Gegenprobe: ohne Theme darf sich NICHTS ändern
  ['Ohne Theme: Karte weiß', () => /255 255 255/.test(w(N, '#karte', 'background-color') || '')],
  ['Ohne Theme: Seitenleiste weiß', () => /255 255 255/.test(w(N, 'aside', 'background-color') || '')],
  ['Ohne Theme: keine Pixelschrift', () => !/Press Start 2P/.test(w(N, '#cta', 'font-family') || '')],
  ['Ohne Theme: Farben wie gehabt', () => w(N, '#fertig', 'background-color') === '#0a0a0a'],

  // Helligkeitsstufen dürfen sich nicht überlappen: bg-slate-500 ist DUNKEL,
  // auch wenn 'bg-slate-50' als Zeichenkette darin vorkommt.
  ['bg-slate-500 bleibt dunkel', () => w(R, '#dunkel', 'background-color') === 'var(--r-wood)'],
  ['bg-slate-50 bleibt hell', () => w(R, '#hell', 'background-color') === 'var(--r-parch)'],

  // Produktaufnahmen: scharf, nicht gepixelt.
  ['Aufnahme bleibt scharf', () => w(R, '#aufnahme', 'image-rendering') === 'auto'],
  ['andere Bilder bleiben gepixelt', () => w(R, '#normalesbild', 'image-rendering') === 'pixelated'],
  // Das Weiss des Hauptbildes loest die Datei selbst auf, nicht das Theme.
  ['Hauptbild ist freigestellt', () => {
    // WEBP: ein 'ALPH'-Abschnitt (oder VP8L) zeigt Transparenz an.
    const b = fs.readFileSync(path.join(wurzel, 'src/assets/hero-devices.webp'));
    return b.includes(Buffer.from('ALPH')) || b.includes(Buffer.from('VP8L'));
  }],
  ['Hauptbild kommt aus src, nicht aus public', () => {
    // Nur von dort bekommt es einen Inhaltsstempel im Dateinamen. Ohne den
    // liefert jeder Zwischenspeicher weiter die alte Fassung.
    const l = fs.readFileSync(path.join(wurzel, 'src/pages/Landing.jsx'), 'utf8');
    return l.includes("from '@/assets/hero-devices.webp'")
      && !l.includes('"/screens/hero-devices.webp"');
  }],
  ['Blog-Vorschaubild bleibt deckend', () => {
    // Vorschaubilder mit Transparenz zeigen manche Dienste auf Schwarz.
    const b = fs.readFileSync(path.join(wurzel, 'public/screens/hero-devices.webp'));
    return !b.includes(Buffer.from('ALPH'));
  }],

  // Wiesenbaender auf der Startseite — Gruen traegt nur dunkle Schrift.
  ['Band wird Wiese', () => w(R, '#wiese', 'background-color') === 'var(--r-grass)'],
  ['Titel auf Gras wird Tinte', () => w(R, '#wiesentitel', 'color') === 'var(--r-ink)'],
  ['auch Nebentext wird Tinte', () => w(R, '#wiesentext', 'color') === 'var(--r-ink)'],
  ['Karte im Gras bleibt Pergament', () => w(R, '#wiesenkarte', 'background-color') === 'var(--r-parch)'],
  ['ohne Theme bleibt das Band grau', () => /245/.test(w(N, '#wiese', 'background-color') || '')],
  ['Wiese nur auf der Startseite', () => w(R, '#woanders', 'background-color') === 'var(--r-parch-2)'],
  /**
   * ... und die Kachel hat dort trotzdem eine Flaeche.
   *
   * Vorher war sie `transparent`. Die Ordnerkacheln im Dateibereich waren
   * damit nur ein Rahmen; lag etwas anderes als Pergament darunter, sah man
   * gar nichts mehr. Geprueft wird deshalb, dass hier ueberhaupt eine Farbe
   * steht — und dass sie nicht die Wiese ist.
   */
  ['Kachel ausserhalb hat eine Flaeche', () => {
    const f = farbe(w(R, '#woanders', 'background-color'));
    return !!f && f[3] === 1 && f.join() !== zuRgb(palette['--r-grass']).join();
  }],

  /**
   * Der eigene Mauszeiger — und was von ihm verschont bleibt.
   *
   * Gesucht wird nicht der Dateiname: Das PNG ist nur 1,5 KB und landet
   * deshalb als data-URL direkt im Stylesheet. Geprüft wird also das, worauf
   * es ankommt — ein eingebettetes Bild MIT heißem Punkt und mit Rückfall.
   */
  ['Zeiger wird ersetzt', () => /^url\(data:image\/png[^)]*\)\s*0 5,\s*auto$/.test(w(R, 'body', 'cursor') || '')],
  ['auch auf Knöpfen', () => /data:image\/png/.test(w(R, '#cta', 'cursor') || '')],
  ['heißer Punkt sitzt bei 0 5', () => /\)\s*0 5,/.test(w(R, 'body', 'cursor') || '')],
  ['Greifen bleibt Greifen', () => {
    // Ein eigener Wert am Element schlägt jede Vererbung — hier darf das Theme
    // nichts anfassen, der Zeiger trägt Information.
    const g = w(R, '#greifen', 'cursor');
    return g === null || !/data:image/.test(g);
  }],
  ['ohne Theme kein eigener Zeiger', () => !/data:image/.test(w(N, 'body', 'cursor') || '')],

  /**
   * Der Weg ins Menü muss man sehen.
   *
   * Der Knopf stand auf Holz, ohne Fläche und ohne Rahmen; beim Überfahren
   * legte sich das unveränderte `slate-100` darunter und sein pergament-
   * farbenes Symbol verschwand darin. Beides wird hier geprüft.
   */
  ['Menü-Knopf ist grün', () => w(R, '#menue', 'background-color') === '#33742f'],
  ['und hat einen Rahmen', () => /solid/.test(w(R, '#menue', 'border') || '')],
  ['ohne Theme bleibt er schlicht', () => w(N, '#menue', 'background-color') !== '#33742f'],

  /**
   * Dasselbe für die übrigen Knöpfe oben und links.
   *
   * Der Retro-Schalter, der Ton, die Sprache, die Glocke, das X der
   * Seitenleiste standen weiss auf Holz — sichtbar nur, weil weiss auf braun
   * auffällt, nicht weil sie als Knopf erkennbar waren. Der Avatar ist
   * ausdrücklich ausgenommen: dahinter läge das Grün als Rahmen um ein Foto.
   */
  ['Kopfzeilen-Knöpfe sind grün', () => w(R, '#themeknopf', 'background-color') === '#33742f'],
  ['Knöpfe der Seitenleiste auch', () => w(R, '#schliessknopf', 'background-color') === '#33742f'],
  ['der Avatar bleibt ausgespart', () => w(R, '#avatarknopf', 'background-color') !== '#33742f'],
  ['und das Abmelden bleibt rot', () => w(R, '#abmelden', 'background-color') !== '#33742f'],
  ['ohne Theme bleiben sie weiss', () => w(N, '#themeknopf', 'background-color') !== '#33742f'],

  /**
   * Das Brett: drei Ebenen, jede von der nächsten unterscheidbar.
   *
   * Vorher war der Inhaltsbereich, die Spalte und die Karte dasselbe
   * Pergament — das Brett zerfiel. Geprüft wird nicht "sieht gut aus",
   * sondern dass sich die drei Flächen paarweise überhaupt unterscheiden.
   */
  ['Inhaltsfläche ist Wiese', () => farbe(w(R, 'main', 'background-color'))?.join() === zuRgb(palette['--r-grass']).join()],
  /**
   * Auf dem Gras wird gedämpfte Schrift zu Tinte — aber NUR dort.
   *
   * Das Gras liegt in der Mitte der Helligkeitsskala: Tinte darauf ergibt
   * 4,57:1, gedämpftes Braun 1,87:1. Einen helleren Ton, der hier noch trägt,
   * gibt es nicht — selbst ein deutlich dunkleres Braun käme nur auf 3,37:1
   * und wäre dann von Tinte kaum zu unterscheiden. Also: freistehend Tinte,
   * in einer Karte bleibt die Abstufung.
   *
   * Die zweite Zusicherung ist die wichtigere. Ohne sie hätte die Regel auch
   * "alles wird Tinte" heißen können, und die Hierarchie in jeder Karte wäre
   * still verschwunden.
   */
  ['freier Text auf Gras wird Tinte', () => w(R, '#freitext', 'color') === 'var(--r-ink)'],
  ['in der Karte bleibt er gedämpft', () => w(R, '#tafeltext', 'color') === 'var(--r-ink-dim)'],
  ['ohne Theme bleibt er grau', () => /100\s+116\s+139|#64748b/.test(w(N, '#freitext', 'color') || '')],
  ['Spalte hebt sich von der Wiese ab', () => {
    const s = w(R, '#kanbanspalte', 'background-color');
    return s !== null && farbe(s)?.join() !== zuRgb(palette['--r-grass']).join();
  }],
  ['und die Karte von der Spalte', () => {
    const sp = farbe(w(R, '#kanbanspalte', 'background-color'));
    const ka = farbe(w(R, '#kanbankarte', 'background-color'));
    return sp && ka && sp.join() !== ka.join();
  }],
  /**
   * Zwei Zusicherungen am Quelltext statt am Stylesheet.
   *
   * Sie halten den Fehler fest, an dem "Zu erledigen" und "In Arbeit"
   * ineinandergewachsen sind — beide sind mit Farben nicht zu fassen:
   *
   *   1. Die Spalte ist ein Flex-Kind. Ohne `min-w-0` gilt `min-width: auto`,
   *      sie darf dann nie schmaler werden als ihr breitester unteilbarer
   *      Inhalt und wächst über ihre Hülle hinaus in die Nachbarspalte.
   *   2. `truncate` an einem Inline-Span kürzt nichts: `overflow` und
   *      `text-overflow` greifen dort nicht, `white-space: nowrap` schon.
   *      Der Text wird also bloß unteilbar — genau der Inhalt aus (1).
   *      Am äußeren Span, der ein Flex-Kind und damit ein Block ist, kürzt er.
   */
  ['Kanban-Spalte darf schrumpfen', () => {
    const s = fs.readFileSync(path.join(wurzel, 'src/pages/ScrumBoard.jsx'), 'utf8');
    const i = s.indexOf('data-kanban-column');
    return i > 0 && /className=\{`flex-1 min-w-0 /.test(s.slice(i, i + 900));
  }],
  ['und kein truncate an einem Inline-Span', () => {
    const s = fs.readFileSync(path.join(wurzel, 'src/pages/ScrumBoard.jsx'), 'utf8');
    // Der Sperrhinweis: kuerzen darf nur der Span, der auch min-w-0 traegt.
    return /min-w-0 truncate/.test(s) && !/<span className="truncate">\{open\[0\]/.test(s);
  }],
  /**
   * Die Kopfzeile der Startseite auf dem Handy.
   *
   * Gemessen bei 428 Pixern Fensterbreite: zwischen Wortmarke und Knopfreihe
   * blieben 27 Pixel, bei 390 nur 15 — die Reihe klebte zusammen, im Retro
   * zusaetzlich verklebt durch die harten Schatten. Beide Ursachen stehen
   * hier fest: kein Knopf mit fester Breite (er waere 36 statt 44 wie seine
   * Nachbarn), und das Wort am Anmelden-Knopf erst ab `sm`.
   */
  ['Ton-Knopf hat dieselbe Form wie die Nachbarn', () => {
    const s = fs.readFileSync(path.join(wurzel, 'src/components/common/SoundSwitch.jsx'), 'utf8');
    return /h-9 px-3 /.test(s) && !/h-9 w-9/.test(s);
  }],
  ['Anmelden traegt sein Wort erst ab sm', () => {
    const s = fs.readFileSync(path.join(wurzel, 'src/pages/Landing.jsx'), 'utf8');
    return /hidden sm:inline">\{de \? 'Anmelden'/.test(s);
  }],
  /**
   * Der Dialog darf nicht auseinandergehen.
   *
   * Datumsfelder bekommen vom Browser eine Eigenbreite nach der Schrift im
   * Feld — mit der Pixelschrift gut 400 Pixel. Weil diese Eigenbreite
   * zugleich die MINDESTbreite ist, schob ein Feldpaar den Inhalt des
   * Terminfensters um 347 Pixel aus einem 512 Pixel breiten Dialog heraus.
   * Zwei Regeln halten dagegen, und beide werden hier geprüft.
   */
  ['Datumsfelder dürfen schrumpfen', () => w(R, '#startfeld', 'min-width') === '0'],
  ['und stehen im Retro untereinander', () => w(R, '#datumspaar', 'grid-template-columns') === '1fr'],
  ['ohne Theme bleibt es bei zwei Spalten', () => w(N, '#datumspaar', 'grid-template-columns') !== '1fr'],
  ['jeder Dialog lässt seine Kinder schrumpfen', () => {
    const s = fs.readFileSync(path.join(wurzel, 'src/components/ui/dialog.jsx'), 'utf8');
    return s.includes('[&>*]:min-w-0');
  }],
  /**
   * Der Assistent schwebt unten rechts — und zwar mit Sicherheitsabstand.
   *
   * Auf dem iPhone liegt unten die Streifenleiste zum Wechseln der App. Ein
   * Knopf mit festem Abstand von 16 Pixeln sitzt genau darüber: Man zielt
   * auf die Figur und wechselt die Anwendung. `env(safe-area-inset-bottom)`
   * kommt vom Gerät und ist auf allen anderen null — deshalb steht hier
   * nicht "16 Pixel", sondern "eine Rechnung mit dem Geräteabstand darin".
   */
  ['der Assistent steht fest im Bild', () => w(R, '#assistent', 'position') === 'fixed'],
  ['unten rechts mit Sicherheitsabstand', () => {
    const u = w(R, '#assistent', 'bottom') || '';
    const r = w(R, '#assistent', 'right') || '';
    return u.includes('safe-area-inset-bottom') && r.includes('safe-area-inset-right');
  }],
  ['und ist gross genug zum Antippen', () => {
    // 44 Pixel sind das Mindestmass; als frei schwebendes Ziel etwas mehr.
    const b = w(R, '#assistent', 'width');
    return b === '3.5rem' || b === '56px';
  }],
  /**
   * Und die Erwähnungs-Meldung legt sich nicht darauf.
   *
   * Sie ist auf dem Handy fast so breit wie der Bildschirm und säße sonst
   * genau auf dem Knopf. 16 + 56 + 12 = 84 Pixel = 5.25rem.
   */
  ['die Erwähnung hält den Knopf frei', () => {
    const u = w(R, '#erwaehnung', 'bottom') || '';
    return u.includes('5.25rem') && u.includes('safe-area-inset-bottom');
  }],
  ['die Spalte hat eine Kante', () => /solid/.test(w(R, '#kanbanspalte', 'border') || '')],
  ['ohne Theme bleibt alles hell', () => farbe(w(N, 'main', 'background-color'))?.join() !== zuRgb(palette['--r-grass']).join()],

  /**
   * Die `hover:`-Varianten.
   *
   * Sie lassen sich nicht über `matches()` prüfen — ein Element, über dem
   * keine Maus schwebt, passt auf keinen `:hover`-Selektor. Geprüft wird
   * deshalb, DASS es die Regeln im gebauten Stylesheet überhaupt gibt: Genau
   * ihr Fehlen war der Grund, warum der Menü-Knopf beim Überfahren weiss
   * wurde und sein Symbol darin verschwand.
   */
  ['Überfahren wird mitgenommen', () => {
    // Gesucht wird der VOLLSTÄNDIGE Selektor mit dem Theme davor. Nur nach
    // `hover\\:bg-slate-100:hover` zu suchen fände Tailwinds eigene Regel und
    // wäre immer grün — der erste Anlauf dieser Prüfung tat genau das.
    const praefix = 'data-theme=retro] .theme-scope .';
    return ['hover\\:bg-slate-100:hover', 'hover\\:bg-black:hover', 'hover\\:text-white:hover']
      .every((k) => css.includes(praefix + k));
  }],

  /**
   * Und die hellen Töne müssen ihren FARBTON behalten. Beim Mischen mit dem
   * Pergament wurde aus Blau ein Grau — die Kanban-Spalte "In Arbeit" sah
   * ausgegraut aus. Gemessen wird die Buntheit: Abstand zwischen stärkstem
   * und schwächstem Kanal.
   */
  ['helles Blau bleibt blau', () => {
    const c = zuRgb(w(R, '#spalteblau', 'background-color') || '#000');
    return Math.max(...c.slice(0, 3)) - Math.min(...c.slice(0, 3)) > 40 && c[2] > c[0];
  }],

  // Der Kontrast-Rundgang
  [`${kombis.size} Klassenpaare über ${SCHWELLE}:1`, () => schwach.length === 0],

  // Bewegung bleibt unangetastet — das war die ausdrückliche Bedingung.
  [
    'Theme rührt keine Übergänge an',
    () => !/transition|transform/.test(
      fs.readFileSync(path.join(wurzel, 'src/styles/theme-retro.css'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ''),
    ),
  ],
];

let fehler = 0;
for (const [name, pruefen] of faelle) {
  let ok = false;
  try {
    ok = pruefen();
  } catch {
    ok = false;
  }
  console.log(`  ${ok ? 'OK  ' : 'FEHL'}  ${name}`);
  if (!ok) fehler++;
}

if (schwach.length) {
  console.log('\nZu schwacher Kontrast:');
  for (const t of schwach.sort((a, b) => a.wert - b.wert)) {
    console.log(`  ${String(t.wert).padStart(5)}  ${t.b} + ${t.t}   ${t.f}:${t.zeile}`);
  }
}

console.log(
  fehler === 0
    ? `\n${faelle.length} Zusicherungen, alle grün (${cssDatei}).`
    : `\n${fehler} von ${faelle.length} Zusicherungen fehlgeschlagen.`,
);
process.exit(fehler ? 1 : 0);
