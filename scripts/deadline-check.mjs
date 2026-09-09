/**
 * Fristen bei Kontakten — nachgestellt statt nachgelesen.
 *
 * Geprüft wird der ganze Lauf einer Frist: setzen, Vorwarnung, Fristtag,
 * abgelaufen, abhaken, neue Frist. Dazu zwei Dinge, die man leicht übersieht:
 *
 *   1. Der Vorschlagsstapel muss eine Frist über den Takt stellen.
 *   2. Browser und Cron müssen dieselbe Vorwarnzeit verwenden. Sie stehen an
 *      zwei Orten (JS und PHP), weil sich beide Sprachen keinen Code teilen
 *      können — also wird hier verglichen, dass sie übereinstimmen. Eine
 *      Seite, die "3 Tage vorher" verspricht, während der Versand 5 nimmt,
 *      wäre ein Fehler, den niemand bemerkt, bis es zu spät ist.
 *
 * Aufruf: npm run check:deadlines
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const {
  deadlineState, nextDeadlineFrom, markContacted, countDeadlinesDue,
  dayStamp, daysUntil, pickSuggestions, VORWARNUNG_TAGE,
} = await import(path.join(wurzel, 'src/lib/contactSuggestions.js'));

const { emptyContact } = await import(path.join(wurzel, 'src/lib/contactsImport.js'));
const { fromDoc, toDoc } = await import(path.join(wurzel, 'src/api/contacts.js'));

const DAY = 86400000;
const HEUTE = new Date(2026, 8, 9, 7, 0, 0);          // 9. September 2026, morgens
const inTagen = (n) => dayStamp(new Date(HEUTE.getTime() + n * DAY));

const person = (extra = {}) => ({ ...emptyContact(), id: 'x', name: 'Anna', ...extra });

const pruefungen = [
  /* -------------------------------------------------------- Die Zustände */

  ['ohne Frist ist nichts gesetzt', () => deadlineState(person(), HEUTE).phase === 'keine'],
  ['weit weg heißt offen', () => deadlineState(person({ deadlineAt: inTagen(10) }), HEUTE).phase === 'offen'],
  ['genau die Vorwarnzeit heißt bald', () => deadlineState(person({ deadlineAt: inTagen(VORWARNUNG_TAGE) }), HEUTE).phase === 'bald'],
  ['einen Tag vorher auch', () => deadlineState(person({ deadlineAt: inTagen(1) }), HEUTE).phase === 'bald'],
  ['der Tag selbst heißt heute', () => deadlineState(person({ deadlineAt: inTagen(0) }), HEUTE).phase === 'heute'],
  ['danach abgelaufen', () => deadlineState(person({ deadlineAt: inTagen(-1) }), HEUTE).phase === 'abgelaufen'],

  /**
   * Die Uhrzeit darf nicht mitzählen.
   *
   * Der Grund für den Kalendertag statt des Zeitstempels: Um 23:30 wäre eine
   * Sekunden-Rechnung noch bei "morgen", um 00:30 schon bei "heute" — je
   * nachdem, wann jemand die Seite öffnet.
   */
  ['spät abends ist heute noch heute', () => {
    const spaet = new Date(2026, 8, 9, 23, 45, 0);
    return deadlineState(person({ deadlineAt: '2026-09-09' }), spaet).phase === 'heute';
  }],
  ['früh morgens auch', () => {
    const frueh = new Date(2026, 8, 9, 0, 15, 0);
    return deadlineState(person({ deadlineAt: '2026-09-09' }), frueh).phase === 'heute';
  }],
  ['über den Monatswechsel gerechnet', () => daysUntil('2026-10-01', new Date(2026, 8, 28, 12, 0)) === 3],
  ['Unsinn ergibt keine Frist', () => daysUntil('morgen', HEUTE) === null && daysUntil('', HEUTE) === null],

  /* ------------------------------------------------------ Nach dem Haken */

  ['Abhaken zählt hoch und merkt sich den Tag', () => {
    const n = markContacted(person({ contactCount: 2 }), HEUTE);
    return n.contactCount === 3 && n.lastContactedAt.startsWith('2026-09-09');
  }],
  ['mit Takt kommt die nächste Frist', () => {
    const n = markContacted(person({ deadlineAt: inTagen(0), intervalDays: 30 }), HEUTE);
    return n.deadlineAt === inTagen(30);
  }],
  ['ohne Takt fällt die Frist weg', () => {
    const n = markContacted(person({ deadlineAt: inTagen(0), intervalDays: 0, deadlineNote: 'Angebot' }), HEUTE);
    return n.deadlineAt === null && n.deadlineNote === null;
  }],
  /**
   * Wer nie eine Frist hatte, bekommt beim Abhaken auch keine.
   * Sonst erfände ORBYLOX Termine, die niemand gesetzt hat.
   */
  ['ohne Frist entsteht keine', () => {
    const n = markContacted(person({ intervalDays: 30 }), HEUTE);
    return !n.deadlineAt;
  }],
  ['der Takt liefert den Vorschlag fürs Formular', () => nextDeadlineFrom(person({ intervalDays: 14 }), HEUTE) === inTagen(14)],
  ['ohne Takt gibt es keinen Vorschlag', () => nextDeadlineFrom(person({ intervalDays: 0 }), HEUTE) === null],

  /* ------------------------------------------------------- Die Vorschläge */

  /**
   * Eine Frist schlägt jeden Takt. Der Gegenspieler hier ist bewusst extrem:
   * hundert Tage überfällig, nie kontaktiert — und trotzdem kommt die Frist
   * zuerst.
   */
  ['die Frist steht vor dem ältesten Rückstand', () => {
    const mitFrist = person({ id: 'frist', name: 'Mit Frist', deadlineAt: inTagen(0), intervalDays: 30, lastContactedAt: new Date(HEUTE - 10 * DAY).toISOString() });
    const langHer = person({ id: 'alt', name: 'Lange her', intervalDays: 7, lastContactedAt: new Date(HEUTE - 107 * DAY).toISOString() });
    const nie = person({ id: 'nie', name: 'Noch nie' });
    const reihe = pickSuggestions([langHer, nie, mitFrist], { count: 3, now: HEUTE.getTime() });
    return reihe[0].id === 'frist';
  }],
  ['eine ferne Frist drängelt sich nicht vor', () => {
    const fern = person({ id: 'fern', deadlineAt: inTagen(30), intervalDays: 30, lastContactedAt: new Date(HEUTE).toISOString() });
    const nie = person({ id: 'nie' });
    const reihe = pickSuggestions([fern, nie], { count: 2, now: HEUTE.getTime() });
    return reihe[0].id === 'nie';
  }],
  ['stumm gestellte Kontakte bleiben draußen', () => {
    const stumm = person({ id: 'stumm', deadlineAt: inTagen(0), paused: true });
    return pickSuggestions([stumm], { count: 3, now: HEUTE.getTime() }).length === 0
      && countDeadlinesDue([stumm], HEUTE) === 0;
  }],
  ['gezählt wird, was heute oder vorbei ist', () => countDeadlinesDue([
    person({ id: '1', deadlineAt: inTagen(-2) }),
    person({ id: '2', deadlineAt: inTagen(0) }),
    person({ id: '3', deadlineAt: inTagen(2) }),
    person({ id: '4' }),
  ], HEUTE) === 2],

  /* ------------------------------------------------------------ Speicher */

  /**
   * Die Frist muss den Weg durch Firestore überstehen. Beide Abbildungen
   * sind Weißlisten — ein neues Feld, das dort niemand einträgt, ist beim
   * nächsten Laden still wieder weg.
   */
  ['die Frist übersteht Hin- und Rückweg', () => {
    const doc = toDoc(person({ deadlineAt: '2026-12-24', deadlineNote: 'Weihnachtsgruß' }), 'u1');
    const zurueck = fromDoc('x', doc);
    return zurueck.deadlineAt === '2026-12-24' && zurueck.deadlineNote === 'Weihnachtsgruß';
  }],
  ['ein halbes Datum wird zu keiner Frist', () => {
    const zurueck = fromDoc('x', { deadline_at: '2026-12' });
    return zurueck.deadlineAt === null;
  }],
  ['und wird auch nicht gespeichert', () => toDoc(person({ deadlineAt: '24.12.2026' }), 'u1').deadline_at === null],

  /* ------------------------------------- Browser und Cron müssen sich einig sein */

  ['Cron und Seite warnen gleich früh vor', () => {
    const php = fs.readFileSync(path.join(wurzel, 'public/api/reminder-template.php'), 'utf8');
    const m = /RM_FRIST_VORWARNUNG\s*=\s*(\d+)/.exec(php);
    return !!m && Number(m[1]) === VORWARNUNG_TAGE;
  }],
  /**
   * Auch die TAGESVORSCHLAEGE muessen die Frist gleich gewichten.
   *
   * Sonst zeigte die Morgenmail andere drei Namen als die Seite am selben
   * Tag — und ausgerechnet der Kontakt mit Frist stuende nicht in der Mail.
   * Nachgestellt wurde das mit beiden Fassungen an derselben Liste: PHP und
   * JavaScript liefern dieselbe Reihenfolge (frist, nie, alt, fern).
   */
  ['Cron und Seite gewichten die Frist gleich', () => {
    const php = fs.readFileSync(path.join(wurzel, 'public/api/reminder-template.php'), 'utf8');
    const bonus = /function rmFristBonus[\s\S]*?\n}/.exec(php)?.[0] || '';
    const js = fs.readFileSync(path.join(wurzel, 'src/lib/contactSuggestions.js'), 'utf8');
    const jsBonus = /export function fristBonus[\s\S]*?\n}/.exec(js)?.[0] || '';
    const zahlen = (t) => (t.match(/\b(500|250)\b/g) || []).join(',');
    return zahlen(bonus) === '500,250' && zahlen(jsBonus) === '500,250'
      && php.includes('rmFristBonus($c, $now)');
  }],
  ['der Cron ruft die Fristen-Mail auch auf', () => {
    const cron = fs.readFileSync(path.join(wurzel, 'public/api/reminders.php'), 'utf8');
    return ['pickDeadlineContacts', 'fristSubject', 'fristHtml', 'fristText']
      .every((f) => cron.includes(f + '('));
  }],
  ['und schickt sie höchstens einmal am Tag', () => {
    const cron = fs.readFileSync(path.join(wurzel, 'public/api/reminders.php'), 'utf8');
    // Ein Schlüssel je Empfänger, nicht je Anlass: sonst käme an einem Tag
    // mit abgelaufener UND naher Frist zweimal Post.
    return /sendOnce\('frist\|' \. \$to/.test(cron);
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
