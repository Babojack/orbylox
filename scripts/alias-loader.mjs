/**
 * `@/…` auch außerhalb von Vite auflösen.
 *
 * Vite kennt den Alias aus der Konfiguration, `node` nicht. Prüfskripte, die
 * echten Anwendungscode laden wollen (statt ihn nachzubauen), scheitern sonst
 * an der ersten Zeile. Fünfzehn Zeilen Auflösung sind billiger als jede
 * Zweitfassung derselben Funktion — eine Zweitfassung prüft am Ende sich
 * selbst.
 */

import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

export function resolve(spezifikator, kontext, weiter) {
  if (!spezifikator.startsWith('@/')) return weiter(spezifikator, kontext);

  const basis = path.join(src, spezifikator.slice(2));
  const kandidaten = [basis, `${basis}.js`, `${basis}.jsx`, path.join(basis, 'index.js')];
  const treffer = kandidaten.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
  if (!treffer) return weiter(spezifikator, kontext);

  return { url: pathToFileURL(treffer).href, shortCircuit: true };
}

/**
 * Firebase wird durch eine Attrappe ersetzt.
 *
 * `src/lib/firebase.js` liest `import.meta.env` — das gibt es nur unter Vite,
 * unter `node` ist es undefiniert, und das Modul stirbt in der dritten Zeile.
 * Statt die Anwendung für die Prüfung zu verbiegen, bekommt die Prüfung eine
 * leere Verbindung. Sie will ohnehin nichts speichern, sondern nur wissen, ob
 * die Abbildung zwischen Objekt und Dokument stimmt.
 */
const ATTRAPPE = `
export const db = null;
export const auth = null;
export const hasFirebaseConfig = false;
export default null;
`;

export function load(url, kontext, weiter) {
  if (url.endsWith('/src/lib/firebase.js')) {
    return { format: 'module', source: ATTRAPPE, shortCircuit: true };
  }
  return weiter(url, kontext);
}
