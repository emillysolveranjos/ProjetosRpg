import { z } from "zod";
import { defaultDamageTypes, defaultMarker, defaultSettings, normalizedDefinitionName } from "../domain/defaults";
import type { CombatantState, CombatantSettings, ConditionDefinition, DamageTypeDefinition, RulebearSceneState } from "../domain/types";

const HP_LIMIT = 2_147_483_647;
const RD_LIMIT = 1_000_000;
const triggerSchema = z.enum(["TURN_START", "TURN_END"]);
const idSchema = z.string().min(1).max(200);
const categoriesSchema = z.array(z.string().min(1).max(40)).max(12);
const damageTypeIdsSchema = z.array(idSchema).max(12);
const hpV3Schema = z.number().int().min(-HP_LIMIT).max(HP_LIMIT);
const expressionSchema = z.string().min(1).max(40);

const oldDamageReductionSchema = z.object({ id: idSchema, label: z.string().min(1).max(50), amount: z.number().int().min(0).max(RD_LIMIT), categories: categoriesSchema });
const oldConditionEffectSchema = z.object({ id: idSchema, trigger: triggerSchema, kind: z.enum(["DAMAGE", "HEAL"]), expression: expressionSchema, categories: categoriesSchema, multiplyByStacks: z.boolean(), bypassReductions: z.boolean() });
const v5DamageReductionSchema = z.object({ id: idSchema, label: z.string().min(1).max(50), amount: z.number().int().min(0).max(RD_LIMIT), damageTypeIds: damageTypeIdsSchema });
const v5ConditionEffectSchema = z.object({ id: idSchema, trigger: triggerSchema, kind: z.enum(["DAMAGE", "HEAL"]), expression: expressionSchema, damageTypeIds: damageTypeIdsSchema, multiplyByStacks: z.boolean(), bypassReductions: z.boolean() });
export const damageReductionSchema = z.object({ id: idSchema, label: z.string().min(1).max(50), kind: z.enum(["REDUCTION", "IMMUNITY"]), amount: z.number().int().min(0).max(RD_LIMIT), damageTypeIds: damageTypeIdsSchema })
  .refine((defense) => defense.kind === "REDUCTION" || defense.amount === 0, { message: "Imunidades não possuem valor de RD.", path: ["amount"] });
export const damageComponentSchema = z.object({ expression: expressionSchema, damageTypeIds: damageTypeIdsSchema, ignoreImmunity: z.boolean(), ignoreReductionExpression: expressionSchema.optional() });
export const conditionEffectSchema = z.object({ id: idSchema, trigger: triggerSchema, kind: z.enum(["DAMAGE", "HEAL"]), expression: expressionSchema, damageTypeIds: damageTypeIdsSchema, multiplyByStacks: z.boolean(), ignoreImmunity: z.boolean(), ignoreReductionExpression: expressionSchema.optional() })
  .superRefine((effect, context) => {
    if (effect.kind === "HEAL" && (effect.damageTypeIds.length || effect.ignoreImmunity || effect.ignoreReductionExpression)) context.addIssue({ code: "custom", message: "Efeitos de cura não usam tipos, imunidade ou RD." });
  });

