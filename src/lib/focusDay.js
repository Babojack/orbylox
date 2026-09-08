/**
 * Der Fokus gilt fuer EINEN Tag.
 *
 * Deshalb steht in der Sperre nicht "seit wann", sondern "welcher Tag" — als
 * ortsbezogenes Datum, nicht als Zeitstempel. Ein Zeitstempel plus 24 Stunden
 * waere falsch: Wer um 23 Uhr in den Fokus geht, will ihn nicht bis morgen
 * 23 Uhr, sondern bis zum Feierabend. Um Mitternacht ist der Tag vorbei, und
 * damit die Sperre.
 *
 * Bewusst die Ortszeit des Geraets und nicht UTC: Der Arbeitstag richtet sich
 * nach der Uhr an der Wand.
 */

export function todayKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function normalizeFocusLock(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id : '';
  const day = typeof raw.day === 'string' ? raw.day : '';
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return { id, day };
}

/** Auf welches Projekt ist heute gesperrt? Sonst null. */
export function activeFocusId(lock, now = new Date()) {
  const l = normalizeFocusLock(lock);
  if (!l) return null;
  return l.day === todayKey(now) ? l.id : null;
}

/** Wie lange gilt die Sperre noch? Fuer den Hinweis in der Ansicht. */
export function msUntilMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}
