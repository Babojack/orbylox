import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/**
 * Ein Fenster auf einzelne Ansichten — ohne Anmeldung, ohne Cloud.
 *
 *   npm run probe            (Entwicklungsserver)
 *   npm run probe:build      (statisch bauen, z. B. für Bildschirmfotos)
 *
 * Aufgerufen wird mit `?was=fokus` oder `?was=band`, dazu `&theme=retro`
 * oder `&theme=halloween`.
 *
 * WARUM ES DAS GIBT
 * Der Fokusmodus und das Band über der Projektliste hängen an angemeldeten
 * Daten: eine Aufgabe mit Teilaufgaben und Kommentaren, eine Projektliste mit
 * Besuchsmitschrift. Um sie anzusehen — geschweige denn in drei Themes und
 * auf Handybreite — müsste man sich anmelden, das passende Projekt suchen und
 * die Lage künstlich herstellen. Genau deshalb wurden solche Ansichten früher
 * "im Kopf" geprüft, und genau deshalb fiel erst spät auf, dass auf dem Handy
 * KEINE EINZIGE Teilaufgabe zu sehen war: Die Spalten scrollten dort für
 * sich, und in einer Höhe von null Pixeln ist nichts zu sehen.
 *
 * `@/api/apiClient` wird per Alias durch `probe/apiStub.js` ersetzt. Die
 * Ansichten selbst sind unverändert — was hier steht, steht auch live.
 */
const hier = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: resolve(hier, "probe"),
  logLevel: "error",
  plugins: [react()],
  resolve: {
    /* Reihenfolge zählt: Der genaue Treffer muss VOR dem allgemeinen `@`
       stehen, sonst löst dieses zuerst auf und der Stub bleibt unbenutzt. */
    alias: [
      { find: /^@\/api\/apiClient$/, replacement: resolve(hier, "probe/apiStub.js") },
      { find: "@", replacement: resolve(hier, "src") },
    ],
  },
  build: { outDir: resolve(hier, "probe/dist"), emptyOutDir: true, target: "esnext" },
});
