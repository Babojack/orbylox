/**
 * Welche Module im Menü stehen — und in welcher Reihenfolge.
 *
 * Bisher war die Navigationsliste eine feste Aufzählung mitten in Layout.jsx:
 * elf Einträge, für alle gleich, in der Reihenfolge, in der sie jemand
 * hingeschrieben hat. Wer nur Aufgaben und Dateien braucht, scrollte an neun
 * Einträgen vorbei, die ihn nichts angehen.
 *
 * Hier steht dasselbe als VERZEICHNIS: eine Liste von Modulen mit stabiler
 * Kennung, dazu die reinen Funktionen, die aus einer gespeicherten Anordnung
 * die sichtbare Liste machen. Kein React, kein Symbol, keine Übersetzung —
 * das liegt daneben in `menuIcons.js` und im Sprachbaustein. Diese Datei
 * lässt sich damit ohne Browser prüfen (`npm run check:menu`).
 *
 * DIE KENNUNG IST DER VERTRAG
 * `id` steht in den Einstellungen jedes Kontos. Sie darf sich nie ändern,
 * auch wenn Pfad oder Name sich ändern — sonst rutscht jemandem beim nächsten
 * Laden ein Modul aus dem Menü, das er dort hingezogen hatte.
 *
 * WAS DAS MIT DEM MARKTPLATZ ZU TUN HAT
 * Ein Modul ist hier nichts weiter als ein Eintrag mit Kennung, Ziel und
 * Aussehen. Kommt später ein Baustein von aussen dazu, ist er genau das
 * — ein weiterer Eintrag. Deshalb kennt `normalizeMenu` unbekannte Kennungen
 * und wirft sie weg, statt daran zu zerbrechen, und deshalb landen NEUE
 * Module von selbst im Menü, ohne dass jemand seine Anordnung anfassen muss.
 */

/**
 * Das Verzeichnis. Reihenfolge hier = Reihenfolge für jemanden, der nie
 * etwas verschoben hat.
 */
export const MODULE = [
  { id: 'dashboard', path: 'Dashboard', labelKey: 'dashboard', color: 'bg-sky-500' },
  { id: 'feed', path: 'SocialBoard', labelKey: 'overview', color: 'bg-[#ef5a24]', badge: 'posts' },
  { id: 'aufgaben', path: 'ScrumBoard', labelKey: 'tasks', color: 'bg-emerald-500' },
  { id: 'notizen', path: 'Docs', labelKey: 'docs', color: 'bg-amber-500' },
  { id: 'canvas', path: 'Canvas', labelKey: 'canvas', color: 'bg-[#ef5a24]' },
  { id: 'dateien', path: 'FileHub', labelKey: 'files', color: 'bg-orange-500' },
  { id: 'kalender', path: 'Calendar', labelKey: 'calendar', color: 'bg-teal-500' },
  { id: 'chat', path: 'Chat', labelKey: 'chat', color: 'bg-blue-500', badge: 'messages' },
  { id: 'meeting', path: 'Meeting', label: 'Meeting', color: 'bg-rose-500' },
  {
    id: 'startup',
    path: 'StartupBuilder',
    label: 'Startup Builder',
    color: 'bg-rose-500',
    disabled: true,
    alpha: true,
  },
  { id: 'tools', path: 'Integrations', label: { de: 'Unsere Tools', en: 'Our Tools' }, color: 'bg-cyan-500' },
];

/** Alle bekannten Kennungen — einmal berechnet, oft gebraucht. */
export const ALLE_IDS = MODULE.map((m) => m.id);

/** Modul zu einer Kennung, oder undefined. */
export function modulVon(id) {
  return MODULE.find((m) => m.id === id);
}

/** Die leere Anordnung: alles sichtbar, Reihenfolge wie im Verzeichnis. */
export const STANDARD_MENUE = { reihenfolge: [], versteckt: [] };

/**
 * Eine gespeicherte Anordnung in einen brauchbaren Zustand bringen.
 *
 * Drei Dinge können schiefgehen, und alle drei passieren im Betrieb:
 *
 *   1. UNBEKANNTE KENNUNGEN. Ein Modul wurde umbenannt oder entfernt, steht
 *      aber noch in den Einstellungen von jemandem. Sie fliegen raus.
 *   2. FEHLENDE KENNUNGEN. Ein Modul ist NEU. Es hängt sich hinten an die
 *      sichtbare Liste — wer nichts tut, sieht es also. Das ist die
 *      wichtigere Richtung: Ein neues Modul, das niemand zu Gesicht bekommt,
 *      weil alle eine gespeicherte Anordnung haben, wäre unsichtbar
 *      ausgeliefert.
 *   3. DOPPELTE KENNUNGEN. Ein misslungener Speichervorgang. Das erste
 *      Vorkommen zählt.
 */
