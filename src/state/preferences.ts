import type { DisplayPreferences, PositionPreference } from "../domain/types";
import { PLUGIN_ID } from "../config";
const key = (room: string, player: string) => `${PLUGIN_ID}/display/${room}/${player}`;
export function readPreferences(room: string, player: string): DisplayPreferences {
  try {
    const raw = JSON.parse(localStorage.getItem(key(room, player)) ?? "{}") as Partial<DisplayPreferences>;
    const overrides = Object.fromEntries(Object.entries(raw.overrides ?? {}).filter(([, v]) => v === "TOP" || v === "BOTTOM"));
    return { position: raw.position === "TOP" ? "TOP" : "BOTTOM", overrides };
  } catch { return { position: "BOTTOM", overrides: {} }; }
}
export function savePreferences(room: string, player: string, value: DisplayPreferences) {
  localStorage.setItem(key(room, player), JSON.stringify(value));
}
export function tokenPosition(value: DisplayPreferences, sceneId: string, tokenId: string): PositionPreference {
  return value.overrides[sceneId + "/" + tokenId] ?? value.position;
}
