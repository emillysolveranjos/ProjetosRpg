import type { Audience, CombatantSettings, Marker } from "./types";
export const privateAudience = (): Audience => ({ mode: "GM", playerIds: [] });
export function defaultSettings(): CombatantSettings {
  return {
    owners: [],
    visibility: { identity: privateAudience(), initiative: privateAudience(), defenses: privateAudience(), conditions: privateAudience(), history: privateAudience() },
    permissions: { initiative: false, damage: false, heal: false, conditions: false, endTurn: false },
  };
}
export function defaultMarker(hp = false): Marker {
  return { id: hp ? "hp" : crypto.randomUUID(), name: hp ? "HP" : "Recurso", kind: "bar", color: hp ? "#d94848" : "#38bdb0", onMap: true, audience: privateAudience(), display: "FULL", editable: false, hp, value: 0, maximum: 1, checked: false };
}
