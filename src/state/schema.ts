import { z } from "zod";
import { defaultMarker, defaultSettings } from "../domain/defaults";
import type { RulebearSceneState } from "../domain/types";

const triggerSchema = z.enum(["TURN_START", "TURN_END"]);
const idSchema = z.string().min(1).max(200);
const categoriesSchema = z.array(z.string().min(1).max(40)).max(12);

export const damageReductionSchema = z.object({
  id: idSchema,
  label: z.string().min(1).max(50),
  amount: z.number().int().min(0).max(1_000_000),
  categories: categoriesSchema,
});

export const conditionEffectSchema = z.object({
  id: idSchema,
  trigger: triggerSchema,
  kind: z.enum(["DAMAGE", "HEAL"]),
  expression: z.string().min(1).max(40),
  categories: categoriesSchema,
  multiplyByStacks: z.boolean(),
  bypassReductions: z.boolean(),
});

export const conditionDefinitionSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(60),
  description: z.string().max(240).optional(),
  maximumStacks: z.number().int().min(1).max(99),
  duration: z.object({ ticks: z.number().int().min(1).max(999), decrementOn: triggerSchema }).optional(),
  effects: z.array(conditionEffectSchema).max(8),
});

export const appliedConditionSchema = z.object({
  id: idSchema,
  definitionId: idSchema,
  stacks: z.number().int().min(1).max(99),
  remainingTicks: z.number().int().min(1).max(999).optional(),
});

export const legacyCombatantSchema = z.object({
  tokenId: idSchema,
  currentHp: z.number().int().min(0).max(2_147_483_647),
  maximumHp: z.number().int().min(1).max(2_147_483_647),
  reductions: z.array(damageReductionSchema).max(24),
  conditions: z.array(appliedConditionSchema).max(50),
});

const historyEntrySchema = z.object({
  id: idSchema,
  occurredAt: z.iso.datetime(),
  kind: z.enum([
    "COMBATANT_ADDED", "COMBATANT_REMOVED", "DAMAGE", "HEAL", "REDUCTION_CHANGED",
    "CONDITION_APPLIED", "CONDITION_CHANGED", "CONDITION_REMOVED", "DEFINITION_CHANGED",
    "TURN_START", "TURN_END", "ENCOUNTER_CHANGED", "MARKER_CHANGED", "ACCESS_CHANGED",
  ]),
  summary: z.string().min(1).max(240),
  tokenId: idSchema.optional(),
  amount: z.number().int().optional(),
  undoneAt: z.iso.datetime().optional(),
});

const nullableCombatantSchema = z.union([legacyCombatantSchema, z.null()]);
const undoRecordSchema = z.object({
  historyId: idSchema,
  combatants: z.record(z.string(), nullableCombatantSchema).optional(),
  conditionDefinitions: z.array(conditionDefinitionSchema).max(25).optional(),
  activeTokenId: z.union([idSchema, z.null()]).optional(),
});

const legacySceneStateSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().min(0),
  combatants: z.record(z.string(), legacyCombatantSchema),
  conditionDefinitions: z.array(conditionDefinitionSchema).max(25),
  activeTokenId: idSchema.optional(),
  history: z.array(historyEntrySchema).max(50),
  undo: undoRecordSchema.optional(),
}).superRefine((state, context) => {
  if (Object.keys(state.combatants).length > 50) {
    context.addIssue({ code: "custom", message: "A cena excede 50 combatentes.", path: ["combatants"] });
  }
  for (const [tokenId, combatant] of Object.entries(state.combatants)) {
    if (combatant.tokenId !== tokenId) {
      context.addIssue({ code: "custom", message: "O ID do combatente não corresponde à sua chave.", path: ["combatants", tokenId] });
    }
    if (combatant.currentHp > combatant.maximumHp) {
      context.addIssue({ code: "custom", message: "HP atual não pode exceder o máximo.", path: ["combatants", tokenId, "currentHp"] });
    }
  }
});


