/**
 * Firestore und der Dateispeicher — getrennt von `firebase.js`.
 *
 * WARUM EINE EIGENE DATEI
 * `firebase.js` wird beim Start gebraucht: Die Anmeldung muss wissen, ob
 * jemand angemeldet ist, bevor irgendetwas anderes passiert. Firestore und
 * der Dateispeicher werden dagegen erst gebraucht, wenn jemand DRIN ist —
 * auf der Startseite nie.
 *
 * Standen sie in derselben Datei, lagen ihre rund 150 kB im ersten Bündel
 * jeder Seite. Wer nur die Startseite ansah, lud die ganze Datenbank-
 * bibliothek mit und benutzte davon nichts. Getrennt landen sie in einem
 * eigenen Brocken, den nur die angemeldeten Seiten anfordern.
 *
 * Wer hier importiert, zieht Firestore in seinen Brocken. Das ist richtig so
 * für alles unter `src/api/` und die Echtzeit-Haken; NICHT richtig für
 * Startseite, Impressum oder Blog.
 */

import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { app } from "@/lib/firebase";

/**
 * Firestore mit dauerhaftem Cache im Geraetespeicher (IndexedDB).
 *
 * Vorher lief alles ueber den fluechtigen Speicher: jeder Seitenaufruf holte
 * jedes Dokument komplett neu vom Server. Jetzt liegt der Bestand lokal,
 * Firestore zieht nur noch Aenderungen nach — der zweite Aufruf ist sofort da,
 * und ohne Netz laesst sich weiter lesen und schreiben (wird spaeter
 * synchronisiert).
 *
 * Mehrere offene Tabs teilen sich den Cache ueber den Tab-Manager. Faellt
 * IndexedDB aus (privater Modus in manchen Browsern), springt der fluechtige
 * Speicher ein — die App laeuft dann wie bisher.
 */
function createDb(firebaseApp) {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (err) {
    console.warn("[Firestore] Dauerhafter Cache nicht verfuegbar, nutze Speicher:", err?.message || err);
    return initializeFirestore(firebaseApp, { localCache: memoryLocalCache() });
  }
}

export const db = app ? createDb(app) : null;
export const storage = app ? getStorage(app) : null;
