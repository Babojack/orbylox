/**
 * Prüft die Themes gegen das GEBAUTE CSS.
 *
 *   npm run build && npm run check:theme
 *
 * Geprüft werden das Retro und das Halloween. Das Standard-Aussehen kommt als
 * Gegenprobe vor: An ihm muss sich NICHTS ändern.
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

/**
 * Spezifität nach Vorschrift — einschliesslich `:is()`, `:not()` und `:where()`.
 *
 * WARUM DAS NICHT MIT EINEM REGULÄREN AUSDRUCK GEHT
 * Der erste Anlauf zählte jede Klammer und jedes `[…]` mit, auch die in einem
 * `:not(:is(…))`. Die Regel für Überschriften auf dem Nachthimmel enthält
 * darin rund fünfzig Attributselektoren — sie kam damit auf eine Spezifität,
 * die im Browser niemand hat, und schlug hier Regeln, gegen die sie in
 * Wirklichkeit verliert. Die Prüfung meldete daraufhin Fehler, die es nicht
 * gab, und hätte umgekehrt echte übersehen.
 *
 * Die Vorschrift ist einfach: `:is()`, `:not()` und `:has()` zählen so viel
 * wie ihr STÄRKSTES Argument, `:where()` gar nichts. Also einmal von Hand
 * durch die Klammern gehen.
 */
