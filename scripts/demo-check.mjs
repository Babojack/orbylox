/**
 * Die Demodaten festhalten.
 *
 *   npm run check:demo
 *
 * WARUM DAS GEPRÜFT WIRD
 * Die Demodaten sind der erste Eindruck: Wer den Knopf auf der Startseite
 * drückt, sieht sie, bevor er irgendetwas anderes von ORBYLOX gesehen hat.
 * Und sie scheitern LEISE. Ein verdrehter Sammlungsname, eine Kennung, die
 * nirgends existiert, ein Ticket in einer Spalte, die es nicht gibt — nichts
 * davon wirft einen Fehler. Es fehlt dann einfach etwas, und niemand merkt,
 * dass es fehlen sollte.
 *
 * Genau deshalb steht das hier und nicht im Kopf.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* Die Datei ist reines JavaScript ohne Alias-Importe — sie lässt sich direkt
   laden, ohne Vite und ohne Auflöser. Das ist kein Zufall, sondern der Grund,
   warum die Daten in einer eigenen Datei liegen. */
const { demoDaten, demoAnzahl, DEMO_PROJEKT_ID, DEMO_EMAIL } =
  await import(pathToFileURL(path.join(wurzel, 'src/lib/demoDaten.js')).href);

const daten = demoDaten();
const lies = (p) => fs.readFileSync(path.join(wurzel, p), 'utf8');

const apiClient = lies('src/api/apiClient.js');
const landing = lies('src/pages/Landing.jsx');
const scrum = lies('src/pages/ScrumBoard.jsx');

