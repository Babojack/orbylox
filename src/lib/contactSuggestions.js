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
  return urgency + never + jitter + fristBonus(contact, now);
}

/**
 * Eine gesetzte Frist schlägt jeden Takt.
 *
 * Der Zuschlag ist absichtlich größer als alles andere zusammen (Takt max.
 * 120, nie kontaktiert 40, Zufall 25): Eine Frist ist eine Zusage an sich
 * selbst, mit einem Datum daran. Sie darf nicht hinter jemandem landen, der
 * zufällig länger nicht dran war.
 */
export function fristBonus(contact, now = Date.now()) {
  const { phase } = deadlineState(contact, new Date(now));
  if (phase === 'abgelaufen' || phase === 'heute') return 500;
  if (phase === 'bald') return 250;
  return 0;
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

/* ============================================================== Fristen ==
 *
 * Der Takt sagt "ungefähr alle 30 Tage". Eine Frist sagt "bis zum 14.".
 * Das ist etwas anderes und braucht deshalb ein eigenes Feld:
 *
 *   contact.deadlineAt   'YYYY-MM-DD' — der Tag, bis zu dem kontaktiert sein muss
 *   contact.deadlineNote  optionaler Grund, der in der Mail mitläuft
 *
 * WARUM EIN TAG ALS ZEICHENKETTE UND KEIN ZEITSTEMPEL
 * Eine Frist ist ein Kalendertag, kein Augenblick. Als ISO-Zeitstempel
 * gespeichert wäre der 14. je nach Zeitzone am 13. abends schon vorbei —
 * und der Cron auf dem Server läuft in einer anderen Zone als das Handy.
 * Ein Tag als Text hat dieses Problem nicht.
 */

/** Vorwarnung: so viele Tage vor der Frist geht die erste Mail raus. */
export const VORWARNUNG_TAGE = 3;

/** Kalendertag als 'YYYY-MM-DD' — in der Zone des Geräts, wie der Nutzer ihn sieht. */
export function dayStamp(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Tage von heute bis zum Tag `stamp`; negativ heißt "liegt zurück". */
export function daysUntil(stamp, now = new Date()) {
  if (!stamp) return null;
  const [y, m, d] = String(stamp).split('-').map(Number);
  if (!y || !m || !d) return null;
  const ziel = new Date(y, m - 1, d);
  const heute = now instanceof Date ? new Date(now) : new Date(now);
  // Beide auf Mitternacht: sonst zählt die Uhrzeit mit und "heute" wäre je
  // nach Tageszeit mal 0 und mal -1 Tage.
  ziel.setHours(0, 0, 0, 0);
  heute.setHours(0, 0, 0, 0);
  return Math.round((ziel - heute) / DAY);
}

/**
 * In welchem Zustand ist die Frist dieses Kontakts?
 *
 *   keine     — es ist keine gesetzt
 *   offen     — mehr als die Vorwarnzeit entfernt
 *   bald      — innerhalb der Vorwarnzeit (dann geht die erste Mail raus)
 *   heute     — heute ist der Tag
 *   abgelaufen— der Tag ist vorbei, ohne dass abgehakt wurde
 */
export function deadlineState(contact, now = new Date()) {
  const stamp = contact?.deadlineAt || '';
  const tage = daysUntil(stamp, now);
  if (tage === null) return { gesetzt: false, tage: null, phase: 'keine' };
  if (tage < 0) return { gesetzt: true, tage, phase: 'abgelaufen' };
  if (tage === 0) return { gesetzt: true, tage, phase: 'heute' };
  if (tage <= VORWARNUNG_TAGE) return { gesetzt: true, tage, phase: 'bald' };
  return { gesetzt: true, tage, phase: 'offen' };
}

/**
 * Die nächste Frist nach einem erledigten Kontakt.
 *
 * Sie kommt aus dem Takt: Wer "jeden Monat" eingestellt hat, bekommt nach dem
 * Abhaken den Tag in 30 Tagen. Ohne Takt gibt es keine neue Frist — sonst
 * würde ORBYLOX einen Termin erfinden, den niemand gesetzt hat.
 */
export function nextDeadlineFrom(contact, now = new Date()) {
  const takt = Number(contact?.intervalDays) || 0;
  if (takt <= 0) return null;
  const ab = now instanceof Date ? new Date(now) : new Date(now);
  ab.setHours(0, 0, 0, 0);
  return dayStamp(new Date(ab.getTime() + takt * DAY));
}

/** Wie viele Fristen sind heute oder schon vorbei? Für die Anzeige. */
export function countDeadlinesDue(contacts, now = new Date()) {
  return (contacts || []).filter((c) => {
    if (!c || c.paused) return false;
    const { phase } = deadlineState(c, now);
    return phase === 'heute' || phase === 'abgelaufen';
  }).length;
}

/**
 * Kontakt nach dem Abhaken fortschreiben.
 * Reine Funktion — leicht zu testen und ohne Nebenwirkung.
 *
 * Die Frist wird dabei WEITERGESETZT, nicht gelöscht: Wer einmal eine Frist
 * für jemanden gesetzt hat, will ihn nicht nach dem ersten Anruf aus den
 * Augen verlieren. Ohne Takt fällt sie weg — dann war es ein einmaliger
 * Termin, und ein erfundener Folgetermin wäre eine Anmaßung.
 */
export function markContacted(contact, now = new Date()) {
  const jetzt = now instanceof Date ? now : new Date(now);
  const at = jetzt.toISOString();
  const hatteFrist = !!contact?.deadlineAt;
  const neu = {
    ...contact,
    contactCount: (Number(contact?.contactCount) || 0) + 1,
    lastContactedAt: at,
  };
  if (hatteFrist) {
    const folge = nextDeadlineFrom(contact, jetzt);
    neu.deadlineAt = folge || null;
    if (!folge) neu.deadlineNote = null;
  }
  return neu;
}
