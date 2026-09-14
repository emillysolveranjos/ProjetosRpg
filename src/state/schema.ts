import { z } from "zod";
import { defaultDamageTypes, defaultMarker, defaultSettings, normalizedDefinitionName } from "../domain/defaults";
import type { CombatantState, CombatantSettings, ConditionDefinition, DamageTypeDefinition, RulebearSceneState } from "../domain/types";

const HP_LIMIT = 2_147_483_647;
const triggerSchema = z.enum(["TURN_START", "TURN_END"]);
const idSchema = z.string().min(1).max(200);
const categoriesSchema = z.array(z.string().min(1).max(40)).max(12);
const damageTypeIdsSchema = z.array(idSchema).max(12);
const hpV3Schema = z.number().int().min(-HP_LIMIT).max(HP_LIMIT);

const oldDamageReductionSchema = z.object({ id: idSchema, label: z.string().min(1).max(50), amount: z.number().int().min(0).max(1_000_000), categories: categoriesSchema });
const oldConditionEffectSchema = z.object({ id: idSchema, trigger: triggerSchema, kind: z.enum(["DAMAGE", "HEAL"]), expression: z.string().min(1).max(40), categories: categoriesSchema, multiplyByStacks: z.boolean(), bypassReductions: z.boolean() });
export const damageReductionSchema = z.object({ id: idSchema, label: z.string().min(1).max(50), amount: z.number().int().min(0).max(1_000_000), damageTypeIds: damageTypeIdsSchema });
export const conditionEffectSchema = z.object({ id: idSchema, trigger: triggerSchema, kind: z.enum(["DAMAGE", "HEAL"]), expression: z.string().min(1).max(40), damageTypeIds: damageTypeIdsSchema, multiplyByStacks: z.boolean(), bypassReductions: z.boolean() });
export const conditionDefinitionSchema = z.object({
  id: idSchema, name: z.string().min(1).max(60), description: z.string().max(240).optional(), maximumStacks: z.number().int().min(1).max(99),
  duration: z.object({ ticks: z.number().int().min(1).max(999), decrementOn: triggerSchema }).optional(), effects: z.array(conditionEffectSchema).max(8),
});
const oldConditionDefinitionSchema = conditionDefinitionSchema.extend({ effects: z.array(oldConditionEffectSchema).max(8) });
export const appliedConditionSchema = z.object({ id: idSchema, definitionId: idSchema, stacks: z.number().int().min(1).max(99), remainingTicks: z.number().int().min(1).max(999).optional() });
export const legacyCombatantSchema = z.object({ tokenId: idSchema, currentHp: z.number().int().min(0).max(HP_LIMIT), maximumHp: z.number().int().min(1).max(HP_LIMIT), reductions: z.array(oldDamageReductionSchema).max(24), conditions: z.array(appliedConditionSchema).max(50) });
const historyEntrySchema = z.object({
  id: idSchema, occurredAt: z.iso.datetime(),
  kind: z.enum(["COMBATANT_ADDED", "COMBATANT_REMOVED", "DAMAGE", "HEAL", "REDUCTION_CHANGED", "CONDITION_APPLIED", "CONDITION_CHANGED", "CONDITION_REMOVED", "DEFINITION_CHANGED", "TURN_START", "TURN_END", "ENCOUNTER_CHANGED", "MARKER_CHANGED", "ACCESS_CHANGED", "LIBRARY_CHANGED"]),
  summary: z.string().min(1).max(240), tokenId: idSchema.optional(), amount: z.number().int().optional(), undoneAt: z.iso.datetime().optional(),
});
const legacyUndoSchema = z.object({ historyId: idSchema, combatants: z.record(z.string(), z.union([legacyCombatantSchema, z.null()])).optional(), conditionDefinitions: z.array(oldConditionDefinitionSchema).max(25).optional(), activeTokenId: z.union([idSchema, z.null()]).optional() });
const legacySceneStateSchema = z.object({
  schemaVersion: z.literal(1), revision: z.number().int().min(0), combatants: z.record(z.string(), legacyCombatantSchema), conditionDefinitions: z.array(oldConditionDefinitionSchema).max(25), activeTokenId: idSchema.optional(), history: z.array(historyEntrySchema).max(50), undo: legacyUndoSchema.optional(),
}).superRefine((state, context) => {
  if (Object.keys(state.combatants).length > 50) context.addIssue({ code: "custom", message: "A cena excede 50 combatentes.", path: ["combatants"] });
  for (const [tokenId, combatant] of Object.entries(state.combatants)) {
    if (combatant.tokenId !== tokenId) context.addIssue({ code: "custom", message: "O ID do combatente não corresponde à sua chave.", path: ["combatants", tokenId] });
    if (combatant.currentHp > combatant.maximumHp) context.addIssue({ code: "custom", message: "HP atual não pode exceder o máximo.", path: ["combatants", tokenId, "currentHp"] });
  }
});

