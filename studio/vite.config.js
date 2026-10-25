import { defineConfig } from "vite";
import { resolve } from "node:path";

// Tauri expects a fixed dev port and must not have its console cleared.
export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true, fs: { allow: [".."] } }, // ".." so engine/actions.json can be imported
  // two pages: the studio, and Help in a window of its own
  build: { target: "es2022", rollupOptions: { input: { main: resolve(import.meta.dirname, "index.html"), help: resolve(import.meta.dirname, "help.html") } } },
});
