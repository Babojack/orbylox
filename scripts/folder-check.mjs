/**
 * Ordner in Dateien UND Notizen — die Rechnung dahinter, nachgestellt.
 *
 * Beide Bereiche teilen sich eine Sammlung. Genau daraus entstehen die Fehler,
 * die man erst spät sieht:
 *
 *   1. Ein Ordner taucht im falschen Bereich auf.
 *   2. Die Ordner, die es HEUTE schon gibt, verschwinden aus dem
 *      Dateibereich, weil sie kein Art-Feld tragen.
 *   3. Ein Eintrag liegt in einem gelöschten Ordner und ist damit nirgends
 *      mehr zu sehen.
 *
 * Alle drei sind hier festgenagelt.
 *
 * Aufruf: npm run check:folders
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {
  ART, artVon, ordnerFuer, inhaltVon, anzahlIn, nameVon, namePruefen, NAME_MAX,
} = await import(path.join(wurzel, 'src/lib/ordner.js'));

const ordner = [
  { id: 'alt', name: 'Marketing' },                              // vor der Umstellung angelegt
  { id: 'd1', name: 'Verträge', kind: ART.DATEIEN },
  { id: 'n1', name: 'Protokolle', kind: ART.NOTIZEN },
  { id: 'n2', name: 'Ideen', kind: ART.NOTIZEN },
];

const notizen = [
  { id: 'a', title: 'Ohne Ordner' },
  { id: 'b', title: 'In Protokolle', folder_id: 'n1' },
  { id: 'c', title: 'In Ideen', folder_id: 'n2' },
  { id: 'd', title: 'Verwaist', folder_id: 'geloescht' },
];

const pruefungen = [
  /* ------------------------------------------------------------- Die Art */

  ['ein Ordner ohne Art gehört zu den Dateien', () => artVon(ordner[0]) === ART.DATEIEN],
  ['und bleibt dort auch sichtbar', () => ordnerFuer(ordner, ART.DATEIEN).map((o) => o.id).join() === 'alt,d1'],
  ['Notiz-Ordner erscheinen nur in den Notizen', () => ordnerFuer(ordner, ART.NOTIZEN).map((o) => o.id).join() === 'n1,n2'],
  ['keine Art bleibt übrig', () => ordnerFuer(ordner, ART.DATEIEN).length + ordnerFuer(ordner, ART.NOTIZEN).length === ordner.length],
  ['Unsinn im Feld zählt als Dateien', () => artVon({ kind: 'irgendwas' }) === ART.DATEIEN && artVon(null) === ART.DATEIEN],

  /* ---------------------------------------------------------- Der Inhalt */

  ['die oberste Ebene zeigt, was keinen Ordner hat', () => {
    const oben = inhaltVon(notizen, null, ordner).map((n) => n.id);
    return oben.includes('a') && !oben.includes('b');
  }],
  ['ein Ordner zeigt nur seinen Inhalt', () => inhaltVon(notizen, 'n1', ordner).map((n) => n.id).join() === 'b'],

  /**
   * Der Fall, den man erst Monate später bemerkt: Der Ordner ist gelöscht,
   * die Notiz zeigt noch auf ihn. Ohne diese Regel wäre sie unauffindbar —
   * sie steht in keinem Ordner, den es gibt, und in der obersten Ebene auch
   * nicht.
   */
  ['eine verwaiste Notiz landet oben, nicht im Nichts', () => {
    const oben = inhaltVon(notizen, null, ordner).map((n) => n.id);
    return oben.includes('d');
  }],
  ['ohne Ordnerliste wird nichts umgehängt', () => {
    // Ohne Kenntnis der vorhandenen Ordner kann niemand entscheiden, ob eine
    // Zuordnung verwaist ist — dann bleibt sie, wie sie ist.
    const oben = inhaltVon(notizen, null).map((n) => n.id);
    return oben.join() === 'a';
  }],
  ['gezählt wird ohne Rücksicht auf Verwaiste', () => anzahlIn(notizen, 'n1') === 1 && anzahlIn(notizen, 'n2') === 1],
  ['der Name kommt aus der Liste', () => nameVon(ordner, 'n1') === 'Protokolle' && nameVon(ordner, 'gibtsnicht') === ''],

  /* ------------------------------------------------------------- Der Name */

  ['Leerzeichen allein ist kein Name', () => namePruefen('   ').grund === 'leer'],
  ['Leerraum wird zusammengefasst', () => namePruefen('  Neue   Ideen  ').name === 'Neue Ideen'],
  ['zu lange Namen werden abgelehnt', () => namePruefen('x'.repeat(NAME_MAX + 1)).grund === 'zu_lang'],
  ['genau die Höchstlänge geht noch', () => namePruefen('x'.repeat(NAME_MAX)).ok === true],
  ['derselbe Name zweimal geht nicht', () => namePruefen('Protokolle', ordner, ART.NOTIZEN).grund === 'doppelt'],
  ['Gross- und Kleinschreibung zählt dabei nicht', () => namePruefen('protokolle', ordner, ART.NOTIZEN).grund === 'doppelt'],

  /**
   * Aber derselbe Name in der ANDEREN Art ist erlaubt: "Marketing" für
   * Dateien und "Marketing" für Notizen sind zwei verschiedene Dinge.
   */
  ['derselbe Name in der anderen Art schon', () => namePruefen('Marketing', ordner, ART.NOTIZEN).ok === true],
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