const conditionDefinitionFields = {
  id: idSchema,
  name: z.string().min(1).max(60),
  description: z.string().max(240).optional(),
  maximumStacks: z.number().int().min(1).max(99),
  duration: z.object({ ticks: z.number().int().min(1).max(999), decrementOn: triggerSchema }).optional(),
};
const oldConditionDefinitionSchema = z.object({ ...conditionDefinitionFields, effects: z.array(oldConditionEffectSchema).max(8) });
const v5ConditionDefinitionSchema = z.object({ ...conditionDefinitionFields, effects: z.array(v5ConditionEffectSchema).max(8) });
export const conditionDefinitionSchema = z.object({ ...conditionDefinitionFields, effects: z.array(conditionEffectSchema).max(12) });
export const appliedConditionSchema = z.object({ id: idSchema, definitionId: idSchema, stacks: z.number().int().min(1).max(99), remainingTicks: z.number().int().min(1).max(999).optional() });
export const legacyCombatantSchema = z.object({ tokenId: idSchema, currentHp: z.number().int().min(0).max(HP_LIMIT), maximumHp: z.number().int().min(1).max(HP_LIMIT), reductions: z.array(oldDamageReductionSchema).max(24), conditions: z.array(appliedConditionSchema).max(50) });
const historyEntrySchema = z.object({
  damageDetails: z.array(z.object({ tokenId: idSchema, source: z.string().max(60).optional(), types: z.array(z.string().max(60)).max(12), raw: z.number().int().nonnegative(), rd: z.number().int().nonnegative(), penetration: z.number().int().nonnegative(), immune: z.boolean(), ignoreImmunity: z.boolean(), final: z.number().int().nonnegative() })).max(1200).optional(),
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
}).refine((marker) => marker.kind === "bar" || marker.display !== "PERCENT", "Somente barras podem exibir porcentagem.");
const visibilitySchema = z.object({ identity: audienceSchema, initiative: audienceSchema, defenses: audienceSchema, conditions: audienceSchema, history: audienceSchema });
const legacySettingsSchema = z.object({ owners: z.array(idSchema).max(100), visibility: visibilitySchema, permissions: z.object({ initiative: z.boolean(), damage: z.boolean(), heal: z.boolean(), conditions: z.boolean(), endTurn: z.boolean() }) });
const settingsSchema = z.object({
  owners: z.array(idSchema).max(100), visibility: visibilitySchema,
  permissions: z.object({ initiative: z.array(idSchema).max(100), damage: z.array(idSchema).max(100), heal: z.array(idSchema).max(100), adjustCurrentHp: z.array(idSchema).max(100), adjustMaximumHp: z.array(idSchema).max(100), conditions: z.array(idSchema).max(100), endTurn: z.array(idSchema).max(100) }),
});
function refineCombatant<T extends z.ZodObject>(schema: T, bounded = false) {
  return schema.superRefine((combatant, context) => {
    const value = combatant as { currentHp: number; maximumHp: number; markers: Array<{ id: string; hp?: boolean; kind: string }> };
    if (bounded && value.currentHp > value.maximumHp) context.addIssue({ code: "custom", message: "HP atual não pode exceder o máximo." });
    if (value.markers.filter((marker) => marker.hp).length !== 1 || value.markers.some((marker) => marker.hp && marker.kind !== "bar")) context.addIssue({ code: "custom", message: "É necessária exatamente uma barra de HP." });
    if (new Set(value.markers.map((marker) => marker.id)).size !== value.markers.length) context.addIssue({ code: "custom", message: "IDs de marcadores repetidos." });
  });
}
const oldCombatantBase = legacyCombatantSchema.extend({ settings: legacySettingsSchema, markers: z.array(markerSchema).min(1).max(12), initiative: z.number().finite().nullable() });
const v2CombatantSchema = refineCombatant(oldCombatantBase, true);
const v3CombatantSchema = refineCombatant(oldCombatantBase.extend({ currentHp: hpV3Schema }));
const v4CombatantSchema = refineCombatant(legacyCombatantSchema.extend({ currentHp: hpV3Schema, settings: settingsSchema, markers: z.array(markerSchema).min(1).max(12), initiative: z.number().finite().nullable() }));
const v5CombatantSchema = refineCombatant(z.object({ tokenId: idSchema, currentHp: hpV3Schema, maximumHp: z.number().int().min(1).max(HP_LIMIT), reductions: z.array(v5DamageReductionSchema).max(24), conditions: z.array(appliedConditionSchema).max(50), settings: settingsSchema, markers: z.array(markerSchema).min(1).max(12), initiative: z.number().finite().nullable() }));
export const combatantSchema = refineCombatant(z.object({ tokenId: idSchema, currentHp: hpV3Schema, maximumHp: z.number().int().min(1).max(HP_LIMIT), reductions: z.array(damageReductionSchema).max(24), conditions: z.array(appliedConditionSchema).max(50), settings: settingsSchema, markers: z.array(markerSchema).min(1).max(12), initiative: z.number().finite().nullable() }));
const encounterSchema = z.object({ order: z.array(idSchema).max(50), round: z.number().int().min(0), started: z.boolean(), paused: z.boolean() });
const templateSchema = z.object({ id: idSchema, name: z.string().min(1).max(60), markers: z.array(markerSchema).min(1).max(12) });
const damageTypeSchema = z.object({ id: idSchema, name: z.string().min(1).max(60), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), description: z.string().max(240).optional() });
const v5DefensePresetSchema = z.object({ id: idSchema, name: z.string().min(1).max(60), amount: z.number().int().min(0).max(RD_LIMIT), damageTypeIds: damageTypeIdsSchema });
const defensePresetSchema = z.object({ id: idSchema, name: z.string().min(1).max(60), kind: z.enum(["REDUCTION", "IMMUNITY"]), amount: z.number().int().min(0).max(RD_LIMIT), damageTypeIds: damageTypeIdsSchema })
  .refine((preset) => preset.kind === "REDUCTION" || preset.amount === 0, { message: "Imunidades não possuem valor de RD.", path: ["amount"] });

