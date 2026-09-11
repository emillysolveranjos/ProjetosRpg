import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    cors: {
      origin: ["https://www.owlbear.rodeo", "https://extensions.owlbear.rodeo"],
    },
    headers: {
      "Access-Control-Allow-Private-Network": "true",
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      input: {
        action: resolve(import.meta.dirname, "action.html"),
        background: resolve(import.meta.dirname, "background.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    coverage: { reporter: ["text", "html"] },
  },
});
