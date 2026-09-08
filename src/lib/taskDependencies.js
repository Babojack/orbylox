/**
 * Abhängigkeiten zwischen Tickets.
 *
 * Ein Ticket kann auf anderen Tickets warten: "Ticket 1 hängt an 3 und 4".
 * Solange einer dieser Vorgänger nicht erledigt ist, gilt Ticket 1 als
 * blockiert und darf nicht nach "Done" wandern.
 *
 * Gespeichert wird das als Feld `depends_on` am Ticket — eine Liste von
 * Ticket-IDs. Bewusst am abhängigen Ticket und nicht am Vorgänger: so steht
 * beim Öffnen eines Tickets sofort da, worauf es wartet, ohne alle anderen
 * durchsuchen zu müssen.
 */

export const DONE_STATUS = 'done';

/**
 * Story Points: Aufwand, nicht Zeit.
 *
 * Die Fibonacci-Folge ist Absicht. Bei kleinen Aufgaben kann man den Aufwand
 * gut unterscheiden, bei grossen nicht mehr — der Unterschied zwischen 1 und 2
 * ist spuerbar, der zwischen 20 und 21 erfunden. Wachsende Abstaende
 * erzwingen die Ehrlichkeit, ab einer gewissen Groesse nur noch grob zu
 * schaetzen. Wer 13 vergibt, sagt damit auch: Das gehoert eigentlich geteilt.
 */
export const STORY_POINTS = [1, 2, 3, 5, 8, 13, 21];