export const audienceSchema = z.object({ mode: z.enum(["GM", "ALL", "OWNERS", "SELECTED"]), playerIds: z.array(idSchema).max(100) });
export const markerSchema = z.object({
  id: idSchema, name: z.string().min(1).max(50), kind: z.enum(["bar", "number", "counter", "checkbox"]), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), onMap: z.boolean(), audience: audienceSchema,
  display: z.enum(["FULL", "PERCENT", "HIDDEN"]), editable: z.boolean(), hp: z.boolean().optional(), value: z.number().finite(), maximum: z.number().finite().positive(), checked: z.boolean(),
}).refine((m) => m.kind === "bar" || m.display !== "PERCENT", "Somente barras podem exibir porcentagem.");
const visibilitySchema = z.object({ identity: audienceSchema, initiative: audienceSchema, defenses: audienceSchema, conditions: audienceSchema, history: audienceSchema });
const legacySettingsSchema = z.object({ owners: z.array(idSchema).max(100), visibility: visibilitySchema, permissions: z.object({ initiative: z.boolean(), damage: z.boolean(), heal: z.boolean(), conditions: z.boolean(), endTurn: z.boolean() }) });
const settingsSchema = z.object({
  owners: z.array(idSchema).max(100), visibility: visibilitySchema,
  permissions: z.object({ initiative: z.array(idSchema).max(100), damage: z.array(idSchema).max(100), heal: z.array(idSchema).max(100), adjustCurrentHp: z.array(idSchema).max(100), adjustMaximumHp: z.array(idSchema).max(100), conditions: z.array(idSchema).max(100), endTurn: z.array(idSchema).max(100) }),
});
function refineCombatant<T extends z.ZodObject>(schema: T, bounded = false) {
  return schema.superRefine((c, ctx) => {
    const value = c as { currentHp: number; maximumHp: number; markers: Array<{ id: string; hp?: boolean; kind: string }> };
    if (bounded && value.currentHp > value.maximumHp) ctx.addIssue({ code: "custom", message: "HP atual não pode exceder o máximo." });
    if (value.markers.filter((m) => m.hp).length !== 1 || value.markers.some((m) => m.hp && m.kind !== "bar")) ctx.addIssue({ code: "custom", message: "É necessária exatamente uma barra de HP." });
    if (new Set(value.markers.map((m) => m.id)).size !== value.markers.length) ctx.addIssue({ code: "custom", message: "IDs de marcadores repetidos." });
  });
}
const oldCombatantBase = legacyCombatantSchema.extend({ settings: legacySettingsSchema, markers: z.array(markerSchema).min(1).max(12), initiative: z.number().finite().nullable() });
const v2CombatantSchema = refineCombatant(oldCombatantBase, true);
const v3CombatantSchema = refineCombatant(oldCombatantBase.extend({ currentHp: hpV3Schema }));
const v4CombatantSchema = refineCombatant(legacyCombatantSchema.extend({ currentHp: hpV3Schema, settings: settingsSchema, markers: z.array(markerSchema).min(1).max(12), initiative: z.number().finite().nullable() }));
export const combatantSchema = refineCombatant(z.object({ tokenId: idSchema, currentHp: hpV3Schema, maximumHp: z.number().int().min(1).max(HP_LIMIT), reductions: z.array(damageReductionSchema).max(24), conditions: z.array(appliedConditionSchema).max(50), settings: settingsSchema, markers: z.array(markerSchema).min(1).max(12), initiative: z.number().finite().nullable() }));
const encounterSchema = z.object({ order: z.array(idSchema).max(50), round: z.number().int().min(0), started: z.boolean(), paused: z.boolean() });
const templateSchema = z.object({ id: idSchema, name: z.string().min(1).max(60), markers: z.array(markerSchema).min(1).max(12) });
const damageTypeSchema = z.object({ id: idSchema, name: z.string().min(1).max(60), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), description: z.string().max(240).optional() });
const defensePresetSchema = z.object({ id: idSchema, name: z.string().min(1).max(60), amount: z.number().int().min(0).max(1_000_000), damageTypeIds: damageTypeIdsSchema });
function makeSnapshot(combatant: z.ZodType, definition: z.ZodType = oldConditionDefinitionSchema, libraries = false) {
  return z.object({ combatants: z.record(z.string(), combatant), conditionDefinitions: z.array(definition).max(25), activeTokenId: idSchema.optional(), encounter: encounterSchema, templates: z.array(templateSchema).max(25),
    ...(libraries ? { damageTypes: z.array(damageTypeSchema).max(50), defensePresets: z.array(defensePresetSchema).max(50) } : {}),
  });
}
function makeState(version: 2 | 3 | 4 | 5, combatant: z.ZodType, definition: z.ZodType = oldConditionDefinitionSchema, libraries = false) {
  const snapshot = makeSnapshot(combatant, definition, libraries);
  return snapshot.extend({
    schemaVersion: z.literal(version), sceneId: idSchema, revision: z.number().int().min(0), history: z.array(historyEntrySchema).max(50), receipts: z.array(idSchema).max(100),
    undo: z.object({ historyId: idSchema, snapshot: snapshot.optional(), combatants: z.record(z.string(), z.union([combatant, z.null()])).optional(), conditionDefinitions: z.array(definition).max(25).optional(),
      ...(libraries ? { damageTypes: z.array(damageTypeSchema).max(50).optional(), defensePresets: z.array(defensePresetSchema).max(50).optional() } : {}),
      activeTokenId: z.union([idSchema, z.null()]).optional() }).optional(),
  }).superRefine((state, ctx) => {
    const ids = Object.keys(state.combatants);
    if (ids.length > 50) ctx.addIssue({ code: "custom", message: "A cena excede 50 combatentes." });
    for (const [key, value] of Object.entries(state.combatants)) if (key !== (value as { tokenId: string }).tokenId) ctx.addIssue({ code: "custom", message: "O ID do combatente não corresponde à sua chave." });
    if (state.encounter.order.length !== ids.length || new Set(state.encounter.order).size !== ids.length || state.encounter.order.some((id) => !state.combatants[id])) ctx.addIssue({ code: "custom", message: "A ordem precisa conter cada combatente exatamente uma vez." });
    if (state.activeTokenId && !state.combatants[state.activeTokenId]) ctx.addIssue({ code: "custom", message: "Combatente ativo inválido." });
  });
}
const v2SceneStateSchema = makeState(2, v2CombatantSchema);
const v3SceneStateSchema = makeState(3, v3CombatantSchema);
const v4SceneStateSchema = makeState(4, v4CombatantSchema);
const v5SceneStateBaseSchema = makeState(5, combatantSchema, conditionDefinitionSchema, true) as z.ZodType<RulebearSceneState>;
export const rulebearSceneStateSchema = v5SceneStateBaseSchema.superRefine((state, ctx) => {
  const typeIds = new Set(state.damageTypes.map((type) => type.id));
  if (typeIds.size !== state.damageTypes.length) ctx.addIssue({ code: "custom", message: "IDs de tipos de dano repetidos.", path: ["damageTypes"] });
  if (new Set(state.damageTypes.map((type) => normalizedDefinitionName(type.name))).size !== state.damageTypes.length) ctx.addIssue({ code: "custom", message: "Nomes de tipos de dano repetidos.", path: ["damageTypes"] });
  if (new Set(state.defensePresets.map((preset) => preset.id)).size !== state.defensePresets.length) ctx.addIssue({ code: "custom", message: "IDs de presets repetidos.", path: ["defensePresets"] });
  if (new Set(state.defensePresets.map((preset) => normalizedDefinitionName(preset.name))).size !== state.defensePresets.length) ctx.addIssue({ code: "custom", message: "Nomes de presets repetidos.", path: ["defensePresets"] });
  const referenced = [
    ...Object.values(state.combatants).flatMap((combatant) => combatant.reductions.flatMap((reduction) => reduction.damageTypeIds)),
    ...state.conditionDefinitions.flatMap((condition) => condition.effects.flatMap((effect) => effect.damageTypeIds)),
    ...state.defensePresets.flatMap((preset) => preset.damageTypeIds),
  ];
  if (referenced.some((id) => !typeIds.has(id))) ctx.addIssue({ code: "custom", message: "Há referências a tipos de dano inexistentes.", path: ["damageTypes"] });
});

