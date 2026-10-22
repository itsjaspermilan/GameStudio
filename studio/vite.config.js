import { defineConfig } from "vite";

// Tauri expects a fixed dev port and must not have its console cleared.
export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true, fs: { allow: [".."] } }, // ".." so engine/actions.json can be imported
  build: { target: "es2022" },
});
