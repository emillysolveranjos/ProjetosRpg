import type { Audience, CombatantSettings, DamageTypeDefinition, Marker } from "./types";
export const GENERIC_DAMAGE_TYPES: readonly DamageTypeDefinition[] = [
  { id: "damage-physical", name: "Físico", color: "#9ca3af", description: "Impactos, cortes e perfurações." },
  { id: "damage-fire", name: "Fogo", color: "#ef4444", description: "Chamas e calor intenso." },
  { id: "damage-cold", name: "Gelo", color: "#38bdf8", description: "Frio e congelamento." },
  { id: "damage-lightning", name: "Elétrico", color: "#facc15", description: "Eletricidade e descargas." },
  { id: "damage-poison", name: "Veneno", color: "#22c55e", description: "Toxinas e venenos." },
  { id: "damage-psychic", name: "Psíquico", color: "#a855f7", description: "Ataques mentais e psíquicos." },
  { id: "damage-magic", name: "Mágico", color: "#6366f1", description: "Energia mágica sem outro tipo específico." },
];
export const defaultDamageTypes = (): DamageTypeDefinition[] => GENERIC_DAMAGE_TYPES.map((definition) => ({ ...definition }));
export function normalizedDefinitionName(value: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("pt-BR");
}
export const privateAudience = (): Audience => ({ mode: "GM", playerIds: [] });
export function defaultSettings(): CombatantSettings {
  return {
    owners: [],
    visibility: { identity: privateAudience(), initiative: privateAudience(), defenses: privateAudience(), conditions: privateAudience(), history: privateAudience() },
    permissions: { initiative: [], damage: [], heal: [], adjustCurrentHp: [], adjustMaximumHp: [], conditions: [], endTurn: [] },
  };
}
export function defaultMarker(hp = false): Marker {
  return { id: hp ? "hp" : crypto.randomUUID(), name: hp ? "HP" : "Recurso", kind: "bar", color: hp ? "#d94848" : "#38bdb0", onMap: true, audience: privateAudience(), display: "FULL", editable: false, hp, value: 0, maximum: 1, checked: false };
}
