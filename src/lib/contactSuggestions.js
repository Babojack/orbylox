/**
 * Welche drei Kontakte heute vorgeschlagen werden.
 *
 * "Zufällig" wäre das Naheliegende, aber schlecht: derselbe Kontakt kann an
 * drei Tagen hintereinander kommen, während jemand anderes ein Jahr lang nie
 * dran ist. Deshalb eine Mischung:
 *
 *  1. Wer überfällig ist, kommt zuerst — und je länger überfällig, desto eher.
 *  2. Innerhalb gleicher Dringlichkeit entscheidet der Zufall, damit die Liste
 *     nicht jeden Tag identisch aussieht.
 *  3. Der Zufall hängt am Datum, nicht an der Uhrzeit: die Vorschläge bleiben
 *     denselben Tag über stabil. Sonst stünde nach jedem Neuladen etwas
 *     anderes da — und die Mail vom Morgen passte nicht zur Seite am Abend.
 */

/** Vorgegebene Takte. Der Wert ist die Zahl der Tage. */
export const INTERVAL_OPTIONS = [
  { days: 7, de: 'Jede Woche', en: 'Every week' },
  { days: 14, de: 'Alle 2 Wochen', en: 'Every 2 weeks' },
  { days: 30, de: 'Jeden Monat', en: 'Every month' },
  { days: 60, de: 'Alle 2 Monate', en: 'Every 2 months' },
  { days: 90, de: 'Alle 3 Monate', en: 'Every 3 months' },
  { days: 180, de: 'Alle 6 Monate', en: 'Every 6 months' },
  { days: 365, de: 'Einmal im Jahr', en: 'Once a year' },
  { days: 0, de: 'Kein fester Takt', en: 'No fixed rhythm' },
];

export function intervalLabel(days, de = true) {
  const found = INTERVAL_OPTIONS.find((o) => o.days === Number(days));
  if (found) return de ? found.de : found.en;
  return de ? `Alle ${days} Tage` : `Every ${days} days`;
}

const DAY = 24 * 60 * 60 * 1000;

/** Tagesstempel als Zahl — Grundlage für den stabilen Zufall. */
export function daySeed(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  return Number(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`);
}

/**
 * Kleiner, schneller Streuwert aus Zeichenkette und Zahl.
 * (FNV-1a — reicht völlig, es geht nur um eine gleichmäßige Verteilung.)
 */
export function hashOf(str, seed = 0) {
  let h = (2166136261 ^ seed) >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h / 4294967296; // 0 … 1
}

/**
 * Wann ist dieser Kontakt wieder fällig?
 * Ohne Takt und ohne letzten Kontakt: sofort.
 */
export function dueAt(contact) {
  const interval = Number(contact?.intervalDays) || 0;
  const last = contact?.lastContactedAt ? Date.parse(contact.lastContactedAt) : NaN;
  if (!Number.isFinite(last)) return 0;              // noch nie kontaktiert
  if (interval <= 0) return last + 365 * DAY;        // kein Takt: ganz hinten
  return last + interval * DAY;
}

/** Tage über der Fälligkeit; negativ heißt "noch nicht dran". */
export function overdueDays(contact, now = Date.now()) {
  return Math.floor((now - dueAt(contact)) / DAY);
}

/**
 * Punktzahl eines Kontakts. Höher = eher vorschlagen.
 *
 * Überfälligkeit zählt am stärksten, wird aber gedeckelt: jemand, der zwei
 * Jahre nicht dran war, soll nicht auf ewig alle anderen verdrängen. Der
 * Zufallsanteil ist klein genug, um die Reihenfolge nur bei ähnlicher
 * Dringlichkeit zu drehen.
 */
export function scoreOf(contact, now = Date.now(), seed = 0) {
  const over = overdueDays(contact, now);
  const urgency = Math.max(-30, Math.min(120, over));   // Tage, gedeckelt
  const never = contact?.lastContactedAt ? 0 : 40;      // nie kontaktiert: Bonus
  const jitter = hashOf(contact?.id || contact?.name || '', seed) * 25;
  return urgency + never + jitter;
}

/**
 * Die drei (oder n) Vorschläge für einen Tag.
 *
 * `alreadyDoneIds` sind Kontakte, die heute schon abgehakt wurden — die
 * rücken nach hinten, damit nach dem Abhaken jemand Neues nachrückt statt
 * einer Lücke.
 */
export function pickSuggestions(contacts, {
  count = 3,
  now = Date.now(),
  seed = daySeed(new Date(now)),
  alreadyDoneIds = [],
} = {}) {
  const done = new Set(alreadyDoneIds);
  const pool = (contacts || []).filter((c) => c && !c.paused && !done.has(c.id));
  if (!pool.length) return [];

  return pool
    .map((c) => ({ c, s: scoreOf(c, now, seed) }))
    .sort((a, b) => b.s - a.s || String(a.c.id).localeCompare(String(b.c.id)))
    .slice(0, count)
    .map((x) => x.c);
}

/** Wie viele sind gerade überfällig? Für die Anzeige „3 fällig“. */
export function countDue(contacts, now = Date.now()) {
  return (contacts || []).filter((c) => c && !c.paused && overdueDays(c, now) >= 0).length;
}

/**
 * Kontakt nach dem Abhaken fortschreiben.
 * Reine Funktion — leicht zu testen und ohne Nebenwirkung.
 */
export function markContacted(contact, now = new Date()) {
  const at = (now instanceof Date ? now : new Date(now)).toISOString();
  return {
    ...contact,
    contactCount: (Number(contact?.contactCount) || 0) + 1,
    lastContactedAt: at,
  };
}
