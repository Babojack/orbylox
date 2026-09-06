/**
 * Kleiner Melder für den Jubel nach getaner Arbeit.
 *
 * Warum kein React-Kontext: Ein Ticket wird an drei Stellen fertig — beim
 * Ziehen auf die Spalte, über die Knopfreihe auf der Karte und über die
 * Statusauswahl im Ticket-Dialog. Alle drei liegen unterschiedlich tief im
 * Baum. Ein Kontext müsste durch mehrere Ebenen gereicht werden, nur damit
 * eine Figur tanzt. Ein Ereignis am `window` erreicht sie alle, ohne dass
 * eine einzige Komponentensignatur wächst.
 *
 * Bewusst nur ein Signal in eine Richtung: Wer `celebrate()` ruft, bekommt
 * keine Antwort und wartet auf nichts. Der Statuswechsel selbst ist längst
 * gespeichert — der Jubel darf ihn nicht aufhalten und nicht scheitern lassen.
 */

const EVENT = 'orbylox:celebrate';

/** Anlass melden. `reason` taucht nur in der Beschriftung auf. */
export function celebrate(reason = 'task-done') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { reason } }));
}

/** Zuhören. Gibt die Abmeldefunktion zurück. */
export function onCelebrate(handler) {
  if (typeof window === 'undefined') return () => {};
  const fn = (e) => handler(e.detail || {});
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
