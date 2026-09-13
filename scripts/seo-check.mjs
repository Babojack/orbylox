/**
 * Was Google zu sehen bekommt — nachgesehen, nicht angenommen.
 *
 *   npm run build && npm run check:seo
 *
 * WARUM ES DIESE DATEI GIBT
 * In der Search Console standen Impressionen und NULL Klicks. Der Grund war
 * nicht der Text der Seiten, sondern ihr Kopf: `index.html` beantwortet jede
 * Adresse ausser dem Blog, und dort stand `<title>ORBYLOX</title>`, keine
 * Beschreibung, kein Canonical, `lang="en"` auf einer deutschen Seite. Die
 * ganze Anwendung hatte damit EINEN Titel — in der Trefferliste stand nichts,
 * worauf man klicken wollte.
 *
 * Das ist ein Fehler, den man im Betrieb nie bemerkt: Die Seite sieht richtig
 * aus, funktioniert richtig, und nur die Suchmaschine sieht das Nichts.
 * Deshalb steht er hier fest.
 *
 * WAS GEPRÜFT WIRD
 *   1. Der ausgelieferte Kopf: Titel, Beschreibung, Canonical, Sprache,
 *      Vorschaubild, gültiges JSON-LD.
 *   2. Keine erfundenen Bewertungen in der Auszeichnung.
 *   3. Die Beiträge: Titel und Beschreibungen in den Längen, die Google
 *      wirklich anzeigt, jeder Beitrag mit Gegenstück in der anderen Sprache.
 *   4. Jede Seite, die einen eigenen Kopf setzen soll, tut das auch.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distIndex = path.join(wurzel, 'dist', 'index.html');

if (!fs.existsSync(distIndex)) {
  console.error('Kein dist/index.html — bitte zuerst: npm run build');
  process.exit(2);
}

const html = fs.readFileSync(distIndex, 'utf8');
/* Kommentare raus, bevor gesucht wird: Im Kopf dieser Datei steht die
   Geschichte des Fehlers, und darin kommen Wörter wie `title` vor. */
const ohneKommentare = html.replace(/<!--[\s\S]*?-->/g, '');

const zwischen = (re) => (ohneKommentare.match(re) || [])[1] || '';
const titel = zwischen(/<title>([^<]*)<\/title>/);
const beschreibung = zwischen(/<meta\s+name="description"\s+content="([^"]*)"/);
const canonical = zwischen(/<link\s+rel="canonical"\s+href="([^"]*)"/);
const sprache = zwischen(/<html\s+lang="([^"]*)"/);
const ogBild = zwischen(/<meta\s+property="og:image"\s+content="([^"]*)"/);

