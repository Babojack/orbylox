import { api } from '@/api/apiClient';

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
export async function signOutAndLeave(queryClient, target = '/') {
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
