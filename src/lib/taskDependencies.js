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

/** Nachschlagewerk id -> Ticket, damit die Prüfungen nicht ständig suchen. */
export function indexTasks(tasks = []) {
  const map = new Map();
  for (const t of tasks) {
    if (t?.id) map.set(t.id, t);
  }
  return map;
}

function dependencyIds(task) {
  return Array.isArray(task?.depends_on) ? task.depends_on.filter(Boolean) : [];
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

export function isBlocked(task, byId) {
  return openBlockersOf(task, byId).length > 0;
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
export function canMoveTo(task, targetStatus, byId) {
  if (targetStatus !== DONE_STATUS) return { ok: true, blockers: [] };
  const open = openBlockersOf(task, byId);
  if (open.length === 0) return { ok: true, blockers: [] };
  return { ok: false, reason: 'blockedByOpenTasks', blockers: open };
}

/**
 * Kandidaten, die man als Vorgänger auswählen darf: alles aus demselben
 * Projekt, ausser dem Ticket selbst, bereits gewählten und allem, was einen
 * Kreis erzeugen würde.
 */
export function selectableBlockers(task, tasks, byId) {
  const already = new Set(dependencyIds(task));
  return tasks.filter(
    (candidate) =>
      candidate.id !== task.id &&
      !already.has(candidate.id) &&
      !wouldCreateCycle(task.id, candidate.id, byId),
  );
}
