/**
 * Ein Standbild des Roboters, das sich alle Antworten teilen.
 *
 * WARUM NICHT EINE 3D-SZENE JE NACHRICHT
 * Ein Browser gibt nur eine Handvoll WebGL-Kontexte gleichzeitig heraus —
 * je nach Gerät acht bis sechzehn. Bekäme jede Antwort ihren eigenen
 * Roboter, wäre nach zehn Nachrichten Schluss: Der Browser wirft die
 * ältesten Kontexte weg, und die oberen Avatare werden schwarz. Auf einem
 * Handy schon deutlich früher.
 *
 * Deshalb läuft der Roboter genau einmal — im runden Knopf. Sobald das
 * Modell steht, wird ein einzelnes Bild aus der Leinwand gezogen und hier
 * abgelegt. Die Antworten zeigen dieses Bild. Es ist derselbe Roboter,
 * derselbe Blickwinkel, dasselbe Licht — nur eben still, was für ein
 * Profilbild ohnehin richtig ist.
 */

let dataUrl = null;
const listeners = new Set();

export function setBotAvatar(url) {
  if (!url || url === dataUrl) return;
  dataUrl = url;
  listeners.forEach((fn) => {
    try { fn(url); } catch { /* ein defekter Zuhörer darf die anderen nicht aufhalten */ }
  });
}

export function getBotAvatar() {
  return dataUrl;
}

/** Zuhören, bis das Bild da ist. Gibt die Abmeldefunktion zurück. */
export function onBotAvatar(fn) {
  listeners.add(fn);
  if (dataUrl) fn(dataUrl);
  return () => listeners.delete(fn);
}
