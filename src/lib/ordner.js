/**
 * Ordner — dieselbe Rechnung für Dateien und Notizen.
 *
 * Ordner gab es bisher nur im Dateibereich, und die Logik dazu lag mitten in
 * FileHub.jsx. Damit die Notizen "genau so" funktionieren, steht sie jetzt
 * hier: einmal geschrieben, von beiden Seiten benutzt, ohne Browser prüfbar.
 *
 * ZWEI SORTEN IN EINER SAMMLUNG
 * Firestore hat eine Sammlung `Folder`. Ein Ordner "Marketing" im
 * Dateibereich und ein Ordner "Marketing" in den Notizen sind aber nicht
 * derselbe Ordner — sie enthalten verschiedene Dinge und sollen sich nicht
 * gegenseitig in der Ansicht auftauchen. Deshalb trägt jeder Ordner seine
 * ART.
 *
 * WARUM ALTE ORDNER OHNE ART ZU DATEIEN GEHÖREN
 * Alle Ordner, die es heute gibt, wurden im Dateibereich angelegt — dort war
 * der einzige Ort, an dem man welche anlegen konnte. Ein fehlendes Feld heisst
 * also nicht "unbekannt", sondern "Datei-Ordner". Andersherum (Notiz-Ordner
 * als Standard) würden sie in den Notizen auftauchen und im Dateibereich
 * verschwinden — vorhandene Ordner wären für ihre Besitzer weg.
 */

export const ART = {
  DATEIEN: 'files',
  NOTIZEN: 'docs',
};

/** Die Art eines Ordners. Ohne Angabe: Dateien (siehe Kopf). */
export function artVon(ordner) {
  const roh = ordner?.kind;
  return roh === ART.NOTIZEN ? ART.NOTIZEN : ART.DATEIEN;
}

/** Nur die Ordner einer Art, in der übergebenen Reihenfolge. */
export function ordnerFuer(alle, art) {
  return (Array.isArray(alle) ? alle : []).filter((o) => o && artVon(o) === art);
}

/**
 * Was in diesem Ordner liegt.
 *
 * `null` bedeutet die oberste Ebene — und dorthin gehört alles, was gar keine
 * Zuordnung hat. Ein Eintrag mit einer Kennung, die es nicht mehr gibt, wäre
 * sonst unsichtbar: Er läge in einem gelöschten Ordner und tauchte nirgends
 * mehr auf. Deshalb wird gegen die Liste der vorhandenen Ordner geprüft.
 */
export function inhaltVon(eintraege, ordnerId, vorhandeneOrdner = null) {
  const liste = Array.isArray(eintraege) ? eintraege : [];
  const bekannt = vorhandeneOrdner
    ? new Set(vorhandeneOrdner.map((o) => o?.id).filter(Boolean))
    : null;

  return liste.filter((e) => {
    const zugeordnet = e?.folder_id || null;
    const verwaist = zugeordnet && bekannt && !bekannt.has(zugeordnet);
    const wirklich = verwaist ? null : zugeordnet;
    return ordnerId ? wirklich === ordnerId : !wirklich;
  });
}

/** Wie viele Einträge liegen in diesem Ordner? Für die Kachel. */
export function anzahlIn(eintraege, ordnerId) {
  return (Array.isArray(eintraege) ? eintraege : [])
    .filter((e) => (e?.folder_id || null) === ordnerId).length;
}

/** Der Name eines Ordners, oder eine leere Zeichenkette. */
export function nameVon(ordner, id) {
  return (Array.isArray(ordner) ? ordner : []).find((o) => o?.id === id)?.name || '';
}

export const NAME_MAX = 60;

/**
 * Taugt dieser Name für einen neuen Ordner?
 *
 * Gibt entweder `{ ok: true, name }` mit dem bereinigten Namen zurück oder
 * `{ ok: false, grund }`. Die Gründe sind Schlüssel, keine Sätze — die
 * Formulierung gehört in die Sprachdatei, nicht hierher.
 */
export function namePruefen(roh, vorhandene = [], art = ART.DATEIEN) {
  const name = String(roh ?? '').trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, grund: 'leer' };
  if (name.length > NAME_MAX) return { ok: false, grund: 'zu_lang' };

  const schonDa = ordnerFuer(vorhandene, art)
    .some((o) => (o?.name || '').trim().toLowerCase() === name.toLowerCase());
  if (schonDa) return { ok: false, grund: 'doppelt' };

  return { ok: true, name };
}
