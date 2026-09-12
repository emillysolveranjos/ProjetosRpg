import OBR, { buildLabel, isImage, type Item } from "@owlbear-rodeo/sdk";
import { STATE_KEY, PLUGIN_ID } from "../config";
import { parseSceneState } from "../state/schema";
import { markerVisible, markerNumbers, markerText, visibleCombatant } from "../domain/access";
import { readPreferences, tokenPosition } from "../state/preferences";
import type { OwlbearGateway } from "../owlbear/gateway";
import { markerLayout, type Bounds, type OverlayLabel } from "./marker-layout";

const OWNER_KEY = PLUGIN_ID + "/overlay";
interface CachedToken { geometry: string; signature: string; bounds: Bounds; labels: OverlayLabel[] }
function build(tokenId: string, label: OverlayLabel): Item {
  return {
    ...buildLabel().id(`${PLUGIN_ID}/${tokenId}/${label.key}`).name(label.name).plainText(label.text)
      .fontSize(label.fontSize).fontWeight(700).fontFamily("sans-serif").lineHeight(1).textAlign("CENTER").textAlignVertical("MIDDLE")
      .width(label.width).height(label.height).padding(0).position({ x: label.x, y: label.y }).fillColor("#ffffff")
      .backgroundColor(label.color).backgroundOpacity(label.opacity).cornerRadius(label.radius).pointerHeight(0).pointerWidth(0).build(),
    attachedTo: tokenId, locked: true, disableHit: true, layer: "ATTACHMENT", zIndex: label.zIndex,
    disableAttachmentBehavior: ["ROTATION", "SCALE"], metadata: { [OWNER_KEY]: true },
  };
}
export function startOverlays(gateway: OwlbearGateway): () => void {
  let disposed = false, dirty = false, running = false, generation = 0, sceneId = "", refresh = true;
  const cache = new Map<string, CachedToken>();
  // Fingerprints describe our intended items, without SDK-generated timestamps.
  const applied = new Map<string, string>();
  let task: Promise<void> = Promise.resolve();
  async function render() {
    const version = generation;
    const current = () => !disposed && version === generation;
    if (!await OBR.scene.isReady() || !current()) return;
    const raw = (await OBR.scene.getMetadata())[STATE_KEY];
    let state;
    try { state = parseSceneState(raw); } catch { state = undefined; }
    if (!current()) return;
    if ((state?.sceneId ?? "") !== sceneId) { sceneId = state?.sceneId ?? ""; cache.clear(); refresh = true; }
    if (refresh) {
      const own = await OBR.scene.local.getItems((item) => item.metadata[OWNER_KEY] === true);
      if (!current()) return;
      applied.clear(); own.forEach((item) => applied.set(item.id, "")); refresh = false;
    }
    const desired = new Map<string, { fingerprint: string; tokenId: string; label: OverlayLabel }>();
    const seen = new Set<string>();
    if (state) {
      const viewer = await gateway.getSelf(), prefs = readPreferences(gateway.getRoomId(), viewer.id);
      const tokens = (await OBR.scene.items.getItems()).filter(isImage).filter((t) => t.layer === "CHARACTER" && (t.visible || viewer.role === "GM"));
      if (!current()) return;
      for (const token of tokens) {
        const c = state.combatants[token.id];
        if (!c || !visibleCombatant(c, viewer)) continue;
        const top = tokenPosition(prefs, state.sceneId, token.id) === "TOP";
        const geometry = JSON.stringify([token.position, token.rotation, token.scale, token.image, token.grid]);
        const signature = JSON.stringify([top, c.markers.filter((m) => m.onMap && markerVisible(m, c, viewer)).map((m) => [m.id, m.name, m.kind, m.hp, m.color, markerText(m, c, viewer), m.kind === "bar" ? markerNumbers(m, c) : null])]);
        let entry = cache.get(token.id);
        if (!entry || entry.geometry !== geometry || entry.signature !== signature) {
          const bounds = entry?.geometry === geometry ? entry.bounds : await OBR.scene.items.getItemBounds([token.id]);
          if (!current()) return;
          entry = { geometry, signature, bounds, labels: markerLayout(c, viewer, bounds, top) };
          cache.set(token.id, entry);
        }
        seen.add(token.id);
        for (const label of entry.labels) desired.set(`${PLUGIN_ID}/${token.id}/${label.key}`, { fingerprint: JSON.stringify(label), tokenId: token.id, label });
      }
    }
    for (const id of cache.keys()) if (!seen.has(id)) cache.delete(id);
    if (!current() || !await OBR.scene.isReady()) return;
    // Unknown existing objects may be legacy rectangle bars. Replace them once.
    const removals = [...applied].filter(([id, fingerprint]) => !desired.has(id) || !fingerprint).map(([id]) => id);
    for (let i = 0; i < removals.length; i += 100) {
      if (!current()) return;
      const ids = removals.slice(i, i + 100); await OBR.scene.local.deleteItems(ids); ids.forEach((id) => applied.delete(id));
    }
    const additions = [...desired].filter(([id]) => !applied.has(id));
    const updates = [...desired].filter(([id, d]) => applied.has(id) && applied.get(id) !== d.fingerprint);
    for (const [entries, update] of [[additions, false], [updates, true]] as const) {
      for (let i = 0; i < entries.length; i += 100) {
        if (!current()) return;
        const batch = entries.slice(i, i + 100), items = batch.map(([, d]) => build(d.tokenId, d.label));
        if (update) await OBR.scene.local.updateItems(items.map((item) => item.id), (drafts) => {
          const byId = new Map(items.map((item) => [item.id, item]));
          drafts.forEach((draft) => { const item = byId.get(draft.id); if (item) Object.assign(draft, item); });
        });
        else await OBR.scene.local.addItems(items);
        batch.forEach(([id, d]) => applied.set(id, d.fingerprint));
      }
    }
  }
  const schedule = () => {
    if (disposed) return;
    dirty = true; generation++;
    if (running) return;
    running = true;
    task = Promise.resolve().then(async () => {
      while (dirty && !disposed) {
        dirty = false;
        try { await render(); } catch { refresh = true; /* Reconcile partial writes on the next event. */ }
      }
    }).finally(() => { running = false; });
  };
  const sceneChanged = () => { cache.clear(); refresh = true; schedule(); };
  const off = [
    gateway.onSceneStateChange(schedule), gateway.onSceneReadyChange(sceneChanged),
    gateway.onItemsChange(schedule), gateway.onParticipantsChange(schedule),
    gateway.onMessage((data) => { if (data && typeof data === "object" && "type" in data && data.type === "preferences") schedule(); }),
  ];
  window.addEventListener("storage", schedule); schedule();
  return () => {
    disposed = true; generation++; off.forEach((stop) => stop()); window.removeEventListener("storage", schedule);
    void task.then(async () => {
      if (!await OBR.scene.isReady()) return;
      const raw = (await OBR.scene.getMetadata())[STATE_KEY];
      if (parseSceneState(raw).sceneId !== sceneId) return;
      const own = await OBR.scene.local.getItems((item) => item.metadata[OWNER_KEY] === true);
      for (let i = 0; i < own.length; i += 100) await OBR.scene.local.deleteItems(own.slice(i, i + 100).map((item) => item.id));
    }).catch(() => { /* Scene may have closed during teardown. */ });
  };
}
