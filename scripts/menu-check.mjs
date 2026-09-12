/**
 * Die Anordnung des Menüs — nachgestellt, nicht nachgelesen.
 *
 * Die Funktionen in `src/lib/menuModules.js` entscheiden, was jemand im Menü
 * sieht. Sie sind rein: rein eine gespeicherte Anordnung, raus eine Liste.
 * Genau deshalb lassen sie sich hier ohne Browser durchspielen — und genau
 * deshalb liegt die Logik dort und nicht in Layout.jsx.
 *
 * Drei Dinge sind wichtiger als das Sortieren selbst:
 *
 *   1. Ein NEUES Modul muss von allein auftauchen. Sonst liefert man es aus,
 *      und niemand sieht es je — alle haben eine gespeicherte Anordnung.
 *   2. Eine UNBEKANNTE Kennung darf nichts zerstören. Sie steht in den
 *      Einstellungen von jemandem, weil ein Modul umbenannt wurde.
 *   3. Herausziehen und Zurückholen muss dorthin führen, wo man es erwartet.
 *
 * Aufruf: npm run check:menu
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {
  MODULE, ALLE_IDS, normalizeMenu, sichtbareIds, kastenIds, verschieben, menueGleich, modulVon,
} = await import(path.join(wurzel, 'src/lib/menuModules.js'));

const alles = { reihenfolge: [...ALLE_IDS], versteckt: [] };

const pruefungen = [
  /* ------------------------------------------------------- Das Verzeichnis */

  ['jedes Modul hat eine Kennung', () => MODULE.every((m) => typeof m.id === 'string' && m.id)],
  ['jede Kennung kommt nur einmal vor', () => new Set(ALLE_IDS).size === ALLE_IDS.length],
  ['jedes Modul hat ein Ziel', () => MODULE.every((m) => typeof m.path === 'string' && m.path)],
  ['jedes Modul hat eine Beschriftung', () => MODULE.every((m) => m.labelKey || m.label)],
  ['modulVon findet und verfehlt richtig', () => !!modulVon('aufgaben') && !modulVon('gibtsnicht')],

  /* -------------------------------------------------------- Normalisieren */

  ['ohne Einstellungen ist alles sichtbar', () => sichtbareIds(null).length === ALLE_IDS.length],
  ['und in der Reihenfolge des Verzeichnisses', () => sichtbareIds(undefined).join() === ALLE_IDS.join()],

  /**
   * Der wichtigste Fall: ein neues Modul, während alle schon eine
   * gespeicherte Anordnung haben.
   */
  ['ein neues Modul taucht von allein auf', () => {
    const alt = { reihenfolge: ALLE_IDS.slice(0, 3), versteckt: [] };
    const neu = normalizeMenu(alt);
    return neu.reihenfolge.length === ALLE_IDS.length
      && neu.reihenfolge.slice(0, 3).join() === ALLE_IDS.slice(0, 3).join()
      && sichtbareIds(alt).includes(ALLE_IDS[ALLE_IDS.length - 1]);
  }],
  ['unbekannte Kennungen fliegen raus', () => {
    const m = normalizeMenu({ reihenfolge: ['gibtsnicht', 'chat', 'auch-nicht'], versteckt: ['weg-damit'] });
    return !m.reihenfolge.includes('gibtsnicht') && m.reihenfolge[0] === 'chat' && m.versteckt.length === 0;
  }],
  ['doppelte Kennungen zählen einmal', () => {
    const m = normalizeMenu({ reihenfolge: ['chat', 'chat', 'canvas'], versteckt: ['chat', 'chat'] });
    return m.reihenfolge.filter((x) => x === 'chat').length === 1 && m.versteckt.length === 1;
  }],
  ['Verstecktes steht nicht im Menü', () => {
    const m = { reihenfolge: [...ALLE_IDS], versteckt: ['chat', 'canvas'] };
    return !sichtbareIds(m).includes('chat') && kastenIds(m).join() === ['canvas', 'chat'].filter((x) => ALLE_IDS.includes(x)).sort((a, b) => ALLE_IDS.indexOf(a) - ALLE_IDS.indexOf(b)).join();
  }],
  ['zusammen ergeben beide wieder alles', () => {
    const m = { reihenfolge: [...ALLE_IDS], versteckt: ['chat', 'meeting'] };
    return sichtbareIds(m).length + kastenIds(m).length === ALLE_IDS.length;
  }],

  /* ------------------------------------------------------------ Verschieben */

  ['nach oben sortieren', () => {
    const m = verschieben(alles, 'chat', 'menue', 0);
    return sichtbareIds(m)[0] === 'chat';
  }],
  ['nach unten sortieren', () => {
    const m = verschieben(alles, 'dashboard', 'menue', ALLE_IDS.length - 1);
    const s = sichtbareIds(m);
    return s[s.length - 1] === 'dashboard';
  }],
  ['die anderen behalten ihre Ordnung', () => {
    const m = verschieben(alles, 'chat', 'menue', 0);
    const ohneChat = sichtbareIds(m).filter((x) => x !== 'chat');
    return ohneChat.join() === ALLE_IDS.filter((x) => x !== 'chat').join();
  }],
  ['in den Kasten ziehen', () => {
    const m = verschieben(alles, 'canvas', 'kasten', 0);
    return !sichtbareIds(m).includes('canvas') && kastenIds(m).includes('canvas')
      && sichtbareIds(m).length === ALLE_IDS.length - 1;
  }],
  ['und wieder zurückholen', () => {
    const raus = verschieben(alles, 'canvas', 'kasten', 0);
    const rein = verschieben(raus, 'canvas', 'menue', 2);
    return sichtbareIds(rein)[2] === 'canvas' && kastenIds(rein).length === 0;
  }],
  ['zweimal in den Kasten bleibt einmal', () => {
    const a = verschieben(alles, 'canvas', 'kasten', 0);
    const b = verschieben(a, 'canvas', 'kasten', 0);
    return kastenIds(b).filter((x) => x === 'canvas').length === 1;
  }],
  ['eine unbekannte Kennung ändert nichts', () => {
    const m = verschieben(alles, 'gibtsnicht', 'menue', 0);
    return menueGleich(m, alles);
  }],
  ['ein Index daneben landet am Rand', () => {
    const zuGross = verschieben(alles, 'chat', 'menue', 999);
    const zuKlein = verschieben(alles, 'chat', 'menue', -5);
    const s1 = sichtbareIds(zuGross);
    return s1[s1.length - 1] === 'chat' && sichtbareIds(zuKlein)[0] === 'chat';
  }],
  ['alles in den Kasten ist erlaubt', () => {
    // Wer alles herauszieht, hat ein leeres Menü — und muss trotzdem wieder
    // herauskommen. Der Knopf "Menü anpassen" steht deshalb ausserhalb der
    // Liste; hier wird nur geprüft, dass die Daten das aushalten.
    let m = alles;
    for (const id of ALLE_IDS) m = verschieben(m, id, 'kasten', 0);
    return sichtbareIds(m).length === 0 && kastenIds(m).length === ALLE_IDS.length;
  }],

  /* ------------------------------------------------------------- Vergleich */

  ['gleich bleibt gleich', () => menueGleich(alles, { reihenfolge: [...ALLE_IDS], versteckt: [] })],
  ['eine andere Reihenfolge ist ungleich', () => !menueGleich(alles, verschieben(alles, 'chat', 'menue', 0))],
  ['ein verstecktes Modul ist ungleich', () => !menueGleich(alles, verschieben(alles, 'chat', 'kasten', 0))],
  ['die Reihenfolge im Kasten zählt nicht', () => menueGleich(
    { reihenfolge: [...ALLE_IDS], versteckt: ['chat', 'canvas'] },
    { reihenfolge: [...ALLE_IDS], versteckt: ['canvas', 'chat'] },
  )],

  /* ---------------------------------------------- Nichts wird kaputtgemacht */

  ['keine Funktion verändert ihre Eingabe', () => {
    const original = { reihenfolge: [...ALLE_IDS], versteckt: ['chat'] };
    const kopie = JSON.parse(JSON.stringify(original));
    verschieben(original, 'canvas', 'kasten', 0);
    sichtbareIds(original);
    kastenIds(original);
    normalizeMenu(original);
    return JSON.stringify(original) === JSON.stringify(kopie);
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
console.log(`${pruefungen.length} Zusicherungen, alle grün (${MODULE.length} Module im Verzeichnis).`);
