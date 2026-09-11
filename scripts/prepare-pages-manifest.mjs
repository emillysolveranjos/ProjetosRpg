import { readFile, writeFile } from "node:fs/promises";
import { URL } from "node:url";

const manifestPath = new URL("../dist/manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const baseUrl = "https://emillysolveranjos.github.io/ProjetosRpg";

manifest.icon = `${baseUrl}/icon.svg`;
manifest.action.icon = `${baseUrl}/icon.svg`;
manifest.action.popover = `${baseUrl}/action.html`;
manifest.background_url = `${baseUrl}/background.html`;

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
