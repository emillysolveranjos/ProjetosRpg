import { z } from "zod";
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

export const combatantSchema = z.object({
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
    "TURN_START", "TURN_END",
  ]),
  summary: z.string().min(1).max(240),
  tokenId: idSchema.optional(),
  amount: z.number().int().optional(),
  undoneAt: z.iso.datetime().optional(),
});

const nullableCombatantSchema = z.union([combatantSchema, z.null()]);
const undoRecordSchema = z.object({
  historyId: idSchema,
  combatants: z.record(z.string(), nullableCombatantSchema).optional(),
  conditionDefinitions: z.array(conditionDefinitionSchema).max(25).optional(),
  activeTokenId: z.union([idSchema, z.null()]).optional(),
});

export const rulebearSceneStateSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().min(0),
  combatants: z.record(z.string(), combatantSchema),
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

export function createEmptyState(): RulebearSceneState {
  return { schemaVersion: 1, revision: 0, combatants: {}, conditionDefinitions: [], history: [] };
}

export function parseSceneState(value: unknown): RulebearSceneState {
  return rulebearSceneStateSchema.parse(value);
}
