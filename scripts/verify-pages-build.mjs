import { URL } from "node:url";
import console from "node:console";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const dist = new URL("../dist/", import.meta.url);
const base = new URL("https://emillysolveranjos.github.io/ProjetosRpg/");
const manifest = JSON.parse(await readFile(new URL("manifest.json", dist), "utf8"));
assert.equal(manifest.name, "Rulebear");
assert.equal(manifest.manifest_version, 1);
assert.equal(manifest.homepage_url, "https://github.com/emillysolveranjos/ProjetosRpg");
async function verifyAsset(value, parent = base) {
  const url = new URL(value, parent);
  assert.equal(url.origin, base.origin, "O recurso precisa usar a origem pública");
  assert.ok(url.pathname.startsWith(base.pathname), "O recurso precisa ficar em /ProjetosRpg/");
  const file = new URL(url.pathname.slice(base.pathname.length), dist);
  assert.ok((await stat(file)).isFile(), "Recurso ausente: " + url.href);
  return file;
}
for (const value of [manifest.icon, manifest.action.icon, manifest.action.popover, manifest.background_url]) {
  assert.ok(value.startsWith(base.href), "O manifesto de produção precisa usar URLs HTTPS absolutas");
  await verifyAsset(value);
}
for (const page of [manifest.action.popover, manifest.background_url]) {
  const html = await readFile(await verifyAsset(page), "utf8");
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) await verifyAsset(match[1], page);
}
let compressedBytes = 0;
for (const name of await readdir(dist, { recursive: true })) {
  assert.ok(!name.endsWith(".map"), "Source map não pode ser publicado: " + name);
  if (/\.(js|css)$/.test(name)) compressedBytes += gzipSync(await readFile(new URL(name.replaceAll("\\", "/"), dist))).length;
}
assert.ok(compressedBytes <= 512000, "JavaScript/CSS excedeu o limite de 500 KB gzip");
console.log("Pages: manifesto e recursos válidos; JS/CSS gzip: " + compressedBytes + " bytes; sem source maps.");
