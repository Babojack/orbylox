import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  const plugins = [
    react(),
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