export const audienceSchema = z.object({ mode: z.enum(["GM", "ALL", "OWNERS", "SELECTED"]), playerIds: z.array(idSchema).max(100) });
export const markerSchema = z.object({
  id: idSchema, name: z.string().min(1).max(50), kind: z.enum(["bar", "number", "counter", "checkbox"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/), onMap: z.boolean(), audience: audienceSchema,
  display: z.enum(["FULL", "PERCENT", "HIDDEN"]), editable: z.boolean(), hp: z.boolean().optional(),
  value: z.number().finite(), maximum: z.number().finite().positive(), checked: z.boolean(),
}).refine((m) => m.kind === "bar" || m.display !== "PERCENT", "Somente barras podem exibir porcentagem.");
const settingsSchema = z.object({
  owners: z.array(idSchema).max(100),
  visibility: z.object({ identity: audienceSchema, initiative: audienceSchema, defenses: audienceSchema, conditions: audienceSchema, history: audienceSchema }),
  permissions: z.object({ initiative: z.boolean(), damage: z.boolean(), heal: z.boolean(), conditions: z.boolean(), endTurn: z.boolean() }),
});
export const combatantSchema = legacyCombatantSchema.extend({
  settings: settingsSchema, markers: z.array(markerSchema).min(1).max(12), initiative: z.number().finite().nullable(),
}).superRefine((c, ctx) => {
  if (c.currentHp > c.maximumHp) ctx.addIssue({ code: "custom", message: "HP atual não pode exceder o máximo." });
  if (c.markers.filter((m) => m.hp).length !== 1 || c.markers.some((m) => m.hp && m.kind !== "bar"))
    ctx.addIssue({ code: "custom", message: "É necessária exatamente uma barra de HP." });
  if (new Set(c.markers.map((m) => m.id)).size !== c.markers.length)
    ctx.addIssue({ code: "custom", message: "IDs de marcadores repetidos." });
});
const encounterSchema = z.object({ order: z.array(idSchema).max(50), round: z.number().int().min(0), started: z.boolean(), paused: z.boolean() });
const templateSchema = z.object({ id: idSchema, name: z.string().min(1).max(60), markers: z.array(markerSchema).min(1).max(12) });
const snapshotSchema = z.object({
  combatants: z.record(z.string(), combatantSchema), conditionDefinitions: z.array(conditionDefinitionSchema).max(25),
  activeTokenId: idSchema.optional(), encounter: encounterSchema, templates: z.array(templateSchema).max(25),
});
export const rulebearSceneStateSchema = snapshotSchema.extend({
  schemaVersion: z.literal(2), sceneId: idSchema, revision: z.number().int().min(0),
  history: z.array(historyEntrySchema).max(50), receipts: z.array(idSchema).max(100),
  undo: z.object({
    historyId: idSchema, snapshot: snapshotSchema.optional(),
    combatants: z.record(z.string(), z.union([combatantSchema, z.null()])).optional(),
    conditionDefinitions: z.array(conditionDefinitionSchema).max(25).optional(),
    activeTokenId: z.union([idSchema, z.null()]).optional(),
  }).optional(),
}).superRefine((state, ctx) => {
  const ids = Object.keys(state.combatants);
  if (ids.length > 50) ctx.addIssue({ code: "custom", message: "A cena excede 50 combatentes." });
  for (const [key, c] of Object.entries(state.combatants))
    if (key !== c.tokenId) ctx.addIssue({ code: "custom", message: "O ID do combatente não corresponde à sua chave." });
  if (state.encounter.order.length !== ids.length || new Set(state.encounter.order).size !== ids.length || state.encounter.order.some((id) => !state.combatants[id]))
    ctx.addIssue({ code: "custom", message: "A ordem precisa conter cada combatente exatamente uma vez." });
  if (state.activeTokenId && !state.combatants[state.activeTokenId]) ctx.addIssue({ code: "custom", message: "Combatente ativo inválido." });
});
export function createEmptyState(): RulebearSceneState {
  return { schemaVersion: 2, sceneId: crypto.randomUUID(), revision: 0, combatants: {}, conditionDefinitions: [], history: [],
    encounter: { order: [], round: 0, started: false, paused: false }, templates: [], receipts: [] };
}
export function parseSceneState(value: unknown): RulebearSceneState {
  return rulebearSceneStateSchema.parse(value);
}
export function isLegacyState(value: unknown): boolean {
  return !!value && typeof value === "object" && "schemaVersion" in value && value.schemaVersion === 1;
}
/** The coordinator saves a recoverable backup before writing this conversion. */
export function migrateLegacyState(value: unknown): RulebearSceneState {
  const legacy = legacySceneStateSchema.parse(value);
  const result = createEmptyState();
  result.revision = legacy.revision + 1;
  result.combatants = Object.fromEntries(Object.entries(legacy.combatants).map(([id, c]) => [
    id, { ...c, settings: defaultSettings(), markers: [defaultMarker(true)], initiative: null },
  ]));
  result.conditionDefinitions = legacy.conditionDefinitions;
  result.history = legacy.history;
  result.activeTokenId = legacy.activeTokenId;
  result.encounter = { order: Object.keys(result.combatants), round: legacy.activeTokenId ? 1 : 0, started: !!legacy.activeTokenId, paused: false };
  return parseSceneState(result);
}
