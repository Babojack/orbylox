import { api } from '@/api/apiClient';
import { farewell } from '@/lib/botStage';

/**
 * Vollständig abmelden und die Seite verlassen.
 *
 * Drei Dinge müssen in dieser Reihenfolge passieren, sonst wirkt das Abmelden
 * wie kaputt:
 *
 *  1. Auf Firebase warten. signOut ist asynchron. Wurde die Seite vorher schon
 *     gewechselt, war die Sitzung beim nächsten Aufbau oft noch gültig — der
 *     Nutzer landete sofort wieder angemeldet in der Anwendung.
 *  2. Den Abfrage-Zwischenspeicher leeren. Sonst zeigt die nächste Anmeldung
 *     für einen Moment die Projekte des vorherigen Kontos.
 *  3. replace statt href: der Zurück-Knopf soll nicht in die abgemeldete
 *     Ansicht zurückführen.
 */
async function leave(queryClient, target) {
  try {
    await api.auth.logout();
  } catch {
    // Auch wenn der Abmeldeaufruf scheitert (kein Netz): lokal ist alles weg,
    // der Nutzer soll nicht festhängen.
  }
  try {
    queryClient?.clear();
  } catch {
    // Zwischenspeicher ist nicht kritisch.
  }
  if (typeof window !== 'undefined') window.location.replace(target);
}

/**
 * Abmelden mit Abschied: die Figur läuft weg und schaut zurück, danach passiert
 * das Eigentliche.
 *
 * Der Ablauf hängt bewusst NICHT an der Animation. `farewell` führt die
 * Rückmeldung in jedem Fall aus — bei Esc, beim Wegtippen, ohne WebGL, bei
 * reduzierter Bewegung und auch dann, wenn die Bühne gar nicht eingehängt ist.
 * Im Zweifel wird abgemeldet und die Verzierung fällt aus, nie umgekehrt.
 *
 * Abgemeldet wird erst NACH der Bewegung, nicht parallel: Wäre die Sitzung
 * schon weg, während die Figur noch läuft, würde die Seite im Hintergrund
 * bereits als "nicht angemeldet" reagieren.
 */
export function signOutAndLeave(queryClient, target = '/') {
  return new Promise((resolve) => {
    farewell(() => {
      leave(queryClient, target).finally(resolve);
    });
  });
}
