import type { CombatantState, MarkerDisplayLayout, Viewer } from "../domain/types";
import { markerMapText, markerNumbers, markerVisible } from "../domain/access";
import { hpColor, MAP_SHADES, TRACK_COLOR } from "../domain/colors";

export interface Bounds { min: { x: number; y: number }; max: { x: number; y: number }; center: { x: number; y: number }; width: number }
export interface OverlayLabel {
  key: string; name: string; text: string; x: number; y: number; width: number; height: number;
  color: string; opacity: number; radius: number; fontSize: number; zIndex: number;
}
// Largura aproximada de cada caractere em fonte sem serifa negrito, em frações do tamanho da fonte.
function textEm(text: string): number {
  let em = 0;
  for (const char of text) em += /[0-9]/.test(char) ? .56 : /[A-ZÀ-Ý]/.test(char) ? .7 : /[a-zà-ÿ]/.test(char) ? .56 : char === " " ? .28 : /[./,:;|]/.test(char) ? .3 : .62;
  return Math.max(em, .5);
}
/** Linhas de bolinhas permitidas sobre a arte do token; as demais ficam do lado de fora, depois das barras. */
export const MAX_INWARD_ROWS = 2;
/** Geometry only; HP always comes from the combatant's canonical resource. */
export function markerLayout(c: CombatantState, viewer: Viewer, bounds: Bounds, layout: MarkerDisplayLayout): OverlayLabel[] {
  const markers = c.markers.filter((m) => m.onMap && markerVisible(m, c, viewer));
  const bars = markers.filter((m) => m.kind === "bar").sort((a, b) => Number(!!b.hp) - Number(!!a.hp));
  const badges = markers.filter((m) => m.kind !== "bar");
  const scale = layout.size === "SMALL" ? .75 : layout.size === "LARGE" ? 1.35 : 1;
  const baseWidth = Math.max(36, bounds.width), width = baseWidth * scale;
  const height = Math.max(10, Math.min(20, baseWidth * .13)) * scale;
  // O conjunto encosta na borda escolhida por dentro do token, sem invadir o vizinho da grade.
  const left = layout.horizontal === "LEFT" ? bounds.min.x : layout.horizontal === "RIGHT" ? bounds.max.x - width : bounds.center.x - width / 2;
  const top = layout.position === "TOP", edge = top ? bounds.min.y : bounds.max.y;
  const barY = edge - height / 2, gap = 2 * scale, diameter = height * 1.5;
  const result: OverlayLabel[] = [];
  bars.forEach((m, i) => {
    const y = barY + (top ? -1 : 1) * i * (height + gap);
    const n = markerNumbers(m, c), text = markerMapText(m, c, viewer);
    const color = m.hp ? hpColor(m.color, n.value, n.maximum, MAP_SHADES) : m.color;
    const common = { name: m.name, x: left, y, width, height, radius: height / 2, fontSize: Math.min(height * .87, (width - 4) / textEm(text)), zIndex: 0 };
    result.push({ ...common, key: m.id + "/bg", text: "", color: TRACK_COLOR, opacity: 1 });
    const fill = width * Math.max(0, Math.min(1, n.maximum > 0 ? n.value / n.maximum : 0));
    if (fill > 0) result.push({ ...common, key: m.id + "/fill", text: "", width: fill, radius: Math.min(height, fill) / 2, color, opacity: 1, zIndex: 1 });
    if (m.hp && n.value > n.maximum) {
      const over = Math.min(width, width * (n.value - n.maximum) / n.maximum);
      result.push({ ...common, key: m.id + "/over", text: "", x: left + width - over, width: over, radius: Math.min(height, over) / 2, color: "#3b82f6", opacity: 1, zIndex: 2 });
    }
    result.push({ ...common, key: m.id + "/label", text, color, opacity: 0, zIndex: 3 });
  });
  // Agrupa as bolinhas em linhas que cabem na largura do conjunto.
  const baseFont = height * .95;
  const rows: { m: (typeof badges)[number]; text: string; width: number }[][] = [];
  for (const m of badges) {
    const text = markerMapText(m, c, viewer);
    const badgeWidth = Math.min(width, Math.max(diameter, textEm(text) * baseFont + baseFont * .7));
    const row = rows.at(-1);
    if (row && row.reduce((sum, b) => sum + b.width + gap, 0) + badgeWidth <= width) row.push({ m, text, width: badgeWidth });
    else rows.push([{ m, text, width: badgeWidth }]);
  }
  const outward = bars.length ? (top ? barY - (bars.length - 1) * (height + gap) - gap : barY + bars.length * (height + gap)) : edge + (top ? -gap : gap);
  rows.forEach((row, r) => {
    const rowWidth = row.reduce((sum, b) => sum + b.width, 0) + gap * (row.length - 1);
    let x = left + (layout.horizontal === "LEFT" ? 0 : layout.horizontal === "RIGHT" ? width - rowWidth : (width - rowWidth) / 2);
    const k = r - MAX_INWARD_ROWS;
    const y = r < MAX_INWARD_ROWS
      ? (top ? barY + height + gap + r * (diameter + gap) : barY - gap - diameter - r * (diameter + gap))
      : (top ? outward - diameter - k * (diameter + gap) : outward + k * (diameter + gap));
    for (const { m, text, width: badgeWidth } of row) {
      // Marcação desligada usa o fundo neutro das barras, para ler "desligado" de longe.
      const off = m.kind === "checkbox" && !m.checked;
      result.push({ key: m.id + "/label", name: m.name, text, x, y, width: badgeWidth, height: diameter, color: off ? TRACK_COLOR : m.color, opacity: .95, radius: diameter / 2, fontSize: Math.min(baseFont, (badgeWidth - 4) / textEm(text)), zIndex: 2 });
      x += badgeWidth + gap;
    }
  });
  return result;
}