export function createEmptyState(): RulebearSceneState {
  return { schemaVersion: 5, sceneId: crypto.randomUUID(), revision: 0, combatants: {}, conditionDefinitions: [], damageTypes: defaultDamageTypes(), defensePresets: [], history: [], encounter: { order: [], round: 0, started: false, paused: false }, templates: [], receipts: [] };
}
export function parseSceneState(value: unknown): RulebearSceneState { return rulebearSceneStateSchema.parse(value) as RulebearSceneState; }
export function isMigratableState(value: unknown): boolean {
  if (!value || typeof value !== "object" || !("schemaVersion" in value)) return false;
  return value.schemaVersion === 1 || value.schemaVersion === 2 || value.schemaVersion === 3 || value.schemaVersion === 4;
}
type BooleanCombatant = z.infer<typeof v3CombatantSchema>;
type ListCombatant = z.infer<typeof v4CombatantSchema>;
type OldConditionDefinition = z.infer<typeof oldConditionDefinitionSchema>;
type OldSnapshot = {
  combatants: Record<string, BooleanCombatant | ListCombatant>;
  conditionDefinitions: OldConditionDefinition[];
  activeTokenId?: string;
  encounter: z.infer<typeof encounterSchema>;
  templates: z.infer<typeof templateSchema>[];
};
type OldState = OldSnapshot & {
  schemaVersion: 2 | 3 | 4;
  sceneId: string;
  revision: number;
  history: z.infer<typeof historyEntrySchema>[];
  receipts: string[];
  undo?: {
    historyId: string;
    snapshot?: OldSnapshot;
    combatants?: Record<string, BooleanCombatant | ListCombatant | null>;
    conditionDefinitions?: OldConditionDefinition[];
    activeTokenId?: string | null;
  };
};

