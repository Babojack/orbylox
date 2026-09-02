/**
 * @-Erwähnungen im Chat.
 *
 * Geschrieben wird `@vorname` — gespeichert wird zusätzlich eine Liste echter
 * E-Mail-Adressen am Nachrichten-Dokument (`mentions`). Ohne diese Liste liesse
 * sich niemand benachrichtigen: im Text steht nur ein Anzeigename, und der ist
 * nicht eindeutig.
 *
 * Warum kein reiner regulärer Ausdruck zum Auflösen:
 * Handles dürfen Punkte und Bindestriche enthalten (max.mueller, anna-lena).
 * Ein Ausdruck wie /@(\w+)/ bricht bei "@max.mueller" nach "max" ab und trifft
 * dann niemanden. Deshalb wird gegen die bekannten Mitglieder abgeglichen,
 * längste Handles zuerst — so gewinnt "@anna.lena" gegen "@anna".
 */

export const ALL_HANDLE = 'alle';

/** Anzeigename aus einer E-Mail: alles vor dem @. */
export function handleFor(email) {
  return String(email || '').split('@')[0].toLowerCase();
}

/**
 * Mitgliederliste in Auswahl-Einträge verwandeln.
 * Der Eintrag "Alle" steht immer vorne — er ist der häufigste Fall.
 */
export function mentionCandidates(memberEmails = [], selfEmail = '', allLabel = 'Alle') {
  const self = String(selfEmail || '').toLowerCase();
  const people = memberEmails
    .map((e) => String(e || '').trim())
    .filter((e) => e && e.toLowerCase() !== self)
    .map((email) => ({ email, handle: handleFor(email), name: handleFor(email) }));

  return [{ email: ALL_HANDLE, handle: ALL_HANDLE, name: allLabel, isAll: true }, ...people];
}

/**
 * Steht die Schreibmarke gerade in einer Erwähnung?
 * Liefert { query, start } oder null.
 *
 * Wichtig: gesucht wird ab der Schreibmarke rückwärts, nicht das letzte @ im
 * ganzen Text. Sonst öffnet sich die Liste wieder, sobald man mitten im Satz
 * etwas korrigiert, obwohl das @ längst abgeschlossen ist.
 */
export function mentionQueryAt(text, caret) {
  const value = String(text || '');
  const pos = Math.max(0, Math.min(caret ?? value.length, value.length));
  const before = value.slice(0, pos);

  const at = before.lastIndexOf('@');
  if (at === -1) return null;

  // Direkt vor dem @ muss ein Zeilenanfang oder Leerraum stehen —
  // sonst wäre jede E-Mail-Adresse im Text ein Auslöser.
  const charBefore = at > 0 ? before[at - 1] : '';
  if (charBefore && !/\s/.test(charBefore)) return null;

  const query = before.slice(at + 1);
  if (/\s/.test(query)) return null;          // Erwähnung ist abgeschlossen
  if (query.length > 40) return null;

  return { query: query.toLowerCase(), start: at };
}

/** Kandidaten nach der Eingabe filtern. */
export function filterCandidates(candidates, query) {
  const q = String(query || '').toLowerCase();
  if (!q) return candidates;
  return candidates.filter(
    (c) => c.handle.includes(q) || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
  );
}

/** Erwähnung an der Schreibmarke einsetzen; gibt Text und neue Position zurück. */
export function applyMention(text, caret, candidate) {
  const found = mentionQueryAt(text, caret);
  const value = String(text || '');
  const start = found ? found.start : value.length;
  const end = found ? start + 1 + found.query.length : value.length;

  const inserted = `@${candidate.handle} `;
  const next = value.slice(0, start) + inserted + value.slice(end);
  return { text: next, caret: start + inserted.length };
}

/**
 * Welche echten Adressen stecken im Text?
 * @Alle löst auf alle Mitglieder ausser dem Absender auf.
 */
export function resolveMentions(text, memberEmails = [], senderEmail = '') {
  const value = String(text || '').toLowerCase();
  const sender = String(senderEmail || '').toLowerCase();
  const others = memberEmails
    .map((e) => String(e || '').trim())
    .filter((e) => e && e.toLowerCase() !== sender);

  if (!value.includes('@')) return [];

  // Längste Handles zuerst, damit "@anna.lena" nicht als "@anna" endet.
  const byLength = [...others].sort((a, b) => handleFor(b).length - handleFor(a).length);

  const hit = new Set();
  // "Alle" erwischt jeden — dann brauchen die Einzelnamen nicht mehr geprüft werden.
  if (new RegExp(`(^|\\s)@${ALL_HANDLE}(\\b|$)`, 'i').test(value)) {
    others.forEach((e) => hit.add(e.toLowerCase()));
    return [...hit];
  }

  for (const email of byLength) {
    const h = handleFor(email);
    if (!h) continue;
    const escaped = h.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
    // Nach dem Handle darf kein weiteres Namenszeichen folgen.
    const re = new RegExp(`(^|\\s)@${escaped}(?![\\w.\\-])`, 'i');
    if (re.test(value)) hit.add(email.toLowerCase());
  }
  return [...hit];
}

/** Text in Stücke zerlegen, damit Erwähnungen hervorgehoben werden können. */
export function splitByMentions(text, knownHandles = []) {
  const value = String(text || '');
  if (!value.includes('@')) return [{ type: 'text', value }];

  const handles = [ALL_HANDLE, ...knownHandles]
    .filter(Boolean)
    .map((h) => String(h).toLowerCase())
    .sort((a, b) => b.length - a.length)
    .map((h) => h.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'));

  if (!handles.length) return [{ type: 'text', value }];

  const re = new RegExp(`(^|\\s)@(${handles.join('|')})(?![\\w.\\-])`, 'gi');
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(value)) !== null) {
    const atIndex = m.index + m[1].length;
    if (atIndex > last) parts.push({ type: 'text', value: value.slice(last, atIndex) });
    parts.push({ type: 'mention', value: `@${m[2]}` });
    last = atIndex + 1 + m[2].length;
  }
  if (last < value.length) parts.push({ type: 'text', value: value.slice(last) });
  return parts.length ? parts : [{ type: 'text', value }];
}
