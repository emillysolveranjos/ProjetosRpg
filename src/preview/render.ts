import type { Label } from "@owlbear-rodeo/sdk";
import { addCombatant } from "../domain/engine";
import { defaultMarker } from "../domain/defaults";
import { createEmptyState } from "../state/schema";
import { overlayAllowed, overlayItems } from "../background/overlays";
import type { CombatantState, MarkerDisplayLayout, Viewer } from "../domain/types";
import { MAP_PATTERNS, tokenImage } from "./art";
import { CAPTION, CELL, placeScenarios, type ScenarioGroup, type TokenSpec } from "./layout";

const escape = (value: string) => value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const PLAYER: Viewer = { id: "jogador", role: "PLAYER" }, GM: Viewer = { id: "mestre", role: "GM" };

// Monta o combatente como o mestre configuraria: tudo liberado ao jogador, salvo o que o cenário mudar.
function combatant(spec: TokenSpec): CombatantState {
  const [current, maximum] = spec.hp ?? [31, 48];
  const c = addCombatant(createEmptyState(), "token", Math.min(current, maximum), maximum).combatants.token!;
  c.currentHp = current;
  for (const audience of Object.values(c.settings.visibility)) audience.mode = "ALL";
  const all = { mode: "ALL" as const, playerIds: [] };
  c.markers[0] = { ...c.markers[0]!, audience: all, ...spec.hpMarker };
  (spec.markers ?? []).forEach((extra, index) => c.markers.push({ ...defaultMarker(), id: "m" + index, kind: "number", audience: all, ...extra }));
  return c;
}

// Coordenadas em unidades da cena; o zoom escala tudo junto, como a câmera do Owlbear.
function tokenSvg(spec: TokenSpec, x0: number, y0: number, viewer: Viewer, scale: number): string {
  const [w, h] = typeof spec.size === "object" ? spec.size : [spec.size ?? 1, spec.size ?? 1];
  const width = w * CELL, height = h * CELL, x = spec.at[0] * CELL, y = spec.at[1] * CELL;
  const visible = spec.visible ?? true;
  // Jogadores não veem tokens invisíveis; o mestre os vê translúcidos, como no Owlbear.
  if (!visible && viewer.role !== "GM") return "";
  let svg = `<image href="${tokenImage(spec.art)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none"${visible ? "" : ` opacity=".45"`}/>`;
  const c = combatant(spec);
  if (overlayAllowed({ visible }, c, viewer)) {
    const bounds = { min: { x, y }, max: { x: x + width, y: y + height }, center: { x: x + width / 2, y: y + height / 2 }, width };
    const layout: MarkerDisplayLayout = { position: "BOTTOM", horizontal: "CENTER", size: "MEDIUM", ...spec.layout };
    // Desenha os mesmos itens que a Rulebear envia ao Owlbear, na ordem de zIndex.
    const items = overlayItems("token", c, viewer, bounds, layout) as Label[];
    for (const item of items.sort((a, b) => a.zIndex - b.zIndex)) svg += labelSvg(item);
  }
  return `<g transform="translate(${x0} ${y0}) scale(${scale})">${svg}</g>`;
}

/** Reproduz uma etiqueta do Owlbear: caixa com ponteiro para baixo ancorada em position. */
export function labelSvg(item: Label): string {
  const { text, style, position } = item;
  const width = Number(text.width), height = Number(text.height);
  const x = position.x - width / 2, y = position.y - height - (style.pointerHeight ?? 0);
  const radius = Math.min(style.cornerRadius, width / 2, height / 2);
  let svg = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${style.backgroundColor}" fill-opacity="${style.backgroundOpacity}"/>`;
  if (text.plainText) svg += `<text x="${x + width / 2}" y="${y + height / 2}" font-size="${text.style.fontSize}" font-weight="${text.style.fontWeight}" font-family="${text.style.fontFamily}" fill="${text.style.fillColor}" text-anchor="middle" dominant-baseline="central">${escape(text.plainText)}</text>`;
  return svg;
}

/** Desenha um grupo de cenários como um único SVG com grade, mapa, tokens e marcadores. */
export function renderGroup(group: ScenarioGroup): { svg: string; width: number; height: number } {
  const { slots, width, height } = placeScenarios(group.scenarios);
  let body = "";
  group.scenarios.forEach((scenario, index) => {
    const { x, y, width: slotW, height: slotH, scale } = slots[index]!;
    const top = y + CAPTION, viewer = scenario.viewer === "PLAYER" ? PLAYER : GM;
    body += `<g><rect x="${x}" y="${top}" width="${slotW}" height="${slotH}" fill="url(#map-${scenario.map ?? group.map})"/>`;
    for (let gx = 0; gx <= scenario.cells[0]; gx++) body += `<line x1="${x + gx * CELL * scale}" y1="${top}" x2="${x + gx * CELL * scale}" y2="${top + slotH}" stroke="#000" stroke-opacity=".35" stroke-width="2"/>`;
    for (let gy = 0; gy <= scenario.cells[1]; gy++) body += `<line x1="${x}" y1="${top + gy * CELL * scale}" x2="${x + slotW}" y2="${top + gy * CELL * scale}" stroke="#000" stroke-opacity=".35" stroke-width="2"/>`;
    for (const token of scenario.tokens) body += tokenSvg(token, x, top, viewer, scale);
    body += `<text x="${x + 4}" y="${y + 18}" font-size="16" font-weight="700" fill="#f5f5f5" font-family="sans-serif">${escape(scenario.title)}</text>`;
    body += `<text x="${x + 4}" y="${y + 36}" font-size="13" fill="#b8bdd0" font-family="sans-serif">${viewer.role === "GM" ? "Visão do mestre" : "Visão do jogador"}${scale !== 1 ? ` · zoom ${Math.round(scale * 100)}%` : ""}</text></g>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${Object.values(MAP_PATTERNS).join("")}</defs>${body}</svg>`;
  return { svg, width, height };
}