function migrateSettings(combatant: BooleanCombatant | ListCombatant): CombatantSettings {
  const previous = combatant.settings.permissions;
  if (Array.isArray(previous.damage)) return structuredClone(combatant.settings) as CombatantSettings;
  const owners = [...combatant.settings.owners];
  const hpEditable = combatant.markers.some((marker) => marker.hp && marker.editable);
  return { owners, visibility: structuredClone(combatant.settings.visibility), permissions: {
    initiative: previous.initiative ? owners : [], damage: previous.damage ? owners : [], heal: previous.heal ? owners : [], adjustCurrentHp: hpEditable ? owners : [], adjustMaximumHp: [], conditions: previous.conditions ? owners : [], endTurn: previous.endTurn ? owners : [],
  } };
}

function createDamageTypeResolver() {
  const types = defaultDamageTypes();
  const byName = new Map(types.map((type) => [normalizedDefinitionName(type.name), type.id]));
  const resolve = (categories: string[]): string[] => [...new Set(categories.map((category) => category.trim()).filter(Boolean).map((category) => {
    const key = normalizedDefinitionName(category);
    const existing = byName.get(key);
    if (existing) return existing;
    const definition: DamageTypeDefinition = { id: crypto.randomUUID(), name: category, color: "#64748b" };
    types.push(definition);
    byName.set(key, definition.id);
    return definition.id;
  }))];
  return { types, resolve };
}

type Resolver = ReturnType<typeof createDamageTypeResolver>;
function migrateDefinition(definition: OldConditionDefinition, resolver: Resolver): ConditionDefinition {
  return {
    ...structuredClone(definition),
    effects: definition.effects.map(({ categories, ...effect }) => ({ ...effect, damageTypeIds: resolver.resolve(categories) })),
  };
}
function migrateCombatant(combatant: BooleanCombatant | ListCombatant, resolver: Resolver): CombatantState {
  return {
    ...structuredClone(combatant),
    settings: migrateSettings(combatant),
    reductions: combatant.reductions.map(({ categories, ...reduction }) => ({ ...reduction, damageTypeIds: resolver.resolve(categories) })),
  } as CombatantState;
}
function migrateCombatants(combatants: Record<string, BooleanCombatant | ListCombatant>, resolver: Resolver): Record<string, CombatantState> {
  return Object.fromEntries(Object.entries(combatants).map(([id, combatant]) => [id, migrateCombatant(combatant, resolver)]));
}
function migrateSnapshot(snapshot: OldSnapshot, resolver: Resolver) {
  return {
    combatants: migrateCombatants(snapshot.combatants, resolver),
    conditionDefinitions: snapshot.conditionDefinitions.map((definition) => migrateDefinition(definition, resolver)),
    ...(snapshot.activeTokenId ? { activeTokenId: snapshot.activeTokenId } : {}),
    encounter: structuredClone(snapshot.encounter),
    templates: structuredClone(snapshot.templates),
    damageTypes: resolver.types,
    defensePresets: [],
  };
}

