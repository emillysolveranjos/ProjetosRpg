// Gera capturas da prévia do mapa sem abrir o Owlbear: `npm run preview:map` (ou `npm run preview:map -- hp tokens`).
// Sobe um servidor Vite temporário, abre map-preview.html no Chrome/Edge headless e salva PNGs em artifacts/map-preview/.
import console from "node:console";
import process from "node:process";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { createServer } from "vite";

const run = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const out = join(root, "artifacts", "map-preview");

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ];
  const found = candidates.find((path) => path && existsSync(path));
  if (!found) throw new Error("Chrome ou Edge não encontrado. Defina CHROME_PATH com o caminho do navegador.");
  return found;
}

const browser = findBrowser();
const server = await createServer({ root, logLevel: "error", server: { port: 5180, strictPort: false, host: "127.0.0.1" } });
const profile = await mkdtemp(join(tmpdir(), "rulebear-preview-"));
try {
  await server.listen();
  const base = server.resolvedUrls.local[0];
  // Os tamanhos vêm do mesmo cálculo de layout usado pela página.
  const { GROUPS } = await server.ssrLoadModule("/src/preview/scenarios.ts");
  const { placeScenarios } = await server.ssrLoadModule("/src/preview/layout.ts");
  const wanted = process.argv.slice(2);
  const groups = GROUPS.filter((group) => !wanted.length || wanted.includes(group.id));
  if (!groups.length) throw new Error("Grupos disponíveis: " + GROUPS.map((group) => group.id).join(", "));
  await mkdir(out, { recursive: true });
  for (const group of groups) {
    const { width, height } = placeScenarios(group.scenarios);
    const file = join(out, group.id + ".png");
    await run(browser, [
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--no-first-run",
      "--user-data-dir=" + profile, `--window-size=${Math.ceil(width)},${Math.ceil(height)}`,
      "--virtual-time-budget=10000", "--screenshot=" + file, `${base}map-preview.html?group=${group.id}&capture=1`,
    ]);
    console.log(`${group.title}: ${file}`);
  }
} finally {
  await server.close();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