export function storyPointsOf(task) {
  const v = Number(task?.story_points);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** Summe der Punkte einer Ticketmenge — fuer die Spaltenkoepfe. */
export function sumStoryPoints(tasks = []) {
  return tasks.reduce((n, t) => n + storyPointsOf(t), 0);
}

/** Nachschlagewerk id -> Ticket, damit die Prüfungen nicht ständig suchen. */
export function indexTasks(tasks = []) {
  const map = new Map();
  for (const t of tasks) {
    if (t?.id) map.set(t.id, t);
  }
  return map;
}

/** Dasselbe für Teilaufgaben. */
export function indexSubtasks(subtasks = []) {
  const map = new Map();
  for (const s of subtasks) {
    if (s?.id) map.set(s.id, s);
  }
  return map;
}

function dependencyIds(task) {
  return Array.isArray(task?.depends_on) ? task.depends_on.filter(Boolean) : [];
}

/**
 * Ein Ticket kann auch an einer einzelnen Teilaufgabe haengen, nicht nur am
 * ganzen Ticket. Das ist der haeufigere Fall in der Praxis: "Ich brauche nur
 * den Entwurf aus Ticket 4, nicht das fertige Ticket 4."
 */
function subtaskDependencyIds(task) {
  return Array.isArray(task?.depends_on_subtasks)
    ? task.depends_on_subtasks.filter(Boolean)
    : [];
}

/** Teilaufgaben, auf die dieses Ticket wartet — als echte Objekte. */
export function subtaskBlockersOf(task, subtasksById) {
  if (!subtasksById) return [];
  return subtaskDependencyIds(task)
    .map((id) => subtasksById.get(id))
    .filter(Boolean);
}

/** Davon die noch offenen. */
export function openSubtaskBlockersOf(task, subtasksById) {
  return subtaskBlockersOf(task, subtasksById).filter((s) => !s.completed);
}

/**
 * Die Vorgänger eines Tickets als echte Objekte.
 * IDs, zu denen es kein Ticket (mehr) gibt, fallen still weg — ein gelöschter
 * Vorgänger soll ein Ticket nicht für immer blockieren.
 */
export function blockersOf(task, byId) {
  return dependencyIds(task)
    .map((id) => byId.get(id))
    .filter(Boolean);
}

/** Vorgänger, die noch offen sind. Genau die halten das Ticket auf. */
export function openBlockersOf(task, byId) {
  return blockersOf(task, byId).filter((b) => b.status !== DONE_STATUS);
}

export function isBlocked(task, byId, subtasksById) {
  return openBlockersOf(task, byId).length > 0
    || openSubtaskBlockersOf(task, subtasksById).length > 0;
}

/** Tickets, die auf dieses hier warten — für den Hinweis "blockiert 3 andere". */
export function dependentsOf(taskId, tasks = []) {
  return tasks.filter((t) => dependencyIds(t).includes(taskId));
}

/**
 * Würde `blockerId` als Vorgänger von `taskId` einen Kreis schließen?
 *
 * Ohne diese Prüfung liesse sich A wartet auf B wartet auf A bauen — beide
 * Tickets wären dann für immer blockiert, ohne dass man den Grund sieht.
 * Deshalb läuft eine Tiefensuche von `blockerId` aus über dessen eigene
 * Vorgänger: taucht dabei `taskId` auf, entstünde ein Kreis.
 */
export function wouldCreateCycle(taskId, blockerId, byId) {
  if (!taskId || !blockerId) return false;
  if (taskId === blockerId) return true;

  const seen = new Set();
  const stack = [blockerId];

  while (stack.length) {
    const currentId = stack.pop();
    if (currentId === taskId) return true;
    if (seen.has(currentId)) continue;
    seen.add(currentId);

    const current = byId.get(currentId);
    for (const nextId of dependencyIds(current)) {
      if (!seen.has(nextId)) stack.push(nextId);
    }
  }
  return false;
}

/**
 * Darf das Ticket in diese Spalte?
 * Rückgabe: { ok, reason, blockers } — `reason` ist ein Schlüssel, den die
 * Oberfläche übersetzt, damit hier keine Texte festkleben.
 */
export function canMoveTo(task, targetStatus, byId, subtasksById) {
  if (targetStatus !== DONE_STATUS) return { ok: true, blockers: [] };
  const open = openBlockersOf(task, byId);
  const openSubs = openSubtaskBlockersOf(task, subtasksById);
  if (open.length === 0 && openSubs.length === 0) return { ok: true, blockers: [] };
  return {
    ok: false,
    reason: 'blockedByOpenTasks',
    // Beide Arten in EINER Liste: Die Oberflaeche zeigt ohnehin nur Titel,
    // und fuer die Meldung ist es gleich, ob ein Ticket oder eine Teilaufgabe
    // im Weg steht.
    blockers: [...open, ...openSubs],
  };
}

/**
 * Kandidaten, die man als Vorgänger auswählen darf: alles aus demselben
 * Projekt, ausser dem Ticket selbst, bereits gewählten und allem, was einen
 * Kreis erzeugen würde.
 */
/**
 * Ordnet die Tickets in Ebenen: Was kann sofort los, was kommt danach.
 *
 * Ebene 0 sind die Tickets, die auf nichts warten. Ebene n sind die, deren
 * sämtliche Vorgänger in früheren Ebenen liegen. Das ist eine topologische
 * Sortierung nach Tiefe — und genau die Ansicht, die man beim Planen braucht:
 * eine Ebene lässt sich parallel bearbeiten, die nächste erst danach.
 *
 * Tickets in einem Kreis (A wartet auf B wartet auf A) bekommen keine Ebene.
 * Sie werden getrennt zurückgegeben, statt sie stillschweigend irgendwo
 * einzusortieren: Ein Kreis ist ein Planungsfehler, den man sehen muss.
 * Beim Anlegen wird er verhindert, aber Altdaten und gelöschte Zwischenglieder
 * können welche hinterlassen haben.
 *
 * Teilaufgaben-Abhängigkeiten zählen als Kante zum Ticket, zu dem die
 * Teilaufgabe gehört — im Bild wartet ein Ticket ja auf jenes andere Ticket,
 * nur eben nicht auf dessen Fertigstellung.
 */
export function dependencyGraph(tasks = [], subtasksById = null) {
  const byId = indexTasks(tasks);
  const present = new Set(tasks.map((t) => t.id));

  /** id -> Menge der Vorgaenger-Ticket-IDs, die es wirklich gibt */
  const parents = new Map();
  const edges = [];

  for (const t of tasks) {
    const set = new Set();
    for (const id of dependencyIds(t)) {
      if (present.has(id)) { set.add(id); edges.push({ from: id, to: t.id, kind: 'task' }); }
    }
    for (const sid of subtaskDependencyIds(t)) {
      const sub = subtasksById?.get(sid);
      const ownerId = sub?.task_id;
      if (ownerId && present.has(ownerId) && ownerId !== t.id) {
        set.add(ownerId);
        edges.push({ from: ownerId, to: t.id, kind: 'subtask', label: sub.title });
      }
    }
    parents.set(t.id, set);
  }

  const layers = [];
  const placed = new Set();
  let remaining = tasks.slice();

  while (remaining.length) {
    const ready = remaining.filter((t) =>
      [...parents.get(t.id)].every((p) => placed.has(p)));
    // Nichts mehr platzierbar, aber noch Tickets uebrig -> Kreis.
    if (ready.length === 0) break;
    ready.forEach((t) => placed.add(t.id));
    layers.push(ready);
    remaining = remaining.filter((t) => !placed.has(t.id));
  }

  return {
    layers,
    cycles: remaining,
    edges,
    byId,
    /** Laengste Kette: so viele Schritte braucht das Projekt mindestens. */
    depth: layers.length,
  };
}

export function selectableBlockers(task, tasks, byId) {
  const already = new Set(dependencyIds(task));
  return tasks.filter(
    (candidate) =>
      candidate.id !== task.id &&
      !already.has(candidate.id) &&
      !wouldCreateCycle(task.id, candidate.id, byId),
  );
}