export function normalizeMenu(roh) {
  const bekannt = new Set(ALLE_IDS);

  const reihenfolge = [];
  for (const id of Array.isArray(roh?.reihenfolge) ? roh.reihenfolge : []) {
    if (bekannt.has(id) && !reihenfolge.includes(id)) reihenfolge.push(id);
  }
  // Neue Module hinten anhaengen — in der Reihenfolge des Verzeichnisses.
  for (const id of ALLE_IDS) {
    if (!reihenfolge.includes(id)) reihenfolge.push(id);
  }

  const versteckt = [];
  for (const id of Array.isArray(roh?.versteckt) ? roh.versteckt : []) {
    if (bekannt.has(id) && !versteckt.includes(id)) versteckt.push(id);
  }

  return { reihenfolge, versteckt };
}

/** Die Kennungen, die im Menü stehen — in der gewählten Reihenfolge. */
export function sichtbareIds(menu) {
  const { reihenfolge, versteckt } = normalizeMenu(menu);
  const weg = new Set(versteckt);
  return reihenfolge.filter((id) => !weg.has(id));
}

/**
 * Die Kennungen im Kasten.
 *
 * Auch sie behalten ihre Reihenfolge aus `reihenfolge`: Wer ein Modul
 * herauszieht und es sich anders überlegt, findet es dort, wo es im Menü
 * stand — nicht irgendwo hinten.
 */
export function kastenIds(menu) {
  const { reihenfolge, versteckt } = normalizeMenu(menu);
  const weg = new Set(versteckt);
  return reihenfolge.filter((id) => weg.has(id));
}

/**
 * Ein Modul an eine neue Stelle setzen.
 *
 * `ziel` ist 'menue' oder 'kasten', `index` die Position INNERHALB der
 * Zielliste. Rückgabe ist immer eine neue, normalisierte Anordnung — die
 * alte bleibt unangetastet, damit React den Unterschied sieht.
 */
export function verschieben(menu, id, ziel, index) {
  const { reihenfolge, versteckt } = normalizeMenu(menu);
  if (!ALLE_IDS.includes(id)) return { reihenfolge, versteckt };

  const imKasten = ziel === 'kasten';
  const neuVersteckt = versteckt.filter((x) => x !== id);
  if (imKasten) neuVersteckt.push(id);

  // Die Zielliste ohne das bewegte Modul, dann an der gewuenschten Stelle
  // wieder einsetzen — und daraus die Gesamtreihenfolge neu bauen.
  const weg = new Set(neuVersteckt);
  const zielListe = reihenfolge.filter((x) => x !== id && (imKasten ? weg.has(x) : !weg.has(x)));
  const andereListe = reihenfolge.filter((x) => x !== id && (imKasten ? !weg.has(x) : weg.has(x)));
  const stelle = Math.max(0, Math.min(Number.isFinite(index) ? index : zielListe.length, zielListe.length));
  zielListe.splice(stelle, 0, id);

  /**
   * Beide Listen wieder zu EINER Reihenfolge zusammenlegen.
   *
   * Die Gesamtreihenfolge ist die Quelle; sichtbar und Kasten sind nur zwei
   * Sichten darauf. Zusammengelegt wird so, dass die relative Ordnung beider
   * Listen erhalten bleibt: Wer im Kasten an dritter Stelle liegt, liegt dort
   * auch nach dem naechsten Zug an dritter Stelle.
   */
  const gesamt = [];
  const rest = new Set([...zielListe, ...andereListe]);
  for (const x of reihenfolge) {
    if (!rest.has(x)) continue;
    gesamt.push(x);
    rest.delete(x);
  }
  for (const x of [...zielListe, ...andereListe]) {
    if (rest.has(x)) { gesamt.push(x); rest.delete(x); }
  }

  // Innerhalb der Zielliste die neue Ordnung durchsetzen.
  const endgueltig = [];
  let zeiger = 0;
  for (const x of gesamt) {
    const gehoertZuZiel = imKasten ? weg.has(x) : !weg.has(x);
    if (gehoertZuZiel) {
      endgueltig.push(zielListe[zeiger]);
      zeiger += 1;
    } else {
      endgueltig.push(x);
    }
  }

  return normalizeMenu({ reihenfolge: endgueltig, versteckt: neuVersteckt });
}

/** Für den Vergleich beim Speichern: zwei Anordnungen gleich? */
export function menueGleich(a, b) {
  const x = normalizeMenu(a);
  const y = normalizeMenu(b);
  return x.reihenfolge.join() === y.reihenfolge.join()
    && [...x.versteckt].sort().join() === [...y.versteckt].sort().join();
}