let ld = null;
let ldFehler = '';
const ldRoh = zwischen(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
try { ld = JSON.parse(ldRoh); } catch (e) { ldFehler = e.message; }

const seed = JSON.parse(fs.readFileSync(path.join(wurzel, 'public/api/blog-posts.seed.json'), 'utf8'));

/* Die Grenzen, ab denen Google abschneidet. Keine Wunschwerte, sondern die
   Breite, die in der Trefferliste dargestellt wird. */
const TITEL_MAX = 65;
const META_MAX = 160;
const META_MIN = 70;

const seiten = ['src/pages/Landing.jsx', 'src/pages/About.jsx', 'src/pages/Impressum.jsx'];

const pruefungen = [
  /* --------------------------------------------- Der ausgelieferte Kopf */

  [`Startseite hat einen echten Titel (${titel.length} Zeichen)`,
    () => titel.length > 20 && titel.length <= TITEL_MAX && titel !== 'ORBYLOX'],
  [`und eine Beschreibung (${beschreibung.length} Zeichen)`,
    () => beschreibung.length >= META_MIN && beschreibung.length <= META_MAX],
  ['Titel und Beschreibung nennen, worum es geht', () => {
    const text = (titel + ' ' + beschreibung).toLowerCase();
    return ['projektmanagement', 'kanban'].every((w) => text.includes(w));
  }],
  ['Canonical zeigt auf die eigene Adresse', () => canonical === 'https://orbylox.de/'],
  ['die Seite gibt sich als deutsch aus', () => sprache === 'de'],
  ['es gibt ein Vorschaubild', () => ogBild.startsWith('https://orbylox.de/')],

  /* -------------------------------------------------- Die Auszeichnung */

  [`JSON-LD ist gültiges JSON${ldFehler ? ` (${ldFehler})` : ''}`, () => !!ld],
  ['und beschreibt die Anwendung', () => {
    const knoten = ld?.['@graph'] || [];
    const app = knoten.find((k) => k['@type'] === 'SoftwareApplication');
    return !!app && app.offers?.price === '0';
  }],
  /**
   * KEINE erfundenen Bewertungen.
   *
   * Sterne in der Trefferliste sind das Erste, was man sich wünscht, und das
   * Erste, was man fälscht. Es gibt keine Bewertungen; `aggregateRating`
   * wäre also schlicht gelogen, verstösst gegen Googles Richtlinien und
   * kostet im Zweifel die ganze Auszeichnung.
   */
  ['keine erfundenen Bewertungen', () => !ohneKommentare.includes('aggregateRating')
    && !ohneKommentare.includes('reviewCount')],

  /* --------------------------------------------- Jede Seite ihr Eigenes */

  ['jede öffentliche Seite setzt ihren eigenen Kopf', () => seiten.every((f) => {
    const q = fs.readFileSync(path.join(wurzel, f), 'utf8');
    return /<Seo\b/.test(q) && /pfad="/.test(q);
  })],
  ['und keine setzt den Titel noch von Hand', () => seiten.every((f) => {
    const q = fs.readFileSync(path.join(wurzel, f), 'utf8');
    return !/document\.title\s*=/.test(q);
  })],

  /* ------------------------------------------------------- Die Beiträge */

  [`${seed.length} Beiträge: Titel unter ${TITEL_MAX} Zeichen`, () => {
    const zuLang = seed.filter((p) => (p.seo_title || p.title || '').length > TITEL_MAX);
    if (zuLang.length) console.log('        ' + zuLang.map((p) => `${p.slug} (${(p.seo_title || p.title).length})`).join(', '));
    return zuLang.length === 0;
  }],
  [`Beschreibungen zwischen ${META_MIN} und ${META_MAX} Zeichen`, () => {
    const daneben = seed.filter((p) => {
      const n = (p.meta_description || '').length;
      return n < META_MIN || n > META_MAX;
    });
    if (daneben.length) console.log('        ' + daneben.map((p) => `${p.slug} (${(p.meta_description || '').length})`).join(', '));
    return daneben.length === 0;
  }],
  ['jeder Beitrag hat ein Gegenstück in der anderen Sprache', () => {
    const bekannt = new Set(seed.map((p) => p.slug));
    const ohne = seed.filter((p) => !p.translation_of || !bekannt.has(p.translation_of));
    if (ohne.length) console.log('        ' + ohne.map((p) => p.slug).join(', '));
    return ohne.length === 0;
  }],
  ['keine zwei Beiträge tragen denselben Titel', () => {
    const gesehen = new Map();
    for (const p of seed) {
      const t = (p.seo_title || p.title || '').trim();
      if (gesehen.has(t)) { console.log(`        ${t} — ${gesehen.get(t)} und ${p.slug}`); return false; }
      gesehen.set(t, p.slug);
    }
    return true;
  }],

  /* ------------------------------------------------------------ Robots */

  ['robots.txt nennt die Sitemap', () => fs.readFileSync(path.join(wurzel, 'public/robots.txt'), 'utf8')
    .includes('Sitemap: https://orbylox.de/sitemap.xml')],
  ['der angemeldete Bereich bleibt draussen', () => {
    const r = fs.readFileSync(path.join(wurzel, 'public/robots.txt'), 'utf8');
    return ['/ProjectsList', '/Dashboard', '/ScrumBoard', '/api/'].every((p) => r.includes('Disallow: ' + p));
  }],
];

let schlecht = 0;
for (const [name, fn] of pruefungen) {
  let ok = false;
  try { ok = !!fn(); } catch (e) { ok = false; console.log(`  ${e.message}`); }
  if (!ok) schlecht += 1;
  console.log(`  ${ok ? 'OK  ' : 'FEHL'}  ${name}`);
}

console.log('');
if (schlecht) {
  console.log(`${schlecht} von ${pruefungen.length} Zusicherungen fehlgeschlagen.`);
  process.exit(1);
}
console.log(`${pruefungen.length} Zusicherungen, alle grün.`);
