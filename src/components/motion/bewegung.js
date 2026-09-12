/**
 * Die Bewegungssprache an einer Stelle.
 *
 * Vorher hatte jede Einblendung ihre eigenen Zahlen: 0.2s hier, 0.26s dort,
 * mal `easeOut`, mal eine eigene Kurve. Das sieht man nicht einzeln, aber im
 * Ganzen — die Anwendung wirkt zusammengesetzt statt aus einem Guss.
 *
 * WARUM DIESE ZAHLEN
 * 180 ms für Kleines (Knöpfe, Sprechblasen), 260 ms für Flächen (Dialoge,
 * Schubladen), 320 ms für Vollbilder. Kürzer wirkt hakelig, länger lässt
 * warten — und Warten ist genau das, was eine Oberfläche nicht soll.
 *
 * Die Kurve `[0.22, 0.61, 0.36, 1]` startet schnell und bremst weich aus:
 * Sie folgt dem Finger, statt erst zu überlegen.
 *
 * WER WENIGER BEWEGUNG EINGESTELLT HAT
 * bekommt dieselben Zustände ohne die Fahrt dazwischen. Nicht "keine
 * Animation" — das Ein- und Ausblenden bleibt, es dauert nur 0,01 Sekunden.
 * So bleibt die Logik überall dieselbe.
 */

export const DAUER = {
  klein: 0.18,
  flaeche: 0.26,
  vollbild: 0.32,
};

export const KURVE = [0.22, 0.61, 0.36, 1];

/** Eine Übergangsangabe für framer-motion. */
export function uebergang(dauer = DAUER.flaeche, reduziert = false) {
  return { duration: reduziert ? 0.01 : dauer, ease: KURVE };
}

/* --------------------------------------------------------- Fertige Muster */

/** Der dunkle Schleier hinter Dialogen und Schubladen. */
export const SCHLEIER = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/** Eine Schublade, die von rechts hereinfährt. */
export const SCHUBLADE_RECHTS = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
};

/** Ein Dialog: kommt aus der Mitte, leicht kleiner, leicht tiefer. */
export const DIALOG = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 8 },
};

/** Ein Vollbild: wächst aus der Fläche, statt sie zu ersetzen. */
export const VOLLBILD = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
};

/** Etwas, das von unten hereinrutscht (Meldungen, Kästen). */
export const VON_UNTEN = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
};
