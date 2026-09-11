import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";

function allowLocalNetworkAccess(): Plugin {
  return {
    name: "rulebear-local-network-access",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((_request, response, next) => {
        response.setHeader("Access-Control-Allow-Private-Network", "true");
        next();
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [allowLocalNetworkAccess(), react()],
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
