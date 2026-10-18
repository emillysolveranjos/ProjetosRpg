import type { Marker, MarkerDisplayLayout, Viewer } from "../domain/types";
import type { MapArt, TokenArt } from "./art";

// Posições dos cenários na página. Sem dependência do SDK, para o script de captura calcular o tamanho.
/** Uma célula da grade padrão do Owlbear (150 dpi). */
export const CELL = 150;
export const CAPTION = 44, GAP = 24, MAX_WIDTH = 1800;

export interface TokenSpec {
  at: [number, number];
  size?: number | [number, number];
  art: TokenArt;
  visible?: boolean;
  layout?: Partial<MarkerDisplayLayout>;
  hp?: [number, number];
  hpMarker?: Partial<Marker>;
  markers?: Partial<Marker>[];
}
export interface Scenario { title: string; cells: [number, number]; map?: MapArt; viewer?: Viewer["role"]; zoom?: number; tokens: TokenSpec[] }
export interface ScenarioGroup { id: string; title: string; description: string; map: MapArt; scenarios: Scenario[] }
export interface Slot { x: number; y: number; width: number; height: number; scale: number }

export function placeScenarios(scenarios: Scenario[]): { slots: Slot[]; width: number; height: number } {
  let x = 0, y = 0, rowHeight = 0, width = 0;
  const slots = scenarios.map((scenario) => {
    const scale = scenario.zoom ?? 1;
    const slotW = scenario.cells[0] * CELL * scale, slotH = scenario.cells[1] * CELL * scale;
    if (x && x + slotW > MAX_WIDTH) { x = 0; y += rowHeight + GAP; rowHeight = 0; }
    const slot = { x, y, width: slotW, height: slotH, scale };
    x += slotW + GAP; rowHeight = Math.max(rowHeight, CAPTION + slotH); width = Math.max(width, x - GAP);
    return slot;
  });
  return { slots, width, height: y + rowHeight };
}
