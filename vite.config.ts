import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import exeApiPlugin from "./vite-plugin-exe-api";

export default defineConfig({
  plugins: [react(), exeApiPlugin()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "esnext",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
