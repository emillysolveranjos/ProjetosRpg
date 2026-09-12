import OBR, { buildLabel, buildShape, isImage, type Item } from "@owlbear-rodeo/sdk";
import { STATE_KEY, PLUGIN_ID } from "../config";
import { parseSceneState } from "../state/schema";
import { markerVisible, markerNumbers, markerText, visibleCombatant } from "../domain/access";
import { readPreferences, tokenPosition } from "../state/preferences";
import type { OwlbearGateway } from "../owlbear/gateway";
const OWNER_KEY = PLUGIN_ID + "/overlay";
export function startOverlays(gateway: OwlbearGateway): () => void {
  let disposed = false, dirty = false, running = false, generation = 0;
  async function clear() {
    if (!await OBR.scene.isReady()) return;
    const own = await OBR.scene.local.getItems((item) => item.metadata[OWNER_KEY] === true);
    for (let i = 0; i < own.length; i += 100) await OBR.scene.local.deleteItems(own.slice(i, i + 100).map((item) => item.id));
  }
  async function render() {
    if (!await OBR.scene.isReady()) return;
    const version = generation;
    const raw = (await OBR.scene.getMetadata())[STATE_KEY];
    let state;
    try { state = parseSceneState(raw); } catch { await clear(); return; }
    const viewer = await gateway.getSelf(), prefs = readPreferences(gateway.getRoomId(), viewer.id);
    const tokens = (await OBR.scene.items.getItems()).filter(isImage).filter((item) => item.layer === "CHARACTER" && (item.visible || viewer.role === "GM"));
    const items: Item[] = [];
    for (const token of tokens) {
      const combatant = state.combatants[token.id];
      if (!combatant || !visibleCombatant(combatant, viewer)) continue;
      const markers = combatant.markers.filter((m) => m.onMap && markerVisible(m, combatant, viewer));
      if (!markers.length) continue;
      const bounds = await OBR.scene.items.getItemBounds([token.id]);
      const width = Math.max(36, bounds.width), height = Math.max(12, Math.min(24, width * 0.13));
      const top = tokenPosition(prefs, state.sceneId, token.id) === "TOP";
      let y = top ? bounds.min.y - 5 - markers.length * (height + 3) : bounds.max.y + 5;
      for (const marker of markers) {
        const n = markerNumbers(marker, combatant);
        const base = `${PLUGIN_ID}/${token.id}/${marker.id}`;
        const attach = <T extends Item>(item: T): T => ({
          ...item, attachedTo: token.id, locked: true, disableHit: true, layer: "ATTACHMENT",
          disableAttachmentBehavior: ["ROTATION", "SCALE"], metadata: { [OWNER_KEY]: true },
        });
        if (marker.kind === "bar") {
          items.push(attach(buildShape().id(base + "/bg").shapeType("RECTANGLE").width(width).height(height).position({ x: bounds.center.x - width / 2, y }).fillColor("#202b30").strokeWidth(0).build()));
          const fillWidth = width * Math.max(0, Math.min(1, n.value / n.maximum));
          if (fillWidth > 0) items.push(attach(buildShape().id(base + "/fill").shapeType("RECTANGLE").width(fillWidth).height(height).position({ x: bounds.center.x - width / 2, y }).fillColor(marker.color).strokeWidth(0).build()));
        }
        items.push(attach(buildLabel().id(base + "/label").plainText(marker.name + " " + markerText(marker, combatant, viewer)).fontSize(height * 0.76).fontWeight(700).fontFamily("sans-serif").textAlign("CENTER").textAlignVertical("MIDDLE").width(width).height(height).padding(0).position({ x: bounds.center.x - width / 2, y }).fillColor("#ffffff").backgroundColor(marker.color).backgroundOpacity(marker.kind === "bar" ? 0 : 0.9).pointerHeight(0).pointerWidth(0).build()));
        y += height + 3;
      }
    }
    if (disposed || version !== generation || !await OBR.scene.isReady()) return;
    await clear();
    for (let i = 0; i < items.length && !disposed && version === generation; i += 100) await OBR.scene.local.addItems(items.slice(i, i + 100));
  }
  const schedule = () => {
    dirty = true; generation++;
    if (running) return;
    running = true;
    void (async () => {
      while (dirty && !disposed) { dirty = false; try { await render(); } catch { /* Scene transitions can invalidate item handles. The next event rebuilds. */ } }
    })().finally(() => { running = false; });
  };
  const off = [
    gateway.onSceneStateChange(schedule), gateway.onSceneReadyChange(schedule),
    gateway.onItemsChange(schedule), gateway.onParticipantsChange(schedule),
    gateway.onMessage((data) => { if (data && typeof data === "object" && "type" in data && data.type === "preferences") schedule(); }),
  ];
  window.addEventListener("storage", schedule);
  schedule();
  return () => { disposed = true; generation++; off.forEach((stop) => stop()); window.removeEventListener("storage", schedule); void clear(); };
}