function makeSnapshot(combatant: z.ZodType, definition: z.ZodType = oldConditionDefinitionSchema, libraries = false, preset: z.ZodType = defensePresetSchema) {
  return z.object({ combatants: z.record(z.string(), combatant), conditionDefinitions: z.array(definition).max(25), activeTokenId: idSchema.optional(), encounter: encounterSchema, templates: z.array(templateSchema).max(25),
    ...(libraries ? { damageTypes: z.array(damageTypeSchema).max(50), defensePresets: z.array(preset).max(50) } : {}),
  });
}
function makeState(version: 2 | 3 | 4 | 5 | 6, combatant: z.ZodType, definition: z.ZodType = oldConditionDefinitionSchema, libraries = false, preset: z.ZodType = defensePresetSchema) {
  const snapshot = makeSnapshot(combatant, definition, libraries, preset);
  return snapshot.extend({
    schemaVersion: z.literal(version), sceneId: idSchema, revision: z.number().int().min(0), history: z.array(historyEntrySchema).max(50), receipts: z.array(idSchema).max(100),
    undo: z.object({ historyId: idSchema, snapshot: snapshot.optional(), combatants: z.record(z.string(), z.union([combatant, z.null()])).optional(), conditionDefinitions: z.array(definition).max(25).optional(),
      ...(libraries ? { damageTypes: z.array(damageTypeSchema).max(50).optional(), defensePresets: z.array(preset).max(50).optional() } : {}),
      activeTokenId: z.union([idSchema, z.null()]).optional() }).optional(),
  }).superRefine((state, context) => {
    const ids = Object.keys(state.combatants);
    if (ids.length > 50) context.addIssue({ code: "custom", message: "A cena excede 50 combatentes." });
    for (const [key, value] of Object.entries(state.combatants)) if (key !== (value as { tokenId: string }).tokenId) context.addIssue({ code: "custom", message: "O ID do combatente não corresponde à sua chave." });
    if (state.encounter.order.length !== ids.length || new Set(state.encounter.order).size !== ids.length || state.encounter.order.some((id) => !state.combatants[id])) context.addIssue({ code: "custom", message: "A ordem precisa conter cada combatente exatamente uma vez." });
    if (state.activeTokenId && !state.combatants[state.activeTokenId]) context.addIssue({ code: "custom", message: "Combatente ativo inválido." });
  });
}
const v2SceneStateSchema = makeState(2, v2CombatantSchema);
const v3SceneStateSchema = makeState(3, v3CombatantSchema);
const v4SceneStateSchema = makeState(4, v4CombatantSchema);
const v5SceneStateSchema = makeState(5, v5CombatantSchema, v5ConditionDefinitionSchema, true, v5DefensePresetSchema);
const v6SceneStateBaseSchema = makeState(6, combatantSchema, conditionDefinitionSchema, true, defensePresetSchema) as z.ZodType<RulebearSceneState>;
export const rulebearSceneStateSchema = v6SceneStateBaseSchema.superRefine((state, context) => {
  const typeIds = new Set(state.damageTypes.map((type) => type.id));
  if (typeIds.size !== state.damageTypes.length) context.addIssue({ code: "custom", message: "IDs de tipos de dano repetidos.", path: ["damageTypes"] });
  if (new Set(state.damageTypes.map((type) => normalizedDefinitionName(type.name))).size !== state.damageTypes.length) context.addIssue({ code: "custom", message: "Nomes de tipos de dano repetidos.", path: ["damageTypes"] });
  if (new Set(state.defensePresets.map((preset) => preset.id)).size !== state.defensePresets.length) context.addIssue({ code: "custom", message: "IDs de presets repetidos.", path: ["defensePresets"] });
  if (new Set(state.defensePresets.map((preset) => normalizedDefinitionName(preset.name))).size !== state.defensePresets.length) context.addIssue({ code: "custom", message: "Nomes de presets repetidos.", path: ["defensePresets"] });
  const referenced = [
    ...Object.values(state.combatants).flatMap((combatant) => combatant.reductions.flatMap((defense) => defense.damageTypeIds)),
    ...state.conditionDefinitions.flatMap((condition) => condition.effects.flatMap((effect) => effect.damageTypeIds)),
    ...state.defensePresets.flatMap((preset) => preset.damageTypeIds),
  ];
  if (referenced.some((id) => !typeIds.has(id))) context.addIssue({ code: "custom", message: "Há referências a tipos de dano inexistentes.", path: ["damageTypes"] });
});

