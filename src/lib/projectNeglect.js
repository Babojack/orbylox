import { todayKey } from '@/lib/focusDay';

/**
 * Welche Projekte lange nichts von dir gehört haben.
 *
 * WAS "ANGEFASST" HEISST
 * Der Zeitpunkt, an dem DU das Projekt zuletzt geöffnet hast. Nicht, wann sich
 * darin zuletzt etwas geändert hat: Das wäre die Arbeit der anderen, und ein
 * Vorschlag, der auf fremde Aktivität reagiert, sagt nichts darüber aus, ob
 * DIR etwas entgangen ist. Ausserdem kostete es je Projekt eine Abfrage.
 *
 * Drei Quellen, die spätere gewinnt:
 *   1. `openLog`  — du hast das Projekt aufgemacht (`open_log` im Konto)
 *   2. `focusLog` — du hast es in den Tagesfokus geholt
 *   3. `created_date` — als Anfangswert, solange keines von beidem vorliegt
 *
 * Der dritte Punkt ist wichtig: Die Mitschrift beginnt erst jetzt. Ohne ihn
 * wäre am ersten Tag JEDES Projekt vernachlässigt und das Band eine Wand aus
 * Vorwürfen. Mit ihm meldet es sich erst, wenn ein Projekt seit dem Anlegen
 * wirklich sieben Tage unberührt liegt.
 *
 * WER NICHT VORKOMMT
 *   - ausgeblendete Projekte. Sie sind ausgeblendet, weil sie gerade nicht
 *     interessieren; sie wieder hervorzuholen wäre das Gegenteil dessen, was
 *     das Ausblenden bedeutet. (Ausdrücklich so gewünscht.)
 *   - das Projekt, auf das der heutige Fokus gesperrt ist. Daran sitzt man
 *     gerade.
 *
 * WARUM DIESE DATEI KEIN REACT KENNT
 * Damit die Rechnung ohne Browser prüfbar ist — `npm run check:neglect`
 * stellt sie mit festen Daten nach. Ein Vorschlag, der die falschen Projekte
 * nennt, fällt sonst erst jemandem auf, der ihn wegklickt.
 */

/** Ab wann ein Projekt als liegengeblieben gilt. */
export const GRENZE_TAGE = 7;

/** Wie viele höchstens vorgeschlagen werden. Mehr ist keine Hilfe, sondern eine Liste. */
export const HOECHSTENS = 3;

const TAG_MS = 24 * 60 * 60 * 1000;

/** Zeitstempel zu Millisekunden, oder null wenn unbrauchbar. */
export function zeitWert(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Wann wurde dieses Projekt zuletzt angefasst?
 *
 * Gibt Millisekunden zurück, oder null, wenn es dazu gar keine Angabe gibt —
 * dann kann niemand sagen, wie lange es liegt, und es wird nicht
 * vorgeschlagen. Lieber gar kein Vorschlag als ein erfundener.
 */
export function zuletztAngefasst(projekt, openLog = {}, focusLog = {}) {
  const kandidaten = [
    zeitWert(openLog?.[projekt?.id]),
    zeitWert(focusLog?.[projekt?.id]),
    zeitWert(projekt?.created_date),
  ].filter((x) => x !== null);
  return kandidaten.length ? Math.max(...kandidaten) : null;
}

/** Volle Tage seit einem Zeitpunkt. Abgerundet — "6,9 Tage" sind sechs Tage. */
export function tageSeit(ms, jetzt = Date.now()) {
  if (ms === null || ms === undefined) return null;
  return Math.floor((jetzt - ms) / TAG_MS);
}

/**
 * Die Vorschläge.
 *
 * Sortiert nach der längsten Ruhe zuerst — wer am längsten wartet, steht
 * vorn. Bei Gleichstand entscheidet der Name, damit die Reihenfolge zwischen
 * zwei Aufrufen dieselbe bleibt und das Band nicht bei jedem Rendern
 * durcheinanderspringt.
 */
export function liegengeblieben({
  projekte = [],
  hiddenIds = [],
  openLog = {},
  focusLog = {},
  fokusId = null,
  jetzt = Date.now(),
  grenzeTage = GRENZE_TAGE,
  hoechstens = HOECHSTENS,
} = {}) {
  const versteckt = new Set(Array.isArray(hiddenIds) ? hiddenIds : []);

  return (Array.isArray(projekte) ? projekte : [])
    .filter((p) => p && p.id && !versteckt.has(p.id) && p.id !== fokusId)
    .map((p) => {
      const ms = zuletztAngefasst(p, openLog, focusLog);
      return { projekt: p, ms, tage: tageSeit(ms, jetzt) };
    })
    .filter((e) => e.tage !== null && e.tage >= grenzeTage)
    .sort((a, b) => (a.ms - b.ms) || String(a.projekt.name || '').localeCompare(String(b.projekt.name || '')))
    .slice(0, hoechstens);
}

/**
 * Wurde das Band heute schon weggeklickt?
 *
 * Gemerkt wird ein Tagesschlüssel, keine Uhrzeit — aus demselben Grund wie
 * beim Fokus: "Heute nicht mehr" endet um Mitternacht und nicht 24 Stunden
 * nach dem Klick. Wer morgens wegklickt, soll am nächsten Morgen wieder
 * gefragt werden, nicht erst mittags.
 */
export function heuteWeggeklickt(vermerk, jetzt = new Date()) {
  return typeof vermerk === 'string' && vermerk === todayKey(jetzt);
}

/** Der Vermerk, der beim Wegklicken gespeichert wird. */
export function wegklickVermerk(jetzt = new Date()) {
  return todayKey(jetzt);
}

/**
 * Der Satz darüber, wie lange es her ist.
 *
 * Keine Datumsangabe: "seit dem 3. September" muss man ausrechnen, "seit
 * zwei Wochen" versteht man beim Lesen. Ab vier Wochen wird nur noch grob
 * gezählt — auf den Tag genau ist dort keine Information mehr, sondern
 * Genauigkeit, die etwas vortäuscht.
 */
export function ruheText(tage, de = true) {
  if (tage === null || tage === undefined) return '';
  if (tage >= 90) return de ? 'seit Monaten' : 'for months';
  if (tage >= 28) {
    const wochen = Math.floor(tage / 7);
    return de ? `seit über ${wochen} Wochen` : `for over ${wochen} weeks`;
  }
  if (tage >= 14) {
    const wochen = Math.floor(tage / 7);
    return de ? `seit ${wochen} Wochen` : `for ${wochen} weeks`;
  }
  if (tage >= 7) return de ? 'seit einer Woche' : 'for a week';
  return de ? `seit ${tage} Tagen` : `for ${tage} days`;
}