/** The coordinator saves a recoverable backup before writing a v1/v2/v3/v4 conversion. */
export function migrateSceneState(value: unknown): RulebearSceneState {
  const resolver = createDamageTypeResolver();
  if (value && typeof value === "object" && "schemaVersion" in value && (value.schemaVersion === 2 || value.schemaVersion === 3 || value.schemaVersion === 4)) {
    const parsed = (value.schemaVersion === 2 ? v2SceneStateSchema : value.schemaVersion === 3 ? v3SceneStateSchema : v4SceneStateSchema).parse(value);
    const previous = parsed as unknown as OldState;
    const migrated = migrateSnapshot(previous, resolver);
    const undo = previous.undo ? {
      historyId: previous.undo.historyId,
      ...(previous.undo.snapshot ? { snapshot: migrateSnapshot(previous.undo.snapshot, resolver) } : {}),
      ...(previous.undo.combatants ? { combatants: Object.fromEntries(Object.entries(previous.undo.combatants).map(([id, combatant]) => [id, combatant ? migrateCombatant(combatant, resolver) : null])) } : {}),
      ...(previous.undo.conditionDefinitions ? { conditionDefinitions: previous.undo.conditionDefinitions.map((definition) => migrateDefinition(definition, resolver)) } : {}),
      ...(previous.undo.activeTokenId !== undefined ? { activeTokenId: previous.undo.activeTokenId } : {}),
      damageTypes: resolver.types,
      defensePresets: [],
    } : undefined;
    if (migrated.damageTypes.length > 50) throw new Error("A migração encontrou mais de 50 tipos de dano distintos.");
    return parseSceneState({ ...migrated, damageTypes: resolver.types, schemaVersion: 5, sceneId: previous.sceneId, revision: previous.revision + 1, history: previous.history, receipts: previous.receipts, ...(undo ? { undo } : {}) });
  }
  const legacy = legacySceneStateSchema.parse(value);
  const wrap = (combatant: z.infer<typeof legacyCombatantSchema>): ListCombatant => ({ ...combatant, settings: defaultSettings(), markers: [defaultMarker(true)], initiative: null });
  const combatants = Object.fromEntries(Object.entries(legacy.combatants).map(([id, combatant]) => [id, migrateCombatant(wrap(combatant), resolver)]));
  const definitions = legacy.conditionDefinitions.map((definition) => migrateDefinition(definition, resolver));
  const result = createEmptyState();
  result.revision = legacy.revision + 1;
  result.combatants = combatants;
  result.conditionDefinitions = definitions;
  result.damageTypes = resolver.types;
  result.history = legacy.history;
  if (legacy.activeTokenId) result.activeTokenId = legacy.activeTokenId;
  result.encounter = { order: Object.keys(result.combatants), round: legacy.activeTokenId ? 1 : 0, started: !!legacy.activeTokenId, paused: false };
  if (legacy.undo) {
    result.undo = {
      historyId: legacy.undo.historyId,
      ...(legacy.undo.combatants ? { combatants: Object.fromEntries(Object.entries(legacy.undo.combatants).map(([id, combatant]) => [id, combatant ? migrateCombatant(wrap(combatant), resolver) : null])) } : {}),
      ...(legacy.undo.conditionDefinitions ? { conditionDefinitions: legacy.undo.conditionDefinitions.map((definition) => migrateDefinition(definition, resolver)) } : {}),
      ...(legacy.undo.activeTokenId !== undefined ? { activeTokenId: legacy.undo.activeTokenId } : {}),
      damageTypes: resolver.types,
      defensePresets: [],
    };
  }
  result.damageTypes = resolver.types;
  if (result.damageTypes.length > 50) throw new Error("A migração encontrou mais de 50 tipos de dano distintos.");
  return parseSceneState(result);
}
export const isLegacyState = isMigratableState;
export const migrateLegacyState = migrateSceneState;
