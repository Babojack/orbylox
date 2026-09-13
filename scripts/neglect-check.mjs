/**
 * Liegengebliebene Projekte — die Rechnung nachgestellt.
 *
 * Ein Vorschlag, der die falschen Projekte nennt, fällt niemandem als Fehler
 * auf: Man klickt ihn weg und denkt sich nichts. Deshalb steht hier
 * schwarz auf weiss, was gelten soll — mit festen Daten, ohne Browser.
 *
 * Die Fälle, die weh täten:
 *   1. Ein ausgeblendetes Projekt taucht im Vorschlag auf. Ausblenden heisst
 *      "interessiert mich gerade nicht"; es wieder hervorzuholen wäre das
 *      Gegenteil. (Ausdrücklich so gewünscht.)
 *   2. Das Projekt, an dem man heute sitzt, wird als vernachlässigt gemeldet.
 *   3. Am ersten Tag nach der Umstellung ist ALLES vernachlässigt, weil die
 *      Mitschrift leer ist.
 *   4. Die Reihenfolge springt zwischen zwei Aufrufen.
 *
 * Aufruf: npm run check:neglect
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {
  liegengeblieben, zuletztAngefasst, tageSeit, ruheText,
  heuteWeggeklickt, wegklickVermerk, GRENZE_TAGE, HOECHSTENS,
} = await import(path.join(wurzel, 'src/lib/projectNeglect.js'));

const JETZT = new Date('2026-09-20T10:00:00Z').getTime();
const vorTagen = (n) => new Date(JETZT - n * 24 * 60 * 60 * 1000).toISOString();

const projekte = [
  { id: 'a', name: 'Alpha',  created_date: vorTagen(200) },
  { id: 'b', name: 'Beta',   created_date: vorTagen(200) },
  { id: 'c', name: 'Gamma',  created_date: vorTagen(200) },
  { id: 'd', name: 'Delta',  created_date: vorTagen(200) },
  { id: 'e', name: 'Epsilon', created_date: vorTagen(3) },   // frisch angelegt
  { id: 'f', name: 'Zeta' },                                  // gar keine Angabe
];

const openLog = {
  a: vorTagen(30),   // lange her
  b: vorTagen(9),    // über der Grenze
  c: vorTagen(2),    // frisch
  d: vorTagen(40),   // am längsten her
};
const focusLog = {
  b: vorTagen(1),    // im Fokus gewesen: zählt als angefasst, überstimmt openLog
};

const namen = (liste) => liste.map((e) => e.projekt.id).join(',');

const pruefungen = [
  /* ------------------------------------------------------- Was zählt */

  ['der spätere von Öffnen und Fokus gewinnt', () => {
    const ms = zuletztAngefasst(projekte[1], openLog, focusLog);
    return tageSeit(ms, JETZT) === 1;
  }],
  ['ohne Mitschrift zählt das Anlagedatum', () => {
    const ms = zuletztAngefasst(projekte[4], {}, {});
    return tageSeit(ms, JETZT) === 3;
  }],
  ['ohne jede Angabe wird nichts erfunden', () => zuletztAngefasst(projekte[5], {}, {}) === null],

  /* ------------------------------------------------------ Die Auswahl */

  ['wer am längsten liegt, steht vorn', () => {
    const l = liegengeblieben({ projekte, openLog, focusLog, jetzt: JETZT });
    return namen(l) === 'd,a';
  }],
  ['frisch Angefasstes bleibt draussen', () => {
    const l = liegengeblieben({ projekte, openLog, focusLog, jetzt: JETZT });
    return !l.some((e) => e.projekt.id === 'c');
  }],
  ['und das eben Angelegte auch', () => {
    const l = liegengeblieben({ projekte, openLog, focusLog, jetzt: JETZT });
    return !l.some((e) => e.projekt.id === 'e');
  }],
  ['ein Projekt ohne jede Angabe wird nicht vorgeschlagen', () => {
    const l = liegengeblieben({ projekte, openLog, focusLog, jetzt: JETZT });
    return !l.some((e) => e.projekt.id === 'f');
  }],

  /**
   * Der Fall, an dem der Vorschlag als Ganzes hinge: Ausgeblendetes taucht
   * auf. Ohne Fokus im Log liegt "Beta" 9 Tage — mit `focusLog` nur einen.
   * Hier wird deshalb ohne Fokuslog gerechnet, damit b überhaupt in Frage
   * käme, und dann ausgeblendet.
   */
  ['ausgeblendete Projekte kommen nie vor', () => {
    const l = liegengeblieben({ projekte, openLog, hiddenIds: ['d', 'a'], jetzt: JETZT });
    return namen(l) === 'b';
  }],
  ['das Projekt im heutigen Fokus auch nicht', () => {
    const l = liegengeblieben({ projekte, openLog, focusLog, fokusId: 'd', jetzt: JETZT });
    return namen(l) === 'a';
  }],
  [`höchstens ${HOECHSTENS} Vorschläge`, () => {
    const viele = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`, name: `P${i}`, created_date: vorTagen(50 + i),
    }));
    return liegengeblieben({ projekte: viele, jetzt: JETZT }).length === HOECHSTENS;
  }],
  ['die Reihenfolge ist bei Gleichstand festgelegt', () => {
    const gleich = [
      { id: 'z', name: 'Zebra', created_date: vorTagen(20) },
      { id: 'y', name: 'Ampel', created_date: vorTagen(20) },
    ];
    const a = namen(liegengeblieben({ projekte: gleich, jetzt: JETZT }));
    const b = namen(liegengeblieben({ projekte: [...gleich].reverse(), jetzt: JETZT }));
    return a === b && a === 'y,z';
  }],

  /* -------------------------------------------------------- Die Grenze */

  [`genau ${GRENZE_TAGE} Tage reichen schon`, () => {
    const p = [{ id: 'g', name: 'Grenze', created_date: vorTagen(GRENZE_TAGE) }];
    return liegengeblieben({ projekte: p, jetzt: JETZT }).length === 1;
  }],
  ['einer weniger nicht', () => {
    const p = [{ id: 'g', name: 'Grenze', created_date: vorTagen(GRENZE_TAGE - 1) }];
    return liegengeblieben({ projekte: p, jetzt: JETZT }).length === 0;
  }],

  /* ---------------------------------------------------- Das Wegklicken */

  ['weggeklickt gilt für heute', () => heuteWeggeklickt(wegklickVermerk(new Date(JETZT)), new Date(JETZT))],
  ['und morgen nicht mehr', () => {
    const morgen = new Date(JETZT + 24 * 60 * 60 * 1000);
    return !heuteWeggeklickt(wegklickVermerk(new Date(JETZT)), morgen);
  }],
  ['Unsinn im Vermerk zählt als nicht weggeklickt', () => !heuteWeggeklickt(null) && !heuteWeggeklickt(42)],

  /* ------------------------------------------------------- Der Satz */

  ['sieben Tage sind "eine Woche"', () => ruheText(7) === 'seit einer Woche'],
  ['zwanzig Tage sind zwei Wochen', () => ruheText(20) === 'seit 2 Wochen'],
  ['ab vier Wochen wird grob gezählt', () => ruheText(35).startsWith('seit über')],
  ['ab drei Monaten gar nicht mehr', () => ruheText(120) === 'seit Monaten'],
  ['auf Englisch auch', () => ruheText(7, false) === 'for a week' && ruheText(120, false) === 'for months'],

  /* -------------------------------------------------- Keine Nebenwirkung */

  ['die Eingabelisten bleiben unberührt', () => {
    const kopie = JSON.parse(JSON.stringify(projekte));
    liegengeblieben({ projekte, openLog, focusLog, jetzt: JETZT });
    return JSON.stringify(projekte) === JSON.stringify(kopie);
  }],
  ['ohne Projekte kommt eine leere Liste', () => liegengeblieben({}).length === 0
    && liegengeblieben({ projekte: null }).length === 0],
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
console.log(`${pruefungen.length} Zusicherungen, alle grün (Grenze: ${GRENZE_TAGE} Tage).`);