export function createEmptyState(): RulebearSceneState {
  return { schemaVersion: 6, sceneId: crypto.randomUUID(), revision: 0, combatants: {}, conditionDefinitions: [], damageTypes: defaultDamageTypes(), defensePresets: [], history: [], encounter: { order: [], round: 0, started: false, paused: false }, templates: [], receipts: [] };
}
export function parseSceneState(value: unknown): RulebearSceneState { return rulebearSceneStateSchema.parse(value) as RulebearSceneState; }
export function isMigratableState(value: unknown): boolean {
  if (!value || typeof value !== "object" || !("schemaVersion" in value)) return false;
  return [1, 2, 3, 4, 5].includes(Number(value.schemaVersion));
}

type BooleanCombatant = z.infer<typeof v3CombatantSchema>;
type ListCombatant = z.infer<typeof v4CombatantSchema>;
type OldConditionDefinition = z.infer<typeof oldConditionDefinitionSchema>;
type V5Combatant = z.infer<typeof v5CombatantSchema>;
type V5ConditionDefinition = z.infer<typeof v5ConditionDefinitionSchema>;
type V5Snapshot = {
  combatants: Record<string, V5Combatant>; conditionDefinitions: V5ConditionDefinition[]; activeTokenId?: string;
  encounter: z.infer<typeof encounterSchema>; templates: z.infer<typeof templateSchema>[]; damageTypes: DamageTypeDefinition[];
  defensePresets: Array<{ id: string; name: string; amount: number; damageTypeIds: string[] }>;
};
type OldSnapshot = { combatants: Record<string, BooleanCombatant | ListCombatant>; conditionDefinitions: OldConditionDefinition[]; activeTokenId?: string; encounter: z.infer<typeof encounterSchema>; templates: z.infer<typeof templateSchema>[] };
type OldState = OldSnapshot & { schemaVersion: 2 | 3 | 4; sceneId: string; revision: number; history: z.infer<typeof historyEntrySchema>[]; receipts: string[]; undo?: { historyId: string; snapshot?: OldSnapshot; combatants?: Record<string, BooleanCombatant | ListCombatant | null>; conditionDefinitions?: OldConditionDefinition[]; activeTokenId?: string | null } };
type V5Undo = {
  historyId: string; snapshot?: V5Snapshot; combatants?: Record<string, V5Combatant | null>; conditionDefinitions?: V5ConditionDefinition[];
  damageTypes?: DamageTypeDefinition[]; defensePresets?: V5Snapshot["defensePresets"]; activeTokenId?: string | null;
};
type V5State = V5Snapshot & {
  schemaVersion: 5; sceneId: string; revision: number; history: z.infer<typeof historyEntrySchema>[]; receipts: string[]; undo?: V5Undo;
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
    types.push(definition); byName.set(key, definition.id); return definition.id;
  }))];
  return { types, resolve };
}
type Resolver = ReturnType<typeof createDamageTypeResolver>;

