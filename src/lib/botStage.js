/**
 * Melder für die Auftritte der ORBYLOX-Figur.
 *
 * Warum kein React-Kontext: Die Anlässe liegen weit auseinander im Baum. Ein
 * Ticket wird an drei Stellen fertig (Ziehen auf die Spalte, Knopfreihe auf
 * der Karte, Statusauswahl im Dialog), abgemeldet wird an drei anderen. Ein
 * Kontext müsste durch mehrere Ebenen gereicht werden, nur damit eine Figur
 * auftritt. Ein Ereignis am `window` erreicht sie alle, ohne dass eine
 * einzige Komponentensignatur wächst.
 *
 * Für den Abschied ist die Reihenfolge wichtig: Die Figur läuft weg, DANN
 * wird abgemeldet. Deshalb reist eine Rückmeldung mit — und die Bühne
 * garantiert, dass sie genau einmal läuft, auch bei Abbruch mit Esc, bei
 * fehlendem WebGL oder wenn gar nichts lädt. Niemand darf im Ausloggen
 * hängen bleiben, weil eine Verzierung klemmt.
 */

const EVENT = 'orbylox:bot';

function dispatch(detail) {
  if (typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent(EVENT, { detail }));
  return true;
}

/** Jubel: ein Ticket ist fertig. */
export function celebrate() {
  dispatch({ act: 'celebrate' });
}

/**
 * Abschied: die Figur läuft weg und schaut zurück, danach `then`.
 *
 * Läuft `then` niemals los, hängt der Nutzer angemeldet fest. Deshalb wird
 * hier notfalls sofort ausgeführt statt auf die Bühne zu hoffen.
 */
export function farewell(then) {
  const run = typeof then === 'function' ? then : () => {};
  if (typeof window === 'undefined') { run(); return; }

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) { run(); return; }

  let handled = false;
  const guard = () => { if (!handled) { handled = true; run(); } };

  // Nimmt die Bühne den Auftritt nicht an (nicht eingehängt, Fehler beim
  // Rendern), passiert nach kurzer Frist trotzdem das Eigentliche.
  const fallback = window.setTimeout(guard, 1200);
  dispatch({
    act: 'farewell',
    then: () => { window.clearTimeout(fallback); guard(); },
    ack: () => window.clearTimeout(fallback),
  });
}

/** Zuhören. Gibt die Abmeldefunktion zurück. */
export function onBotAct(handler) {
  if (typeof window === 'undefined') return () => {};
  const fn = (e) => handler(e.detail || {});
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