/** Die Statusnamen, die das Board wirklich kennt — aus dem Quelltext gelesen. */
const spalten = new Set(
  [...scrum.matchAll(/^\s{2}(\w+):\s*\{\s*key:/gm)].map((m) => m[1]),
);

/** Sammlungsnamen, die `api.entities` wirklich anbietet. */
const bekannteSammlungen = new Set(
  [...apiClient.matchAll(/^\s{4}(\w+):\s*createEntityApi\(/gm)].map((m) => m[1]),
);
bekannteSammlungen.add('Project'); // steht als eigener Block da, nicht als createEntityApi

const sammlungen = Object.entries(daten).filter(
  ([k, v]) => !k.startsWith('__') && Array.isArray(v),
);
const alleIds = new Set(sammlungen.flatMap(([, v]) => v.map((e) => e.id)));
const taskIds = new Set(daten.Task.map((t) => t.id));
const boardIds = new Set(daten.KanbanBoard.map((b) => b.id));

const pruefungen = [
  /* --- Die Namen müssen stimmen, sonst liest sie niemand ------------------ */
  ['jede Sammlung gibt es auch in api.entities', () =>
    sammlungen.every(([name]) => bekannteSammlungen.has(name))],

  /* --- Nichts darf leer sein ---------------------------------------------- */
  ['es gibt genau ein Demo-Projekt', () => daten.Project.length === 1],
  ['das Projekt trägt die feste Kennung', () => daten.Project[0].id === DEMO_PROJEKT_ID],
  ['der Demo-Zugang ist Mitglied im Projekt', () =>
    daten.Project[0].members.includes(DEMO_EMAIL)],
  ['es gibt ein zusätzliches Board neben dem Hauptboard', () => daten.KanbanBoard.length >= 1],
  ['die Boards heissen `title`, nicht `name`', () =>
    daten.KanbanBoard.every((b) => typeof b.title === 'string' && b.title.trim() !== '')],
  ['es gibt mindestens acht Tickets', () => daten.Task.length >= 8],
  ['Notizen, Termine und Beiträge sind da', () =>
    daten.Document.length > 0 && daten.Event.length > 0 && daten.Post.length > 0],

  /**
   * ALLE VIER SPALTEN SIND BESETZT.
   *
   * Ein Board, auf dem alles in "Zu erledigen" liegt, zeigt nicht, dass man
   * Karten schieben kann — es sieht aus wie eine Einkaufsliste. Der Sinn der
   * Demodaten ist, dass man ein arbeitendes Projekt sieht.
   */
  ['jede Spalte des Boards hat mindestens ein Ticket', () => {
    const belegt = new Set(daten.Task.map((t) => t.status));
    return [...spalten].every((s) => belegt.has(s));
  }],
  ['kein Ticket steht in einer Spalte, die es nicht gibt', () =>
    daten.Task.every((t) => spalten.has(t.status))],

  /* --- Verweise dürfen nicht ins Leere zeigen ------------------------------ */
  /**
   * DAS HAUPTBOARD MUSS BESETZT SEIN.
   *
   * Es ist die Ansicht, auf der man nach dem Klick landet, und es ist kein
   * Eintrag in `KanbanBoard`: Dort liegt, was KEINE `kanban_board_id` hat.
   * Beim ersten Anlauf trugen alle Tickets eine Kennung — das Board war
   * fertig gefüllt, aber die erste Seite zeigte vier leere Spalten.
   */
  ['auf dem Hauptboard liegen Tickets', () =>
    daten.Task.filter((t) => t.kanban_board_id == null || t.kanban_board_id === '').length >= 6],
  ['jede Board-Kennung an einem Ticket existiert auch', () =>
    daten.Task.every((t) => t.kanban_board_id == null || t.kanban_board_id === ''
      || boardIds.has(t.kanban_board_id))],
  ['jedes zusätzliche Board ist besetzt', () =>
    [...boardIds].every((b) => daten.Task.some((t) => t.kanban_board_id === b))],
  ['alles hängt am Demo-Projekt', () =>
    sammlungen.every(([name, v]) =>
      name === 'Project' || v.every((e) => e.project_id === DEMO_PROJEKT_ID))],
  ['Teilaufgaben und Kommentare hängen an vorhandenen Tickets', () =>
    [...daten.Subtask, ...daten.TaskComment].every((e) => taskIds.has(e.task_id))],
  ['jede Abhängigkeit zeigt auf ein vorhandenes Ticket', () =>
    daten.Task.every((t) => (t.depends_on || []).every((id) => taskIds.has(id)))],
  ['es gibt überhaupt eine Abhängigkeit zu sehen', () =>
    daten.Task.some((t) => (t.depends_on || []).length > 0)],
  ['kein Ticket wartet auf sich selbst', () =>
    daten.Task.every((t) => !(t.depends_on || []).includes(t.id))],
  ['keine Kennung kommt doppelt vor', () =>
    alleIds.size === sammlungen.reduce((n, [, v]) => n + v.length, 0)],

  /**
   * DIE ZEITEN SIND RELATIV.
   *
   * Ein festes Datum im Quelltext altert: Nach einem Jahr steht im Kalender
   * der Demo nichts mehr an, und das Projekt sieht tot aus. Geprüft wird,
   * dass wirklich gerechnet wird — mindestens ein Termin liegt in der
   * Zukunft, und das Projekt wurde "kürzlich" angelegt.
   */
  ['mindestens ein Termin liegt in der Zukunft', () =>
    daten.Event.some((e) => new Date(e.start_date).getTime() > Date.now())],
  ['das Projekt ist keine zwei Monate alt', () =>
    Date.now() - new Date(daten.Project[0].created_date).getTime() < 62 * 864e5],

  /* --- Der Weg von der Startseite bis in die Daten ------------------------- */
  ['die Startseite hat den Demo-Knopf', () =>
    /data-demo-knopf/.test(landing) && /Mit Demodaten ausprobieren/.test(landing)],
  ['der Knopf sät die Daten wirklich ein', () =>
    /demoLogin\(null,\s*\{\s*mitDaten:\s*true\s*\}\)/.test(landing)],
  ['der Knopf holt den apiClient erst beim Klick', () =>
    /await import\('@\/api\/apiClient'\)/.test(landing)],

  /**
   * DER FEHLER, DER DEN DEMO-ZUGANG JAHRELANG LEER LIESS.
   *
   * Der Speicher lag in einem Objekt im Arbeitsspeicher, und `demoLogin`
   * setzt als Nächstes `window.location.href` — die Seite lädt neu, das
   * Objekt ist weg. Gesät wurde also in einen Eimer ohne Boden. Seitdem
   * liegt es in `sessionStorage`; diese Zusicherung hält das fest.
   */
  ['der Demo-Speicher überlebt das Neuladen', () =>
    /sessionStorage\.setItem\(DEMO_PREFIX/.test(apiClient)],
  ['beim Abmelden werden die Demodaten weggeräumt', () =>
    /demoSpeicherLeeren\(\);[\s\S]{0,200}removeItem\(STORAGE_KEY_PREFIX \+ "user"\)/.test(apiClient)],
];

let schlecht = 0;
for (const [name, pruefe] of pruefungen) {
  let ok = false;
  try { ok = !!pruefe(); } catch (err) { ok = false; console.error(`   ${err.message}`); }
  if (!ok) schlecht += 1;
  console.log(`  ${ok ? 'OK  ' : 'FEHL'}  ${name}`);
}

console.log(
  schlecht
    ? `\n${schlecht} von ${pruefungen.length} Zusicherungen fehlgeschlagen.`
    : `\n${pruefungen.length} Zusicherungen, alle grün (${demoAnzahl(daten)} Einträge in den Demodaten).`,
);
process.exit(schlecht ? 1 : 0);