function migrateDefinitionToV5(definition: OldConditionDefinition, resolver: Resolver): V5ConditionDefinition {
  return { ...structuredClone(definition), effects: definition.effects.map(({ categories, ...effect }) => ({ ...effect, damageTypeIds: resolver.resolve(categories) })) };
}
function migrateCombatantToV5(combatant: BooleanCombatant | ListCombatant, resolver: Resolver): V5Combatant {
  return { ...structuredClone(combatant), settings: migrateSettings(combatant), reductions: combatant.reductions.map(({ categories, ...reduction }) => ({ ...reduction, damageTypeIds: resolver.resolve(categories) })) } as V5Combatant;
}
function migrateCombatantsToV5(combatants: Record<string, BooleanCombatant | ListCombatant>, resolver: Resolver): Record<string, V5Combatant> {
  return Object.fromEntries(Object.entries(combatants).map(([id, combatant]) => [id, migrateCombatantToV5(combatant, resolver)]));
}
function migrateOldSnapshotToV5(snapshot: OldSnapshot, resolver: Resolver): V5Snapshot {
  return { combatants: migrateCombatantsToV5(snapshot.combatants, resolver), conditionDefinitions: snapshot.conditionDefinitions.map((definition) => migrateDefinitionToV5(definition, resolver)), ...(snapshot.activeTokenId ? { activeTokenId: snapshot.activeTokenId } : {}), encounter: structuredClone(snapshot.encounter), templates: structuredClone(snapshot.templates), damageTypes: resolver.types, defensePresets: [] };
}

function upgradeV5Definition(definition: V5ConditionDefinition): ConditionDefinition {
  return { ...structuredClone(definition), effects: definition.effects.map(({ bypassReductions, ...effect }) => ({ ...effect, ignoreImmunity: effect.kind === "DAMAGE" && bypassReductions })) };
}
function upgradeV5Combatant(combatant: V5Combatant): CombatantState {
  return { ...structuredClone(combatant), reductions: combatant.reductions.map((defense) => ({ ...defense, kind: "REDUCTION" as const })) };
}
function upgradeV5Snapshot(snapshot: V5Snapshot) {
  return {
    combatants: Object.fromEntries(Object.entries(snapshot.combatants).map(([id, combatant]) => [id, upgradeV5Combatant(combatant)])),
    conditionDefinitions: snapshot.conditionDefinitions.map(upgradeV5Definition), ...(snapshot.activeTokenId ? { activeTokenId: snapshot.activeTokenId } : {}),
    encounter: structuredClone(snapshot.encounter), templates: structuredClone(snapshot.templates), damageTypes: structuredClone(snapshot.damageTypes),
    defensePresets: snapshot.defensePresets.map((preset) => ({ ...preset, kind: "REDUCTION" as const })),
  };
}
function upgradeV5State(previous: V5State): RulebearSceneState {
  const migrated = upgradeV5Snapshot(previous as unknown as V5Snapshot);
  const undo = previous.undo ? {
    historyId: previous.undo.historyId,
    ...(previous.undo.snapshot ? { snapshot: upgradeV5Snapshot(previous.undo.snapshot as unknown as V5Snapshot) } : {}),
    ...(previous.undo.combatants ? { combatants: Object.fromEntries(Object.entries(previous.undo.combatants).map(([id, combatant]) => [id, combatant ? upgradeV5Combatant(combatant) : null])) } : {}),
    ...(previous.undo.conditionDefinitions ? { conditionDefinitions: previous.undo.conditionDefinitions.map(upgradeV5Definition) } : {}),
    ...(previous.undo.damageTypes ? { damageTypes: structuredClone(previous.undo.damageTypes) } : {}),
    ...(previous.undo.defensePresets ? { defensePresets: previous.undo.defensePresets.map((preset) => ({ ...preset, kind: "REDUCTION" as const })) } : {}),
    ...(previous.undo.activeTokenId !== undefined ? { activeTokenId: previous.undo.activeTokenId } : {}),
  } : undefined;
  return parseSceneState({ ...migrated, schemaVersion: 6, sceneId: previous.sceneId, revision: previous.revision + 1, history: previous.history, receipts: previous.receipts, ...(undo ? { undo } : {}) });
}

