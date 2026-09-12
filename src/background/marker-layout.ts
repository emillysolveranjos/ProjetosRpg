import type { CombatantState, Viewer } from "../domain/types";
import { markerNumbers, markerText, markerVisible } from "../domain/access";

export interface Bounds { min: { x: number; y: number }; max: { x: number; y: number }; center: { x: number; y: number }; width: number }
export interface OverlayLabel {
  key: string; name: string; text: string; x: number; y: number; width: number; height: number;
  color: string; opacity: number; radius: number; fontSize: number; zIndex: number;
}
/** Geometry only; HP always comes from the combatant's canonical resource. */
export function markerLayout(c: CombatantState, viewer: Viewer, bounds: Bounds, top: boolean): OverlayLabel[] {
  const markers = c.markers.filter((m) => m.onMap && markerVisible(m, c, viewer));
  const bars = markers.filter((m) => m.kind === "bar").sort((a, b) => Number(!!b.hp) - Number(!!a.hp));
  const badges = markers.filter((m) => m.kind !== "bar");
  const width = Math.max(36, bounds.width), height = Math.max(10, Math.min(20, width * .13));
  const left = bounds.center.x - width / 2, edge = top ? bounds.min.y : bounds.max.y;
  const barY = edge - height / 2, gap = 2, diameter = height * 1.5;
  const result: OverlayLabel[] = [];
  bars.forEach((m, i) => {
    const y = barY + (top ? -1 : 1) * i * (height + gap);
    const n = markerNumbers(m, c), text = markerText(m, c, viewer);
    const common = { name: m.name, x: left, y, width, height, radius: height / 2, fontSize: Math.min(height * .87, width / Math.max(1, text.length * .65)), zIndex: 0 };
    result.push({ ...common, key: m.id + "/bg", text: "", color: "#202b30", opacity: 1 });
    const fill = width * Math.max(0, Math.min(1, n.maximum > 0 ? n.value / n.maximum : 0));
    if (fill > 0) result.push({ ...common, key: m.id + "/fill", text: "", width: fill, radius: Math.min(height, fill) / 2, color: m.color, opacity: 1, zIndex: 1 });
    result.push({ ...common, key: m.id + "/label", text, color: m.color, opacity: 0, zIndex: 2 });
  });
  let x = 0, row = 0;
  badges.forEach((m) => {
    const text = markerText(m, c, viewer), fontSize = height * .95;
    const badgeWidth = Math.min(width, Math.max(diameter, text.length * fontSize * .65 + 8));
    if (x && x + badgeWidth > width) { x = 0; row++; }
    const y = top ? barY + height + gap + row * (diameter + gap) : barY - gap - diameter - row * (diameter + gap);
    result.push({ key: m.id + "/label", name: m.name, text, x: left + x, y, width: badgeWidth, height: diameter, color: m.color, opacity: .95, radius: diameter / 2, fontSize: Math.min(fontSize, (badgeWidth - 4) / Math.max(1, text.length * .65)), zIndex: 2 });
    x += badgeWidth + gap;
  });
  return result;
}
