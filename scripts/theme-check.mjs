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

  // Die Farbfamilien — hier steht !important gegen !important
  ['Grün wird Moos', () => w(R, '#fertig', 'background-color') === 'var(--r-moss)'],
  ['Türkis fällt auf Blau', () => w(R, '#tuerkis', 'background-color') === 'var(--r-sky)'],
  ['Lila fällt auf Pflaume', () => w(R, '#lila', 'background-color') === 'var(--r-plum)'],
  ['Gelb wird Gold', () => w(R, '#gelb', 'background-color') === 'var(--r-gold)'],
  ['Rot wird Blut', () => w(R, '#rot', 'background-color') === 'var(--r-blood)'],

  // Gegenprobe: ohne Theme darf sich NICHTS ändern
  ['Ohne Theme: Karte weiß', () => /255 255 255/.test(w(N, '#karte', 'background-color') || '')],
  ['Ohne Theme: Seitenleiste weiß', () => /255 255 255/.test(w(N, 'aside', 'background-color') || '')],
  ['Ohne Theme: keine Pixelschrift', () => !/Press Start 2P/.test(w(N, '#cta', 'font-family') || '')],
  ['Ohne Theme: Farben wie gehabt', () => w(N, '#fertig', 'background-color') === '#0a0a0a'],

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

console.log(
  fehler === 0
    ? `\n${faelle.length} Zusicherungen, alle grün (${cssDatei}).`
    : `\n${fehler} von ${faelle.length} Zusicherungen fehlgeschlagen.`,
);
process.exit(fehler ? 1 : 0);