/** The coordinator saves a recoverable backup before writing a v1-v5 conversion. */
export function migrateSceneState(value: unknown): RulebearSceneState {
  if (value && typeof value === "object" && "schemaVersion" in value && value.schemaVersion === 5) return upgradeV5State(v5SceneStateSchema.parse(value) as unknown as V5State);
  const resolver = createDamageTypeResolver();
  if (value && typeof value === "object" && "schemaVersion" in value && (value.schemaVersion === 2 || value.schemaVersion === 3 || value.schemaVersion === 4)) {
    const parsed = (value.schemaVersion === 2 ? v2SceneStateSchema : value.schemaVersion === 3 ? v3SceneStateSchema : v4SceneStateSchema).parse(value);
    const previous = parsed as unknown as OldState;
    const migrated = migrateOldSnapshotToV5(previous, resolver);
    const undo = previous.undo ? {
      historyId: previous.undo.historyId,
      ...(previous.undo.snapshot ? { snapshot: migrateOldSnapshotToV5(previous.undo.snapshot, resolver) } : {}),
      ...(previous.undo.combatants ? { combatants: Object.fromEntries(Object.entries(previous.undo.combatants).map(([id, combatant]) => [id, combatant ? migrateCombatantToV5(combatant, resolver) : null])) } : {}),
      ...(previous.undo.conditionDefinitions ? { conditionDefinitions: previous.undo.conditionDefinitions.map((definition) => migrateDefinitionToV5(definition, resolver)) } : {}),
      ...(previous.undo.activeTokenId !== undefined ? { activeTokenId: previous.undo.activeTokenId } : {}), damageTypes: resolver.types, defensePresets: [],
    } : undefined;
    if (resolver.types.length > 50) throw new Error("A migração encontrou mais de 50 tipos de dano distintos.");
    return upgradeV5State(v5SceneStateSchema.parse({ ...migrated, schemaVersion: 5, sceneId: previous.sceneId, revision: previous.revision, history: previous.history, receipts: previous.receipts, ...(undo ? { undo } : {}) }) as unknown as V5State);
  }
  const legacy = legacySceneStateSchema.parse(value);
  const wrap = (combatant: z.infer<typeof legacyCombatantSchema>): ListCombatant => ({ ...combatant, settings: defaultSettings(), markers: [defaultMarker(true)], initiative: null });
  const combatants = Object.fromEntries(Object.entries(legacy.combatants).map(([id, combatant]) => [id, migrateCombatantToV5(wrap(combatant), resolver)]));
  const definitions = legacy.conditionDefinitions.map((definition) => migrateDefinitionToV5(definition, resolver));
  if (resolver.types.length > 50) throw new Error("A migração encontrou mais de 50 tipos de dano distintos.");
  const rawV5 = {
    schemaVersion: 5, sceneId: crypto.randomUUID(), revision: legacy.revision, combatants, conditionDefinitions: definitions, damageTypes: resolver.types, defensePresets: [], history: legacy.history, receipts: [], templates: [],
    encounter: { order: Object.keys(combatants), round: legacy.activeTokenId ? 1 : 0, started: !!legacy.activeTokenId, paused: false }, ...(legacy.activeTokenId ? { activeTokenId: legacy.activeTokenId } : {}),
    ...(legacy.undo ? { undo: { historyId: legacy.undo.historyId, ...(legacy.undo.combatants ? { combatants: Object.fromEntries(Object.entries(legacy.undo.combatants).map(([id, combatant]) => [id, combatant ? migrateCombatantToV5(wrap(combatant), resolver) : null])) } : {}), ...(legacy.undo.conditionDefinitions ? { conditionDefinitions: legacy.undo.conditionDefinitions.map((definition) => migrateDefinitionToV5(definition, resolver)) } : {}), ...(legacy.undo.activeTokenId !== undefined ? { activeTokenId: legacy.undo.activeTokenId } : {}), damageTypes: resolver.types, defensePresets: [] } } : {}),
  };
  return upgradeV5State(v5SceneStateSchema.parse(rawV5) as unknown as V5State);
}
export const isLegacyState = isMigratableState;
export const migrateLegacyState = migrateSceneState;
