import type { DisplayPreferences, HorizontalPreference, MarkerDisplayLayout, MarkerSizePreference, PositionPreference, TokenDisplayOverride } from "../domain/types";
import { PLUGIN_ID } from "../config";
const key = (room: string, player: string) => `${PLUGIN_ID}/display/${room}/${player}`;
const positions = new Set<PositionPreference>(["TOP", "BOTTOM"]);
const horizontals = new Set<HorizontalPreference>(["LEFT", "CENTER", "RIGHT"]);
const sizes = new Set<MarkerSizePreference>(["SMALL", "MEDIUM", "LARGE"]);
const defaults = (): DisplayPreferences => ({ position: "BOTTOM", horizontal: "CENTER", size: "MEDIUM", overrides: {} });
function parseOverride(value: unknown): TokenDisplayOverride | undefined {
  if (typeof value === "string") return positions.has(value as PositionPreference) ? { position: value as PositionPreference } : undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>, parsed: TokenDisplayOverride = {};
  if (positions.has(raw.position as PositionPreference)) parsed.position = raw.position as PositionPreference;
  if (horizontals.has(raw.horizontal as HorizontalPreference)) parsed.horizontal = raw.horizontal as HorizontalPreference;
  if (sizes.has(raw.size as MarkerSizePreference)) parsed.size = raw.size as MarkerSizePreference;
  return Object.keys(parsed).length ? parsed : undefined;
}
export function readPreferences(room: string, player: string): DisplayPreferences {
  try {
    const raw = JSON.parse(localStorage.getItem(key(room, player)) ?? "{}") as Record<string, unknown>;
    const overrides: Record<string, TokenDisplayOverride> = {};
    if (raw.overrides && typeof raw.overrides === "object" && !Array.isArray(raw.overrides)) {
      for (const [token, value] of Object.entries(raw.overrides as Record<string, unknown>)) {
        const parsed = parseOverride(value); if (parsed) overrides[token] = parsed;
      }
    }
    return {
      position: positions.has(raw.position as PositionPreference) ? raw.position as PositionPreference : "BOTTOM",
      horizontal: horizontals.has(raw.horizontal as HorizontalPreference) ? raw.horizontal as HorizontalPreference : "CENTER",
      size: sizes.has(raw.size as MarkerSizePreference) ? raw.size as MarkerSizePreference : "MEDIUM",
      overrides,
    };
  } catch { return defaults(); }
}
export function savePreferences(room: string, player: string, value: DisplayPreferences) {
  localStorage.setItem(key(room, player), JSON.stringify(value));
}
export function tokenPosition(value: DisplayPreferences, sceneId: string, tokenId: string): PositionPreference {
  return tokenDisplayLayout(value, sceneId, tokenId).position;
}
export function tokenDisplayLayout(value: DisplayPreferences, sceneId: string, tokenId: string): MarkerDisplayLayout {
  const override = value.overrides[sceneId + "/" + tokenId];
  return {
    position: override?.position ?? value.position,
    horizontal: override?.horizontal ?? value.horizontal,
    size: override?.size ?? value.size,
  };
}
