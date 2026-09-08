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
  </aside>
  <main class="flex-1 bg-white min-h-screen flex flex-col">
    <header class="h-16 border-b border-slate-50 sticky top-0 bg-white/95 z-50">
      <h1 class="font-semibold text-slate-800" id="projektname">Website-Relaunch</h1>
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
      <section class="bg-[#f5f5f5]" id="woanders"><span class="text-[#ef5a24]" id="markentext">x</span></section>
    </div>
  </main>
  <div role="dialog" class="bg-white rounded-2xl shadow-2xl" id="dialog">
    <h2 id="dialogtitel">Projekt löschen</h2>
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
  ['bg-amber-50 bleibt zart', () => w(R, '#gelb', 'background-color') === '#e2d0a4'],

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
  ['Wiese nur auf der Startseite', () => w(R, '#woanders', 'background-color') === 'transparent'],

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