function spezifitaet(sel) {
  const s = sel.replace(/\\./g, 'x');
  let ids = 0; let klassen = 0; let elemente = 0;

  /** Findet die zur Klammer bei `i` gehörende schliessende Klammer. */
  const zu = (txt, i) => {
    let t = 0;
    for (let k = i; k < txt.length; k += 1) {
      if (txt[k] === '(') t += 1;
      else if (txt[k] === ')') { t -= 1; if (t === 0) return k; }
    }
    return txt.length;
  };
  /** Zerlegt einen Argumentteil an Kommas der OBERSTEN Ebene. */
  const teile = (txt) => {
    const raus = []; let t = 0; let letzt = 0;
    for (let k = 0; k < txt.length; k += 1) {
      if (txt[k] === '(') t += 1;
      else if (txt[k] === ')') t -= 1;
      else if (txt[k] === ',' && t === 0) { raus.push(txt.slice(letzt, k)); letzt = k + 1; }
    }
    raus.push(txt.slice(letzt));
    return raus.filter((x) => x.trim());
  };

  let rest = '';
  for (let i = 0; i < s.length; i += 1) {
    const m = /^:(is|not|has|where|matches|any)\(/i.exec(s.slice(i));
    if (!m) { rest += s[i]; continue; }
    const auf = i + m[0].length - 1;
    const ab = zu(s, auf);
    const inhalt = s.slice(auf + 1, ab);
    if (!/^where$/i.test(m[1])) {
      const beste = Math.max(0, ...teile(inhalt).map((a) => spezifitaet(a)));
      ids += Math.floor(beste / 10000);
      klassen += Math.floor((beste % 10000) / 100);
      elemente += beste % 100;
    }
    i = ab;
  }

  ids += (rest.match(/#[\w-]+/g) || []).length;
  klassen +=
    (rest.match(/\.[\w-]+/g) || []).length +
    (rest.match(/\[[^\]]*\]/g) || []).length +
    // übrige Pseudoklassen (`:hover`, `:focus-visible`, …) zählen wie Klassen,
    // Pseudoelemente (`::before`) wie Elemente.
    (rest.match(/(?<!:):(?!:)[\w-]+/g) || []).length;
  elemente +=
    (rest.replace(/\[[^\]]*\]/g, '').replace(/:{1,2}[\w-]+/g, ' ')
      .match(/(^|[\s>+~])([a-zA-Z][\w-]*)/g) || []).length +
    (rest.match(/::[\w-]+/g) || []).length;

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
    <div><span class="text-[9px] text-slate-500" id="navunterzeile">Free project management</span></div>
    <a class="flex items-center gap-3 px-4 py-3 border-2 border-black bg-white text-black" id="navpunkt2">Feed</a>
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
      <p class="text-[10px] font-bold uppercase text-[#ef5a24]" id="markeaufholz">Fokus</p>
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
      <div class="bg-green-50" id="spaltegruen"></div>
      <section data-figur-buehne="" class="border-b-2 border-black bg-[#f5f5f5]" id="buehne">
        <h2 id="buehnentitel">Dein Projekt, in einer Hand.</h2>
        <p class="text-slate-600" id="buehnentext">Aufgaben, Notizen, Chat und Dateien.</p>
        <ul><li id="buehnenpunkt">Behaelt alles im Blick</li></ul>
      </section>
      <h2 class="text-2xl font-black" id="seitentitel">Kanban Board</h2>
      <p class="text-slate-500" id="freitext">Neuigkeiten, Ankündigungen und Team-Diskussionen.</p>
      <div class="bg-white rounded-xl" id="tafel"><p class="text-slate-500" id="tafeltext">Nebensache</p></div>
      <div data-kanban-board="" class="flex gap-3 overflow-auto pb-4 flex-1" id="brett">
        <div data-kanban-column="" class="bg-slate-50/50 rounded-2xl border min-h-[60vh]" id="kanbanspalte">
          <div class="p-4 border-b border-slate-100 rounded-t-2xl bg-green-50" id="spaltenkopf">
            <h3 class="font-semibold text-slate-700" id="spaltentitel">Fertig</h3>
          </div>
          <div class="flex-1 p-2 space-y-2" id="spaltenrumpf">
            <div class="bg-white rounded-xl border-2 border-black" id="kanbankarte">Aufgabe</div>
          </div>
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

/** `theme` ist 'retro', 'halloween' oder null für das Standard-Aussehen. */
function baum(theme) {
  const dom = new JSDOM(
    `<!doctype html><html${theme ? ` data-theme="${theme}"` : ''}>` +
      `<body class="${theme ? 'theme-scope' : ''}">${MARKUP}</body></html>`,
  );
  return dom.window.document;
}

const R = baum('retro');
const N = baum(null);
const H = baum('halloween');
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

const themeCss = (name) => fs.readFileSync(path.join(wurzel, `src/styles/theme-${name}.css`), 'utf8');

const paletteVon = (quelle, praefix) => Object.fromEntries(
  [...quelle.matchAll(new RegExp(`(--${praefix}-[\\w-]+):\\s*(#[0-9a-fA-F]{6})`, 'g'))]
    .map((m) => [m[1], m[2]]),
);

const palette = paletteVon(themeCss('retro'), 'r');
const paletteH = paletteVon(themeCss('halloween'), 'h');
/* Ein gemeinsames Nachschlagewerk: Die Präfixe `--r-` und `--h-` können sich
   nicht in die Quere kommen, also braucht `farbe()` nicht zu wissen, welches
   Theme gerade gemessen wird. */
const alleFarben = { ...palette, ...paletteH };

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
  if (v) return alleFarben[v[1]] ? zuRgb(alleFarben[v[1]]) : null;
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

function messen(klassen, theme) {
  const dom = new JSDOM(`<!doctype html><html${theme ? ` data-theme="${theme}"` : ''}>` +
    `<body class="${theme ? 'theme-scope' : ''}"><span id="x" class="${klassen}"></span></body></html>`);
  const el = dom.window.document.getElementById('x');
  return { bg: farbe(gewinner(el, 'background-color')?.wert), fg: farbe(gewinner(el, 'color')?.wert) };
}

/**
 * Derselbe Rundgang, einmal je Theme.
 *
 * Als Untergrund für halbdurchsichtige Flächen dient das Pergament des
 * jeweiligen Themes: Wo etwas durchscheint, liegt fast immer eine Karte
 * darunter, nicht die Grundfläche.
 */
function rundgang(theme, pergament) {
  const raus = [];
  for (const [key, k] of kombis) {
    if (BEKANNT.has(key)) continue;
    const r = messen(`${k.b} ${k.t}`, theme);
    if (!r.bg || !r.fg) continue;
    const grund = ueber(r.bg, pergament);
    const wert = kontrast(grund, ueber(r.fg, grund));
    if (wert < SCHWELLE) raus.push({ ...k, wert: wert.toFixed(2) });
  }
  return raus;
}

const schwach = rundgang('retro', zuRgb(palette['--r-parch']));
const schwachH = rundgang('halloween', zuRgb(paletteH['--h-parch']));

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
  /**
   * Ueberfahr-Regeln nur fuer Geraete mit Zeiger.
   *
   * Auf manchen Handys musste man zweimal tippen, bis ein Knopf reagierte.
   * Kein Fehler in einem Knopf, sondern eine Eigenschaft des Browsers: Safari
   * behandelt den ersten Tipp auf ein Element, dessen Aussehen sich beim
   * Schweben deutlich aendert, als "daraufzeigen" — und erst den zweiten als
   * Klick. Die auffaelligste solche Aenderung war das Anheben um drei Pixel
   * samt Schatten, das JEDER Knopf hatte.
   *
   * Geprueft wird am gebauten Stylesheet, nicht am Quelltext: Tailwind
   * klammert seine Regeln selbst (`hoverOnlyWhenSupported`), die
   * handgeschriebenen mussten von Hand geklammert werden — hier faellt auf,
   * wenn eine der beiden Quellen es wieder vergisst.
   *
   * Die wenigen Ausnahmen sind Regeln, die einen Effekt ABSCHALTEN
   * (`transform: none`, `--tw-scale: 1`). Sie duerfen ueberall gelten.
   */
  ['Überfahren gilt nur mit Zeiger', () => {
    const alle = (css.match(/:hover/g) || []).length;
    let drin = 0; let i = 0;
    while ((i = css.indexOf('@media (hover', i)) >= 0) {
      let j = css.indexOf('{', i); let tiefe = 0; let k = j;
      do { if (css[k] === '{') tiefe += 1; else if (css[k] === '}') tiefe -= 1; k += 1; } while (tiefe > 0 && k < css.length);
      drin += (css.slice(j, k).match(/:hover/g) || []).length;
      i = k;
    }
    // Weniger als 15 ungeklammerte heisst: nur noch die Abschalt-Regeln.
    return alle > 100 && (alle - drin) < 15;
  }],
  ['und Druck ersetzt es auf Berührung', () => /@media \(hover: ?none\)/.test(css) && /scale\(\.?0?\.?97\)/.test(css)],
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

  /* ==================================================================
     HALLOWEEN
     ==================================================================

     Dieselbe Rechnung, andere Richtung: Im Retro ist der Grund mittelhell
     und die Schrift muss dunkel werden, hier ist er dunkel und die Schrift
     muss hell werden. Die Fehler, die dabei passiert sind, stehen jeweils
     an der Zusicherung, die sie festhält.
  */

  // Flächen
  ['HW: Grundfläche wird Nacht', () => farbe(w(H, 'body', 'background-color'))?.join() === zuRgb(paletteH['--h-night']).join()],
  ['HW: Seitenleiste wird Holz', () => w(H, 'aside', 'background-color') === 'var(--h-wood)'],
  ['HW: Kopfzeile wird Holz', () => w(H, 'header', 'background-color') === 'var(--h-wood)'],
  ['HW: Karte wird Pergament', () => w(H, '#karte', 'background-color') === 'var(--h-parch)'],
  ['HW: Dialog wird Pergament', () => w(H, '#dialog', 'background-color') === 'var(--h-parch)'],
  ['HW: Eingabe wird Pergament', () => w(H, '#feld', 'background-color') === 'var(--h-parch)'],
  ['HW: Marke bleibt Kürbis', () => w(H, '#cta', 'background-color') === 'var(--h-pumpkin)'],
  ['HW: der Inhaltsbereich lässt die Nacht durch', () => w(H, 'main', 'background-color') === 'transparent'],
  ['HW: Verlauf wird glatte Fläche', () => /linear-gradient\(135deg/.test(w(H, '#verlauf', 'background-image') || '')],

  /**
   * Schrift auf dem Holz — und der Fehler, an dem es zweimal hing.
   *
   * Erst war ALLES in der Leiste pergamentfarben, auch die Beschriftung der
   * Menuepunkte, die selbst auf Pergament sitzt: eine Reihe leerer Kaesten.
   * Dann war das Gegenteil der Fall — der Nachsatz nahm alles aus, was in
   * einer Flaeche liegt, und weil die Leiste SELBST `bg-white` traegt, war
   * das ihr gesamter Inhalt. Die Unterzeile neben dem Logo stand dunkelbraun
   * auf dunklem Holz.
   *
   * Beide Zusicherungen zusammen halten die Regel in der Mitte fest.
   */
  ['HW: freier Text auf Holz wird hell', () => w(H, '#navtext', 'color') === 'var(--h-parch)'],
  ['HW: auch die kleine Unterzeile', () => w(H, '#navunterzeile', 'color') === 'var(--h-parch)'],
  ['HW: Menüpunkt auf eigenem Pergament bleibt dunkel', () => {
    const c = farbe(w(H, '#navpunkt2', 'color'));
    const p = zuRgb(paletteH['--h-parch']);
    return !!c && c.join() !== p.join();
  }],
  ['HW: Text in der Kopfzeile wird hell', () => w(H, '#projektname', 'color') === 'var(--h-parch)'],

  /**
   * Überschriften auf dem Nachthimmel.
   *
   * Auch hier hatte der Nachsatz `:not(:is(FLAECHEN) *)` statt
   * `:not(:is(FLAECHEN, main :is(FLAECHEN) *))` gestanden — und weil `main`
   * `bg-white` traegt, galt er fuer den gesamten Seiteninhalt. Die
   * Ueberschrift "Kanban Board" stand dunkelbraun auf der Nacht und war
   * praktisch unsichtbar.
   */
  ['HW: Überschrift auf der Nacht wird hell', () => w(H, '#seitentitel', 'color') === 'var(--h-mist)'],
  ['HW: freier Text auf der Nacht wird hell', () => w(H, '#freitext', 'color') === 'var(--h-lilac)'],
  ['HW: in der Karte bleibt er gedämpft', () => w(H, '#tafeltext', 'color') === 'var(--h-ink-dim)'],
  ['HW: Kartentitel wird Tinte', () => w(H, '#kartentitel', 'color') === 'var(--h-ink)'],

  /**
   * Das Brett: drei unterscheidbare Ebenen, wie im Retro.
   *
   * Die Spalte traegt `bg-slate-50/50` und faellt damit in den Farbblock,
   * der `!important` ist. Ohne eine eigene wichtige Regel haetten Tisch und
   * Karten fast denselben Ton gehabt.
   */
  ['HW: Spalte hebt sich von der Karte ab', () => {
    const sp = farbe(w(H, '#kanbanspalte', 'background-color'));
    const ka = farbe(w(H, '#kanbankarte', 'background-color'));
    return sp && ka && sp.join() !== ka.join() && kontrast(sp, ka) > 1.15;
  }],
  ['HW: und der Spaltenkopf bekommt seinen Pergament-Schleier', () => /linear-gradient/.test(w(H, '#spaltenkopf', 'background-image') || '')],

  /**
   * Helle Stufen dürfen ihren Farbton behalten — sonst ist der Hinweis weg,
   * welche Spalte welche ist. Sie sind aber gedämpft und warm unterlegt:
   * Eisblau neben Kürbis ist das Gegenteil von gemütlich.
   */
  ['HW: helles Blau bleibt vom Grün unterscheidbar', () => {
    const b = zuRgb(w(H, '#spalteblau', 'background-color') || '#000');
    const g = zuRgb(w(H, '#spaltegruen', 'background-color') || '#000');
    return b.join() !== g.join() && b[2] > b[1] && g[1] > g[2];
  }],
  /**
   * ... und sie sind gedämpft, nicht grell.
   *
   * Zwei Grenzen: Unter einer Spanne von 10 zwischen stärkstem und
   * schwächstem Kanal wäre die Farbe verschwunden, über 70 leuchtete sie
   * neben dem Kürbis wie eine Bonbonfarbe. Und sie müssen dunkler sein als
   * das Karten-Pergament — die Karte soll obenauf liegen, nicht der
   * Spaltenkopf. Roh aus Tailwind sind die 50er-Stufen fast weiss und
   * verletzen beides.
   */
  ['HW: helle Stufen sind gedämpft, nicht grell', () => {
    const p = zuRgb(paletteH['--h-parch']);
    return ['#spalteblau', '#spaltegruen'].every((id) => {
      const c = zuRgb(w(H, id, 'background-color') || '#000');
      const spanne = Math.max(...c.slice(0, 3)) - Math.min(...c.slice(0, 3));
      return spanne >= 10 && spanne <= 70 && leuchte(c) < leuchte(p);
    });
  }],
  ['HW: bg-slate-500 bleibt dunkel', () => w(H, '#dunkel', 'background-color') === '#2b1b3f'],

  /**
   * Die Spinnweben.
   *
   * Sie stehen als SVG in einer Data-URL. Beim ersten Anlauf blieb das `#`
   * vor dem Farbwert unkodiert — der Browser liest ab dort einen
   * Fragmentbezeichner, das Bild bricht mitten im `stroke` ab und es war
   * nichts zu sehen. Geprueft wird deshalb genau das: kein rohes `#` in
   * einer dieser URLs, und die Netze haengen an den Stellen, die gemeint
   * waren.
   */
  ['HW: Spinnweben ohne rohes # in der Data-URL', () => {
    const q = themeCss('halloween');
    const urls = [...q.matchAll(/url\("(data:image\/svg\+xml,[^"]*)"\)/g)].map((m) => m[1]);
    return urls.length >= 4 && urls.every((u) => !u.slice('data:image/svg+xml,'.length).includes('#'));
  }],
  ['HW: und mit %23 statt dessen', () => /stroke='%23d9d3bf'/.test(themeCss('halloween'))],
  ['HW: Netz in der Seitenleiste', () => /data:image\/svg/.test(w(H, 'aside', 'background-image') || '')],
  ['HW: Netz im Dialog', () => /data:image\/svg/.test(w(H, '#dialog', 'background-image') || '')],
  /**
   * Am Kartenbereich, nicht an der Spalte: An der Spalte lag das Netz hinter
   * dem deckenden Spaltenkopf und war nicht zu sehen.
   */
  ['HW: Netz im Kartenbereich der Spalte', () => /data:image\/svg/.test(w(H, '#spaltenrumpf', 'background-image') || '')],

  // Gegenprobe: ohne Theme ändert Halloween nichts
  ['HW: ohne Theme bleibt die Fläche hell', () => farbe(w(N, 'body', 'background-color'))?.join() !== zuRgb(paletteH['--h-night']).join()],
  ['HW: und im Retro auch nicht Nacht', () => farbe(w(R, 'body', 'background-color'))?.join() !== zuRgb(paletteH['--h-night']).join()],
  ['HW: keine Pixelschrift im Halloween', () => !/Press Start 2P/.test(w(H, '#cta', 'font-family') || '')],
  ['HW: und kein eigener Mauszeiger', () => !/data:image\/png/.test(w(H, 'body', 'cursor') || '')],

  /**
   * Der Umschalter kennt alle drei — und in derselben Reihenfolge.
   *
   * Die Kennungen stehen in den Konten der Leute (`applyTheme` schreibt sie
   * fort). Faellt eine aus der Liste, landet jemand beim naechsten Aufruf
   * still im Standard-Aussehen.
   */
  ['HW: drei Themes in der Liste', () => {
    const t = fs.readFileSync(path.join(wurzel, 'src/lib/theme.js'), 'utf8');
    return /THEMES\s*=\s*\[[^\]]*'default'[^\]]*'retro'[^\]]*'halloween'[^\]]*\]/.test(t);
  }],
  ['HW: und alle drei im Umschalter', () => {
    const t = fs.readFileSync(path.join(wurzel, 'src/lib/theme.js'), 'utf8');
    const s = fs.readFileSync(path.join(wurzel, 'src/components/common/ThemeSwitch.jsx'), 'utf8');
    const ids = [...t.matchAll(/id:\s*'([\w-]+)'/g)].map((m) => m[1]);
    return ids.join() === 'default,retro,halloween' && s.includes('THEME_LISTE.map');
  }],
  ['HW: das Stylesheet wird geladen', () => fs.readFileSync(path.join(wurzel, 'src/main.jsx'), 'utf8').includes('theme-halloween.css')],

  /**
   * Die Bühne für den Kürbis.
   *
   * Das Band mit der 3D-Figur trägt `bg-[#f5f5f5]`, ist also überall sonst
   * Pergament. Im Halloween muss es Nacht sein, sonst hat die Kerze im
   * Kürbis nichts zu beleuchten — und die Schrift daneben muss dann hell
   * werden. Beim ersten Anlauf blieb sie dunkelbraun: Der Nachsatz
   * `:not(:is(FLÄCHEN) *)` schloss alles aus, denn die Bühne SELBST ist
   * eine Fläche.
   */
  ['HW: die Figuren-Bühne wird zur Nacht', () => farbe(w(H, '#buehne', 'background-color'))?.join() === zuRgb(paletteH['--h-night-deep']).join()],
  ['HW: ihre Überschrift wird hell', () => w(H, '#buehnentitel', 'color') === 'var(--h-mist)'],
  ['HW: ihr Absatz auch', () => w(H, '#buehnentext', 'color') === 'var(--h-lilac)'],
  ['HW: und die Aufzählung daneben', () => w(H, '#buehnenpunkt', 'color') === 'var(--h-mist)'],
  ['HW: im Retro bleibt die Bühne, wie sie war', () => {
    const r = farbe(w(R, '#buehne', 'background-color'));
    return !!r && r.join() !== zuRgb(paletteH['--h-night-deep']).join();
  }],
  ['HW: ohne Theme erst recht', () => /245/.test(w(N, '#buehne', 'background-color') || '')],

  /**
   * Der Kürbis steht dort, wo sonst die Figur steht — und beide werden
   * einzeln nachgeladen.
   */
  ['HW: die Bühne zeigt im Halloween den Kürbis', () => {
    const s = fs.readFileSync(path.join(wurzel, 'src/components/landing/BotSection.jsx'), 'utf8');
    return /lazy\(\(\) => import\('\.\/HeroPumpkin'\)\)/.test(s)
      && /lazy\(\(\) => import\('\.\/HeroBot'\)\)/.test(s)
      && /theme === 'halloween' \? HeroPumpkin : HeroBot/.test(s);
  }],
  /* Sie liegen unter `src/assets`, nicht in `public/` — den Grund hält
     `check:bundle` fest ("der Kürbis trägt einen Inhaltsstempel"). */
  ['HW: Modell und Texturen liegen bereit', () => ['pumpkin.glb', 'pumpkin-albedo.webp',
    'pumpkin-emissive.webp', 'pumpkin-normal.webp', 'pumpkin-orm.webp']
    .every((f) => fs.existsSync(path.join(wurzel, 'src/assets/pumpkin', f)))],

  /**
   * Die Musik.
   *
   * Sie hing früher am Retro und nur an ihm; jetzt entscheidet `themeSound`,
   * welches Aussehen ein Stück hat. Zwei Dinge dürfen dabei nicht
   * verrutschen: Der Tonschalter muss dieselbe Quelle fragen (sonst steht er
   * im Halloween nicht da, obwohl Musik läuft), und der Speicherschlüssel
   * muss der alte bleiben — er steht in den Browsern der Leute, und ein
   * neuer Name setzte jedes "Ton aus" still zurück.
   */
  ['HW: Retro und Halloween haben je ein Stück', () => {
    const s = fs.readFileSync(path.join(wurzel, 'src/lib/themeSound.js'), 'utf8');
    return /retro:\s*retroQuelle/.test(s) && /halloween:\s*halloweenQuelle/.test(s);
  }],
  ['HW: der Umschalter startet das Stück des Aussehens', () => {
    const s = fs.readFileSync(path.join(wurzel, 'src/components/common/ThemeSwitch.jsx'), 'utf8');
    return /hatMusik\(id\)\s*\)?\s*musikStarten\(id\)/.test(s.replace(/\s+/g, ' '));
  }],
  ['HW: der Tonschalter fragt dieselbe Stelle', () => {
    const s = fs.readFileSync(path.join(wurzel, 'src/components/common/SoundSwitch.jsx'), 'utf8');
    return s.includes('if (!hatMusik(theme)) return null;') && !s.includes("theme !== 'retro'");
  }],
  ['HW: der Speicherschlüssel bleibt der alte', () => {
    const s = fs.readFileSync(path.join(wurzel, 'src/lib/themeSound.js'), 'utf8');
    return s.includes("'orbylox_retro_ton'");
  }],
  ['HW: und die Musikdatei ist nicht zu schwer', () => {
    // 96 kbit/s wie das Retro-Stück; roh waren es 256.
    const b = fs.statSync(path.join(wurzel, 'src/assets/halloween-theme.mp3')).size;
    return b > 0 && b < 2.2 * 1024 * 1024;
  }],
  ['HW: Theme rührt keine Übergänge an', () => !/transition|transform:/.test(
    themeCss('halloween').replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\("[^"]*"\)/g, ''),
  )],

  /**
   * Die Markenfarbe als Schrift: dunkel auf Pergament, hell auf Holz.
   *
   * Auf Pergament ergibt das rohe Orange 2,7:1 — deshalb wird es gedunkelt.
   * Genau diese Regel liess dann die Zeile "FOKUS" über der Aufgabe im
   * Holz der Kopfzeile verschwinden. Beide Richtungen stehen hier fest,
   * für beide Themes.
   */
  ['Marke als Schrift wird auf Pergament dunkler', () => {
    const r = farbe(w(R, '#markentext', 'color'));
    const h = farbe(w(H, '#markentext', 'color'));
    const roh = zuRgb('#ef5a24');
    return !!r && !!h && r.join() !== roh.join() && h.join() !== roh.join()
      && leuchte(r) < leuchte(roh) && leuchte(h) < leuchte(roh);
  }],
  ['und auf dem Holz heller', () => {
    for (const [doc, holz] of [[R, palette['--r-wood']], [H, paletteH['--h-wood']]]) {
      const c = farbe(w(doc, '#markeaufholz', 'color'));
      if (!c) return false;
      if (kontrast(c, zuRgb(holz)) < 4) return false;
    }
    return true;
  }],

  /**
   * Der Fokusmodus.
   *
   * Zwei Zusicherungen am Quelltext, weil beide Fehler mit Farben nicht zu
   * fassen sind:
   *
   *   1. Auf dem Handy war KEINE EINZIGE Teilaufgabe zu sehen. Die beiden
   *      Spalten scrollten dort für sich — in einer Höhe, die es gar nicht
   *      gab. Jedes `overflow` und jedes `min-h-0` im Inhalt muss deshalb an
   *      `lg:` hängen; nur ab zwei Spalten gibt es eine Höhe zu verteilen.
   *   2. Fokus und Ticket-Dialog müssen DIESELBEN Abfrageschlüssel benutzen.
   *      Sonst hakt man im Fokus etwas ab, öffnet das Ticket und sieht es
   *      wieder offen — zwei Wahrheiten über dieselbe Teilaufgabe.
   */
  ['Fokus: die Spalten scrollen erst ab zwei Spalten', () => {
    const f = fs.readFileSync(path.join(wurzel, 'src/components/focus/TaskFocus.jsx'), 'utf8');
    const inhalt = f.slice(f.indexOf('Zwei Spalten ab'), f.indexOf('---------------------------------------------------- Fuss'));
    // Kein nacktes `overflow-y-auto` oder `min-h-0` mehr in den Spalten.
    const nackt = (inhalt.match(/className="[^"]*"/g) || [])
      .filter((k) => /(?<!lg:)(overflow-y-auto|min-h-0)/.test(k.replace(/lg:(overflow-y-auto|min-h-0)/g, '')))
      .filter((k) => !k.includes('grid-cols-1'));   // die Hülle scrollt absichtlich
    return nackt.length === 0 && /lg:flex-1 lg:min-h-0 lg:overflow-y-auto/.test(inhalt);
  }],
  ['Fokus und Ticket-Dialog teilen ihre Abfragen', () => {
    const f = fs.readFileSync(path.join(wurzel, 'src/components/focus/TaskFocus.jsx'), 'utf8');
    const d = fs.readFileSync(path.join(wurzel, 'src/components/kanban/TaskDetailDialog.jsx'), 'utf8');
    return ["['subtasks', task", "['taskComments', task"].every((k) => d.includes(k))
      && ["['subtasks', taskId]", "['taskComments', taskId]"].every((k) => f.includes(k));
  }],
  ['Fokus stösst die Zähler auf dem Brett an', () => {
    const f = fs.readFileSync(path.join(wurzel, 'src/components/focus/TaskFocus.jsx'), 'utf8');
    return f.includes("['allSubtasks', projectId]") && f.includes("['allComments', projectId]");
  }],

  /**
   * Die Szene auf der Startseite.
   *
   * Im Halloween wird jedes Band der Startseite zur Nacht — zur TIEFEN Nacht
   * der Szene, nicht zum helleren Violett der Flächen im Vordergrund. Beim
   * ersten Anlauf war es das Violett, und auf dem Bild stand ein violetter
   * Block zwischen zwei Bildstreifen: "Was sind die blauen Sachen, die den
   * Hintergrund verdecken?"
   */
  ['HW: die Bänder der Startseite werden zur tiefen Nacht', () => farbe(w(H, '#wiese', 'background-color'))?.join()
    === zuRgb(paletteH['--h-night-deep']).join()],
  /**
   * Die Szene liegt randlos hinter Hero und "Warum" — ein Bild, `cover`,
   * keine Streifen und keine Fläche dazwischen.
   */
  ['HW: die Szene füllt den Abschnitt ganz', () => {
    const q = themeCss('halloween');
    const m = q.match(/\[data-hw-szene\]\s*\{([^}]*)\}/);
    return !!m && /halloween-szene\.webp/.test(m[1]) && /background-size:\s*cover/.test(m[1])
      && !/himmel|boden/.test(m[1]);
  }],

  /**
   * DER FEHLER, DER DREIMAL PASSIERT IST.
   *
   * `:not(:is(FLÄCHEN) *)` heisst "nicht innerhalb einer Fläche" — und weil
   * das Band SELBST `bg-[#f5f5f5]` trägt, war sein gesamter Inhalt
   * ausgenommen. Die Überschrift stand dunkelbraun auf der Nacht. Vorher
   * schon einmal an `aside` (die Unterzeile neben dem Logo) und einmal an
   * `main` (die Überschrift "Kanban Board") passiert.
   */
  ['HW: die Überschrift darauf wird hell', () => w(H, '#wiesentitel', 'color') === 'var(--h-mist)'],
  ['HW: in einer Karte darauf bleibt sie dunkel', () => {
    const c = farbe(w(H, '#karteninhalt', 'color'));
    const mist = zuRgb(paletteH['--h-mist']);
    return !!c && c.join() !== mist.join();
  }],
  ['HW: ohne Theme bleibt das Band hell', () => /245/.test(w(N, '#wiese', 'background-color') || '')],

  ['HW: der geschnitzte Schriftzug ersetzt die Wortmarke', () => {
    const f = fs.readFileSync(path.join(wurzel, 'src/pages/Landing.jsx'), 'utf8');
    return /halloween \? \(\s*<img/.test(f.replace(/\s+/g, ' '))
      && f.includes('halloween-wortmarke.webp');
  }],
  ['HW: die Bilder der Szene liegen bereit', () => ['halloween-szene.webp',
    'halloween-wortmarke.webp'].every((f) => fs.existsSync(path.join(wurzel, 'src/assets/halloween', f)))],

  /**
   * Im Halloween sitzt der Kürbis im Assistentenknopf — und der Knopf wird
   * dunkel.
   *
   * Sonst ist er kürbisorange, und ein oranger Kürbis darauf ist kein Bild,
   * sondern ein Fleck. Geprüft wird beides: dass die Figur nach dem Theme
   * gewählt wird, und dass der Knopf im Halloween nicht mehr orange ist.
   */
  ['HW: der Kürbis sitzt im Assistentenknopf', () => {
    const f = fs.readFileSync(path.join(wurzel, 'src/components/assistant/AssistantBot.jsx'), 'utf8');
    return /const istKuerbis = theme === 'halloween'/.test(f) && f.includes('ladeKuerbis');
  }],
  ['HW: und der Knopf wird dunkel', () => {
    const q = themeCss('halloween');
    return /\[data-assistant-button\]\s*\{[^}]*--h-night-2/.test(q);
  }],

  /**
   * Das Standbild fürs Profilbild hängt an der ZEIT, nicht an einer Anzahl
   * Bilder.
   *
   * "Nach 12 Bildern" war eine Annahme über die Geschwindigkeit des Geräts.
   * Gemessen auf einem Rechner ohne Grafikbeschleunigung: zwei Bilder je
   * Sekunde, nach fünf Sekunden elf — das Profilbild kam nie, und im Chat
   * stand neben jeder Antwort ein leerer Kreis.
   */
  ['das Profilbild wartet auf Zeit, nicht auf Bilder', () => {
    const f = fs.readFileSync(path.join(wurzel, 'src/components/assistant/AssistantBot.jsx'), 'utf8');
    return /MS_BIS_STANDBILD/.test(f)
      && /performance\.now\(\) - daSeit >= MS_BIS_STANDBILD/.test(f)
      && !/frames >= 12/.test(f);
  }],

  /**
   * Das Band der Liegengebliebenen ist ein `aside` — und bekam dadurch im
   * Halloween das Spinnennetz der Seitenleiste, mitten über seine
   * Überschrift. Holz darf es behalten, das Netz nicht.
   */
  ['HW: kein Netz auf dem Band über der Liste', () => {
    const q = themeCss('halloween');
    return /aside\[class\]:not\(\[data-liegengeblieben\]\)/.test(q);
  }],

  // Der Kontrast-Rundgang
  [`${kombis.size} Klassenpaare über ${SCHWELLE}:1 (Retro)`, () => schwach.length === 0],
  [`${kombis.size} Klassenpaare über ${SCHWELLE}:1 (Halloween)`, () => schwachH.length === 0],

  // Bewegung bleibt unangetastet — das war die ausdrückliche Bedingung (Retro).
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

for (const [wo, liste] of [['Retro', schwach], ['Halloween', schwachH]]) {
  if (!liste.length) continue;
  console.log(`\nZu schwacher Kontrast (${wo}):`);
  for (const t of liste.sort((a, b) => a.wert - b.wert)) {
    console.log(`  ${String(t.wert).padStart(5)}  ${t.b} + ${t.t}   ${t.f}:${t.zeile}`);
  }
}

console.log(
  fehler === 0
    ? `\n${faelle.length} Zusicherungen, alle grün (${cssDatei}).`
    : `\n${fehler} von ${faelle.length} Zusicherungen fehlgeschlagen.`,
);
process.exit(fehler ? 1 : 0);
