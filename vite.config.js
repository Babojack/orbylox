import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { existsSync, rmSync } from "node:fs";

/**
 * Konfigurationsdateien mit Zugangsdaten gehören in kein Deploy-Paket.
 *
 * Vite kopiert public/ unverändert nach dist/ — damit landete
 * api/invite-config.php mit SMTP-Passwort, Cron-Token und OpenAI-Schlüssel im
 * ausgelieferten Ordner. Zweimal ging das schief: einmal hätte ein Upload die
 * gepflegte Fassung mit einer leeren überschrieben, und als ich sie von Hand
 * aus dem Paket nahm, hat der Upload sie auf dem Server geloescht — SMTP,
 * Assistent, Erinnerungen und Blogverwaltung fielen gleichzeitig aus.
 *
 * Beides waren Gedächtnisfehler, deshalb erledigt es jetzt der Build. Die
 * Datei gehört auf den Server, nicht ins Paket — am besten eine Ebene über
 * public_html, wo kein Deploy sie erreicht.
 */
function keepSecretsOutOfBuild() {
  return {
    name: 'orbylox-keep-secrets-out-of-build',
    closeBundle() {
      const dir = resolve(fileURLToPath(new URL('.', import.meta.url)), 'dist/api');
      for (const name of ['invite-config.php', 'blog-config.php', 'upload-config.php']) {
        const file = resolve(dir, name);
        if (existsSync(file)) {
          rmSync(file);
          console.warn(`[orbylox] ${name} aus dem Paket entfernt — sie gehört nur auf den Server.`);
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const plugins = [
    react(),
    keepSecretsOutOfBuild(),
  ].filter(Boolean);

  return {
    logLevel: "error",
    plugins,
    resolve: {
      alias: {
        "@": resolve(fileURLToPath(new URL(".", import.meta.url)), "src"),
      },
    },
    build: {
      sourcemap: false,
      reportCompressedSize: false,
      target: "esnext",
      minify: "esbuild",
    },
  };
});