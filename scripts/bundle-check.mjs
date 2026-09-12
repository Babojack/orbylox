/**
 * Wie schwer ist die erste Seite? — nachgemessen, nicht geschätzt.
 *
 * Anlass: Lighthouse gab der Startseite auf dem Handy eine 61 für Leistung.
 * Die Ursache war kein einzelner Fehler, sondern eine Bauweise: Jede Seite
 * der Anwendung wurde fest importiert, also lag ALLES in einem Bündel —
 * 2,2 MB, über die Leitung 614 kB. Wer die Startseite ansah, lud die
 * Leinwand, den Kalender, den Texteditor, die Blogverwaltung und die ganze
 * Datenbankbibliothek mit und benutzte davon nichts.
 *
 * Diese Prüfung hält den erreichten Stand fest. Sie misst drei Dinge:
 *
 *   1. Das Startbündel bleibt unter der Grenze (gzip, wie es über die
 *      Leitung geht — die rohe Dateigröße sagt darüber wenig).
 *   2. Firestore liegt NICHT darin. Es wird erst gebraucht, wenn jemand
 *      angemeldet ist; auf der Startseite nie.
 *   3. Die Seiten werden nachgeladen. Ein einziger fester Import genügt, um
 *      die ganze Seite samt ihrer Bibliotheken wieder ins Startbündel zu
 *      ziehen — deshalb wird hier gezählt statt gehofft.
 *
 * Aufruf: npm run check:bundle (nach dem Bauen)
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(wurzel, 'dist/assets');

/**
 * Die Grenze.
 *
 * 220 kB gzip ist kein runder Wunschwert, sondern der gemessene Stand
 * (183 kB Startskript + 32 kB Anmeldung = 192) plus etwas Luft für
 * gewöhnliches Wachstum. Wer sie reisst, hat in aller
 * Regel versehentlich etwas Grosses fest importiert — genau der Fehler, der
 * zur 61 geführt hat. Steigt sie bewusst, gehört die neue Zahl mit einer
 * Begründung hierher.
 */
const GRENZE_KB = 220;

if (!fs.existsSync(assets)) {
  console.error('Kein dist/assets — bitte zuerst: npm run build');
  process.exit(2);
}

const dateien = fs.readdirSync(assets).filter((f) => f.endsWith('.js'));

/**
 * Gemessen wird, was der Browser beim ERSTEN Aufruf wirklich holt.
 *
 * Nicht die grösste Datei im Ordner und nicht das, was `index-` heisst: Es
 * gibt inzwischen vierzehn Dateien mit diesem Namensanfang, die meisten sind
 * winzige nachgeladene Brocken. Massgeblich ist, was in `index.html` steht —
 * das Startskript und die Dateien, die daneben vorgeladen werden.
 */
const html = fs.readFileSync(path.join(wurzel, 'dist/index.html'), 'utf8');
const ersteSeite = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g)].map((m) => m[1]);
if (!ersteSeite.length) {
  console.error('In dist/index.html steht kein Startskript.');
  process.exit(2);
}

let gz = 0;
let text = '';
for (const name of ersteSeite) {
  const roh = fs.readFileSync(path.join(assets, name));
  gz += zlib.gzipSync(roh, { level: 9 }).length;
  text += roh.toString('utf8');
}
const kb = Math.round(gz / 1024);
const quelle = fs.readFileSync(path.join(wurzel, 'src/pages.config.js'), 'utf8');

const pruefungen = [
  [`erste Seite unter ${GRENZE_KB} kB (gzip): ${kb} kB aus ${ersteSeite.length} Datei(en)`, () => kb <= GRENZE_KB],

  /**
   * Firestore erkennt man an der Adresse, die es anruft. Der Name der
   * Bibliothek überlebt das Minimieren nicht, diese Zeichenkette schon.
   */
  ['Firestore liegt nicht im Startbündel', () => !text.includes('firestore.googleapis.com')],

  /**
   * Die Anmeldung dagegen gehört dazu: Ohne sie weiss die Anwendung nicht,
   * wen sie vor sich hat, und müsste vor dem ersten Bild noch einmal
   * nachladen. Sie liegt in einem eigenen, vorgeladenen Brocken — deshalb
   * wird über ALLE Dateien der ersten Seite gesucht, nicht nur im Startskript.
   */
  ['die Anmeldung dagegen schon', () => text.includes('identitytoolkit')],

  ['die Seiten werden nachgeladen', () => (quelle.match(/lazy\(\(\) => import\(/g) || []).length >= 20],
  ['auch der Rahmen wird nachgeladen', () => /const __Layout = lazy\(/.test(quelle)],
  ['nur die Startseite ist fest dabei', () => {
    const feste = quelle.match(/^import \w+ from '\.\/pages\//gm) || [];
    return feste.length === 1 && feste[0].includes('Landing');
  }],

  /**
   * Und es entstehen wirklich viele Brocken. Ein einzelnes Bündel hiesse,
   * dass das Nachladen zwar dasteht, aber nichts trennt.
   */
  [`aus einem Bündel sind ${dateien.length} geworden`, () => dateien.length >= 20],
];

let schlecht = 0;
for (const [name, fn] of pruefungen) {
  let ok = false;
  try { ok = !!fn(); } catch { ok = false; }
  if (!ok) schlecht += 1;
  console.log(`  ${ok ? 'OK  ' : 'FEHL'}  ${name}`);
}

console.log('');
if (schlecht) {
  console.log(`${schlecht} von ${pruefungen.length} Zusicherungen fehlgeschlagen.`);
  process.exit(1);
}
console.log(`${pruefungen.length} Zusicherungen, alle grün (erste Seite: ${kb} kB gzip).`);
