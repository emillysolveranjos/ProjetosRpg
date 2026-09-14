import { defaultMarker, defaultSettings, normalizedDefinitionName } from "./defaults";
import { MAX_COMBATANTS, MAX_DEFINITIONS, MAX_HISTORY } from "../config";
import { evaluateExpression, parseDice, type DieRoller } from "./dice";
import { damageComponentSchema } from "../state/schema";
import type {
  AppliedCondition,
  CombatantState,
  ConditionDefinition,
  DamageComponent,
  DamageComponentResult,
  DamageTypeDefinition,
  DamageReduction,
  DamageResult,
  DefensePreset,
  HistoryEntry,
  HistoryKind,
  RulebearSceneState,
  Trigger,
  TriggerResult,
  UndoRecord,
} from "./types";

const clone = <T,>(value: T): T => structuredClone(value);
const newId = (): string => crypto.randomUUID();
export const HP_LIMIT = 2_147_483_647;
export function assertHpValue(value: number, label = "HP atual"): void {
  if (!Number.isSafeInteger(value) || value < -HP_LIMIT || value > HP_LIMIT) {
    throw new Error(`${label} deve ser um inteiro entre -${HP_LIMIT} e ${HP_LIMIT}.`);
  }
}
export function assertMaximumHp(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > HP_LIMIT) {
    throw new Error(`O HP máximo deve ser um inteiro entre 1 e ${HP_LIMIT}.`);
  }
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

function validateDamageTypeIds(state: RulebearSceneState, ids: string[]): string[] {
  const unique = uniqueIds(ids);
  if (unique.length > 12) throw new Error("Selecione no máximo 12 tipos de dano.");
  if (unique.some((id) => !state.damageTypes.some((type) => type.id === id))) throw new Error("Um tipo de dano selecionado não existe mais.");
  return unique;
}

function getCombatant(state: RulebearSceneState, tokenId: string): CombatantState {
  const combatant = state.combatants[tokenId];
  if (!combatant) throw new Error("Este token não faz parte do encontro.");
  return combatant;
}

function commit(
  state: RulebearSceneState,
  kind: HistoryKind,
  summary: string,
  undo: Omit<UndoRecord, "historyId">,
  tokenId?: string,
  amount?: number,
): RulebearSceneState {
  const historyId = newId();
  const entry: HistoryEntry = {
    id: historyId,
    occurredAt: new Date().toISOString(),
    kind,
    summary,
    ...(tokenId ? { tokenId } : {}),
    ...(amount !== undefined ? { amount } : {}),
  };
  state.revision += 1;
  state.history = [...state.history, entry].slice(-MAX_HISTORY);
  state.undo = { historyId, ...undo };
  return state;
}

function combatantUndo(tokenId: string, combatant: CombatantState | null): Omit<UndoRecord, "historyId"> {
  return { combatants: { [tokenId]: combatant ? clone(combatant) : null } };
}

export function addCombatant(
  current: RulebearSceneState,
  tokenId: string,
  currentHp: number,
  maximumHp: number,
): RulebearSceneState {
  if (!tokenId) throw new Error("Token inválido.");
  if (current.combatants[tokenId]) throw new Error("Este token já está na Rulebear.");
  if (Object.keys(current.combatants).length >= MAX_COMBATANTS) throw new Error(`A cena aceita no máximo ${MAX_COMBATANTS} combatentes.`);
  assertMaximumHp(maximumHp);
  assertHpValue(currentHp);

  const state = clone(current);
  state.combatants[tokenId] = { tokenId, currentHp, maximumHp, reductions: [], conditions: [], settings: defaultSettings(), markers: [defaultMarker(true)], initiative: null };
  state.encounter.order.push(tokenId);
  return commit(state, "COMBATANT_ADDED", "Combatente adicionado", combatantUndo(tokenId, null), tokenId);
}

export function removeCombatant(current: RulebearSceneState, tokenId: string): RulebearSceneState {
  const before = clone(getCombatant(current, tokenId));
  const state = clone(current);
  delete state.combatants[tokenId];
  state.encounter.order = state.encounter.order.filter((id) => id !== tokenId);
  if (state.activeTokenId === tokenId) state.encounter.paused = true;
  if (state.activeTokenId === tokenId) delete state.activeTokenId;
  return commit(
    state,
    "COMBATANT_REMOVED",
    "Combatente removido",
    { ...combatantUndo(tokenId, before), activeTokenId: current.activeTokenId ?? null },
    tokenId,
  );
}

export function resolveDamage(
  combatant: CombatantState,
  expression: string,
  damageTypeIds: string[],
  ignoreImmunity: boolean,
  multiplier = 1,
  rollDie?: DieRoller,
): DamageResult {
  const component = resolveDamageComponent(combatant, {
    expression,
    damageTypeIds,
    ignoreImmunity,
  }, multiplier, rollDie);
  return aggregateDamage(combatant.currentHp, [component]);
}

function defenseMatches(damageTypeIds: string[], defenseTypeIds: string[]): boolean {
  return defenseTypeIds.length === 0 || damageTypeIds.some((typeId) => defenseTypeIds.includes(typeId));
}

function immunityCovers(combatant: CombatantState, damageTypeIds: string[]): boolean {
  const immunities = combatant.reductions.filter((defense) => defense.kind === "IMMUNITY");
  if (immunities.some((defense) => defense.damageTypeIds.length === 0)) return true;
  if (damageTypeIds.length === 0) return false;
  const covered = new Set(immunities.flatMap((defense) => defense.damageTypeIds));
  return damageTypeIds.every((typeId) => covered.has(typeId));
}

function validatePenetration(expression: string | undefined) {
  if (!expression?.trim()) return;
  const value = expression.trim();
  if (/^\d+$/.test(value)) {
    if (!Number.isSafeInteger(Number(value)) || Number(value) > 1_000_000) throw new Error("RD ignorada fora do limite.");
  } else {
    try { parseDice(value); }
    catch (error) { throw new Error("RD ignorada inválida. Use um número ou dados como 1d6+2.", { cause: error }); }
  }
}

function resolvePenetration(expression: string | undefined, rollDie?: DieRoller): { amount: number; rolls: number[] } {
  if (!expression?.trim()) return { amount: 0, rolls: [] };
  if (expression.trim() === "0") return { amount: 0, rolls: [] };
  let rolled: ReturnType<typeof evaluateExpression>;
  try { rolled = evaluateExpression(expression, rollDie); }
  catch (error) { throw new Error(`RD ignorada inválida: ${error instanceof Error ? error.message : "expressão inválida."}`, { cause: error }); }
  if (!Number.isSafeInteger(rolled.total) || rolled.total < 0 || rolled.total > 1_000_000) {
    throw new Error("A RD ignorada precisa resultar em um inteiro entre 0 e 1.000.000.");
  }
  return { amount: rolled.total, rolls: rolled.rolls };
}

export function resolveDamageComponent(
  combatant: CombatantState,
  component: DamageComponent,
  multiplier = 1,
  rollDie?: DieRoller,
): DamageComponentResult {
  if (!Number.isInteger(multiplier) || multiplier < 1 || multiplier > 99) throw new Error("Multiplicador inválido.");
  const rolled = evaluateExpression(component.expression, rollDie);
  const rawAmount = rolled.total * multiplier;
  if (!Number.isSafeInteger(rawAmount) || rawAmount <= 0) throw new Error("O dano precisa resultar em um valor positivo.");
  const selected = uniqueIds(component.damageTypeIds);
  const blockedByImmunity = !component.ignoreImmunity && immunityCovers(combatant, selected);
  const penetration = resolvePenetration(component.ignoreReductionExpression, rollDie);
  const availableReduction = blockedByImmunity ? 0 : combatant.reductions
    .filter((defense) => defense.kind === "REDUCTION" && defenseMatches(selected, defense.damageTypeIds))
    .reduce((total, defense) => total + defense.amount, 0);
  const ignoredReduction = Math.min(availableReduction, penetration.amount);
  const effectiveReduction = Math.max(0, availableReduction - penetration.amount);
  const reducedBy = blockedByImmunity ? 0 : Math.min(rawAmount, effectiveReduction);
  const finalAmount = blockedByImmunity ? 0 : Math.max(0, rawAmount - effectiveReduction);
  return {
    ...component,
    expression: rolled.expression,
    rolls: rolled.rolls,
    baseAmount: rolled.total,
    rawAmount,
    penetrationRolls: penetration.rolls,
    penetrationAmount: penetration.amount,
    availableReduction,
    ignoredReduction,
    reducedBy,
    blockedByImmunity,
    finalAmount,
  };
}

function aggregateDamage(hpBefore: number, components: DamageComponentResult[]): DamageResult {
  const rawAmount = components.reduce((total, component) => total + component.rawAmount, 0);
  const finalAmount = components.reduce((total, component) => total + component.finalAmount, 0);
  return {
    expression: components.map((component) => component.expression).join(" + "),
    rolls: components.flatMap((component) => component.rolls),
    baseAmount: components.reduce((total, component) => total + component.baseAmount, 0),
    rawAmount,
    reducedBy: components.reduce((total, component) => total + component.reducedBy, 0),
    ignoredReduction: components.reduce((total, component) => total + component.ignoredReduction, 0),
    blockedByImmunity: components.some((component) => component.blockedByImmunity),
    finalAmount,
    hpBefore,
    hpAfter: hpBefore - finalAmount,
    components,
  };
}

export function applyDamageComponents(
  current: RulebearSceneState,
  tokenId: string,
  components: DamageComponent[],
  multiplier = 1,
  rollDie?: DieRoller,
): { state: RulebearSceneState; result: DamageResult } {
  if (!components.length || components.length > 12) throw new Error("Informe entre 1 e 12 componentes de dano.");
  const before = clone(getCombatant(current, tokenId));
  const validated = components.map((input) => {
    const component = damageComponentSchema.parse(input);
    validatePenetration(component.ignoreReductionExpression);
    return ({
    expression: component.expression,
    damageTypeIds: validateDamageTypeIds(current, component.damageTypeIds),
    ignoreImmunity: component.ignoreImmunity,
    ...(component.ignoreReductionExpression?.trim() ? { ignoreReductionExpression: component.ignoreReductionExpression.trim() } : {}),
    });
  });
  const resolved = validated.map((component) => resolveDamageComponent(before, component, multiplier, rollDie));
  const result = aggregateDamage(before.currentHp, resolved);
  assertHpValue(result.hpAfter);
  const state = clone(current);
  getCombatant(state, tokenId).currentHp = result.hpAfter;
  const details = [
    result.reducedBy ? `${result.reducedBy} reduzido` : "",
    result.ignoredReduction ? `${result.ignoredReduction} RD ignorada` : "",
    result.components.some((component) => component.blockedByImmunity) ? "componente imune" : "",
  ].filter(Boolean).join(" · ");
  const next = commit(state, "DAMAGE", `${result.finalAmount} de dano${details ? ` · ${details}` : ""}`, combatantUndo(tokenId, before), tokenId, result.finalAmount);
  next.history.at(-1)!.damageDetails = resolved.map((component) => damageHistory(current, tokenId, component));
  return { state: next, result };
}

function damageHistory(state: RulebearSceneState, tokenId: string, component: DamageComponentResult, source?: string) {
  return { tokenId, ...(source ? { source } : {}), types: component.damageTypeIds.map((id) => state.damageTypes.find((type) => type.id === id)?.name ?? "Tipo"), raw: component.rawAmount, rd: component.availableReduction, penetration: component.penetrationAmount, immune: component.blockedByImmunity, ignoreImmunity: component.ignoreImmunity, final: component.finalAmount };
}

export function applyDamage(
  current: RulebearSceneState,
  tokenId: string,
  expression: string,
  damageTypeIds: string[] = [],
  ignoreImmunity = false,
  multiplier = 1,
  rollDie?: DieRoller,
): { state: RulebearSceneState; result: DamageResult } {
  return applyDamageComponents(current, tokenId, [{ expression, damageTypeIds, ignoreImmunity }], multiplier, rollDie);
}

export function applyHealing(
  current: RulebearSceneState,
  tokenId: string,
  amount: number,
): { state: RulebearSceneState; recovered: number } {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("A cura deve ser um inteiro positivo.");
  const before = clone(getCombatant(current, tokenId));
  const recovered = before.currentHp >= before.maximumHp ? 0 : Math.min(amount, before.maximumHp - before.currentHp);
  if (recovered === 0) return { state: current, recovered: 0 };
  const state = clone(current);
  getCombatant(state, tokenId).currentHp += recovered;
  return {
    state: commit(state, "HEAL", `${recovered} de cura`, combatantUndo(tokenId, before), tokenId, recovered),
    recovered,
  };
}

export function setReductions(
  current: RulebearSceneState,
  tokenId: string,
  reductions: DamageReduction[],
): RulebearSceneState {
  if (reductions.length > 24) throw new Error("Um combatente aceita no máximo 24 reduções.");
  for (const reduction of reductions) {
    if (!reduction.label.trim() || !["REDUCTION", "IMMUNITY"].includes(reduction.kind)) throw new Error("Defesa inválida.");
    if (!Number.isInteger(reduction.amount) || reduction.amount < 0 || reduction.amount > 1_000_000 || (reduction.kind === "IMMUNITY" && reduction.amount !== 0)) throw new Error("Redução inválida.");
    validateDamageTypeIds(current, reduction.damageTypeIds);
  }
  const before = clone(getCombatant(current, tokenId));
  const state = clone(current);
  getCombatant(state, tokenId).reductions = reductions.map((reduction) => ({
    ...reduction,
    label: reduction.label.trim(),
    amount: reduction.kind === "IMMUNITY" ? 0 : reduction.amount,
    damageTypeIds: uniqueIds(reduction.damageTypeIds),
  }));
  return commit(state, "REDUCTION_CHANGED", "Reduções atualizadas", combatantUndo(tokenId, before), tokenId);
}

function cleanLibraryName(value: string, label: string): string {
  const name = value.trim();
  if (!name || name.length > 60) throw new Error(`${label} deve ter entre 1 e 60 caracteres.`);
  return name;
}

function assertUniqueLibraryName<T extends { id: string; name: string }>(items: T[], candidate: T, label: string): void {
  const normalized = normalizedDefinitionName(candidate.name);
  if (items.some((item) => item.id !== candidate.id && normalizedDefinitionName(item.name) === normalized)) {
    throw new Error(`Já existe ${label} com esse nome.`);
  }
}

export function saveDamageType(current: RulebearSceneState, definition: DamageTypeDefinition): RulebearSceneState {
  const index = current.damageTypes.findIndex((item) => item.id === definition.id);
  if (index < 0 && current.damageTypes.length >= 50) throw new Error("A cena aceita no máximo 50 tipos de dano.");
  const cleaned: DamageTypeDefinition = {
    id: definition.id || newId(),
    name: cleanLibraryName(definition.name, "O nome do tipo de dano"),
    color: definition.color,
    ...(definition.description?.trim() ? { description: definition.description.trim() } : {}),
  };
  if (!/^#[0-9a-fA-F]{6}$/.test(cleaned.color)) throw new Error("Escolha uma cor válida para o tipo de dano.");
  if ((cleaned.description?.length ?? 0) > 240) throw new Error("A descrição deve ter no máximo 240 caracteres.");
  assertUniqueLibraryName(current.damageTypes, cleaned, "um tipo de dano");
  const state = clone(current);
  if (index >= 0) state.damageTypes[index] = cleaned;
  else state.damageTypes.push(cleaned);
  return commit(state, "LIBRARY_CHANGED", index >= 0 ? `Tipo “${cleaned.name}” atualizado` : `Tipo “${cleaned.name}” criado`, {
    damageTypes: clone(current.damageTypes),
  });
}

export function damageTypeUsage(current: RulebearSceneState, damageTypeId: string): { defenses: number; conditions: number; presets: number } {
  return {
    defenses: Object.values(current.combatants).reduce((total, combatant) => total + combatant.reductions.filter((item) => item.damageTypeIds.includes(damageTypeId)).length, 0),
    conditions: current.conditionDefinitions.reduce((total, condition) => total + condition.effects.filter((effect) => effect.damageTypeIds.includes(damageTypeId)).length, 0),
    presets: current.defensePresets.filter((preset) => preset.damageTypeIds.includes(damageTypeId)).length,
  };
}

export function deleteDamageType(current: RulebearSceneState, damageTypeId: string): RulebearSceneState {
  const definition = current.damageTypes.find((item) => item.id === damageTypeId);
  if (!definition) throw new Error("Tipo de dano não encontrado.");
  const usage = damageTypeUsage(current, damageTypeId);
  const references = [
    usage.presets ? `${usage.presets} preset(s)` : "",
    usage.defenses ? `${usage.defenses} defesa(s) de token` : "",
    usage.conditions ? `${usage.conditions} efeito(s) de condição` : "",
  ].filter(Boolean);
  if (references.length) throw new Error(`“${definition.name}” ainda é usado em ${references.join(", ")}. Remova essas referências antes de excluir.`);
  const state = clone(current);
  state.damageTypes = state.damageTypes.filter((item) => item.id !== damageTypeId);
  return commit(state, "LIBRARY_CHANGED", `Tipo “${definition.name}” excluído`, { damageTypes: clone(current.damageTypes) });
}

export function saveDefensePreset(current: RulebearSceneState, preset: DefensePreset): RulebearSceneState {
  const index = current.defensePresets.findIndex((item) => item.id === preset.id);
  if (index < 0 && current.defensePresets.length >= 50) throw new Error("A cena aceita no máximo 50 presets de defesa.");
  const cleaned: DefensePreset = {
    id: preset.id || newId(),
    name: cleanLibraryName(preset.name, "O nome do preset"),
    kind: preset.kind,
    amount: preset.kind === "IMMUNITY" ? 0 : preset.amount,
    damageTypeIds: validateDamageTypeIds(current, preset.damageTypeIds),
  };
  if (!["REDUCTION", "IMMUNITY"].includes(cleaned.kind)) throw new Error("Escolha redução fixa ou imunidade.");
  if (!Number.isInteger(cleaned.amount) || cleaned.amount < 0 || cleaned.amount > 1_000_000) throw new Error("A redução deve ser um inteiro entre 0 e 1.000.000.");
  assertUniqueLibraryName(current.defensePresets, cleaned, "um preset de defesa");
  const state = clone(current);
  if (index >= 0) state.defensePresets[index] = cleaned;
  else state.defensePresets.push(cleaned);
  return commit(state, "LIBRARY_CHANGED", index >= 0 ? `Preset “${cleaned.name}” atualizado` : `Preset “${cleaned.name}” criado`, {
    defensePresets: clone(current.defensePresets),
  });
}

export function deleteDefensePreset(current: RulebearSceneState, presetId: string): RulebearSceneState {
  const preset = current.defensePresets.find((item) => item.id === presetId);
  if (!preset) throw new Error("Preset de defesa não encontrado.");
  const state = clone(current);
  state.defensePresets = state.defensePresets.filter((item) => item.id !== presetId);
  return commit(state, "LIBRARY_CHANGED", `Preset “${preset.name}” excluído`, { defensePresets: clone(current.defensePresets) });
}

export function applyDefensePreset(current: RulebearSceneState, tokenId: string, presetId: string): RulebearSceneState {
  const preset = current.defensePresets.find((item) => item.id === presetId);
  if (!preset) throw new Error("Preset de defesa não encontrado.");
  const combatant = getCombatant(current, tokenId);
  return setReductions(current, tokenId, [...combatant.reductions, {
    id: newId(),
    label: preset.name,
    kind: preset.kind,
    amount: preset.amount,
    damageTypeIds: [...preset.damageTypeIds],
  }]);
}

export function saveConditionDefinition(
  current: RulebearSceneState,
  definition: ConditionDefinition,
): RulebearSceneState {
  const index = current.conditionDefinitions.findIndex((item) => item.id === definition.id);
  if (index < 0 && current.conditionDefinitions.length >= MAX_DEFINITIONS) throw new Error(`A cena aceita no máximo ${MAX_DEFINITIONS} condições.`);
  if (!definition.name.trim() || definition.maximumStacks < 1) throw new Error("Definição de condição inválida.");
  for (const effect of definition.effects) {
    evaluateExpression(effect.expression, () => 1);
    if (effect.kind === "HEAL" && effect.damageTypeIds.length) throw new Error("Efeitos de cura não usam tipos de dano.");
    if (effect.kind === "HEAL" && (effect.ignoreImmunity || effect.ignoreReductionExpression)) throw new Error("Efeitos de cura não usam imunidade ou RD.");
    if (effect.kind === "DAMAGE") validatePenetration(effect.ignoreReductionExpression);
    validateDamageTypeIds(current, effect.damageTypeIds);
  }
  const state = clone(current);
  const cleaned: ConditionDefinition = {
    ...clone(definition),
    name: definition.name.trim(),
    ...(definition.description?.trim() ? { description: definition.description.trim() } : {}),
    effects: definition.effects.map((effect) => ({
      ...effect,
      damageTypeIds: effect.kind === "DAMAGE" ? uniqueIds(effect.damageTypeIds) : [],
      ignoreImmunity: effect.kind === "DAMAGE" && effect.ignoreImmunity,
      ...(effect.kind === "DAMAGE" && effect.ignoreReductionExpression?.trim() ? { ignoreReductionExpression: effect.ignoreReductionExpression.trim() } : {}),
    })),
  };
  if (!definition.description?.trim()) delete cleaned.description;
  if (index >= 0) state.conditionDefinitions[index] = cleaned;
  else state.conditionDefinitions.push(cleaned);
  return commit(
    state,
    "DEFINITION_CHANGED",
    index >= 0 ? `Condição “${cleaned.name}” atualizada` : `Condição “${cleaned.name}” criada`,
    { conditionDefinitions: clone(current.conditionDefinitions) },
  );
}

export function deleteConditionDefinition(current: RulebearSceneState, definitionId: string): RulebearSceneState {
  const definition = current.conditionDefinitions.find((item) => item.id === definitionId);
  if (!definition) throw new Error("Condição não encontrada.");
  if (Object.values(current.combatants).some((combatant) => combatant.conditions.some((condition) => condition.definitionId === definitionId))) {
    throw new Error("Remova esta condição dos combatentes antes de excluir a definição.");
  }
  const state = clone(current);
  state.conditionDefinitions = state.conditionDefinitions.filter((item) => item.id !== definitionId);
  return commit(state, "DEFINITION_CHANGED", `Condição “${definition.name}” excluída`, { conditionDefinitions: clone(current.conditionDefinitions) });
}

export function applyCondition(
  current: RulebearSceneState,
  tokenId: string,
  definitionId: string,
  stacks = 1,
): RulebearSceneState {
  const definition = current.conditionDefinitions.find((item) => item.id === definitionId);
  if (!definition) throw new Error("Condição não encontrada.");
  if (!Number.isInteger(stacks) || stacks < 1 || stacks > definition.maximumStacks) throw new Error("Quantidade de stacks inválida.");
  const before = clone(getCombatant(current, tokenId));
  if (before.conditions.some((condition) => condition.definitionId === definitionId)) throw new Error("Este combatente já possui a condição.");
  const state = clone(current);
  const applied: AppliedCondition = {
    id: newId(),
    definitionId,
    stacks,
    ...(definition.duration ? { remainingTicks: definition.duration.ticks } : {}),
  };
  getCombatant(state, tokenId).conditions.push(applied);
  return commit(state, "CONDITION_APPLIED", `Condição “${definition.name}” aplicada`, combatantUndo(tokenId, before), tokenId);
}

export function changeConditionStacks(
  current: RulebearSceneState,
  tokenId: string,
  conditionId: string,
  delta: number,
): RulebearSceneState {
  const before = clone(getCombatant(current, tokenId));
  const state = clone(current);
  const condition = getCombatant(state, tokenId).conditions.find((item) => item.id === conditionId);
  if (!condition) throw new Error("Condição aplicada não encontrada.");
  const definition = state.conditionDefinitions.find((item) => item.id === condition.definitionId);
  if (!definition) throw new Error("Definição da condição não encontrada.");
  const next = condition.stacks + delta;
  if (!Number.isInteger(next) || next < 1 || next > definition.maximumStacks) throw new Error(`Os stacks devem ficar entre 1 e ${definition.maximumStacks}.`);
  condition.stacks = next;
  return commit(state, "CONDITION_CHANGED", `“${definition.name}” agora tem ${next} stack(s)`, combatantUndo(tokenId, before), tokenId);
}

export function removeCondition(current: RulebearSceneState, tokenId: string, conditionId: string): RulebearSceneState {
  const before = clone(getCombatant(current, tokenId));
  const condition = before.conditions.find((item) => item.id === conditionId);
  if (!condition) throw new Error("Condição aplicada não encontrada.");
  const definition = current.conditionDefinitions.find((item) => item.id === condition.definitionId);
  const state = clone(current);
  getCombatant(state, tokenId).conditions = getCombatant(state, tokenId).conditions.filter((item) => item.id !== conditionId);
  return commit(state, "CONDITION_REMOVED", `Condição “${definition?.name ?? "sem definição"}” removida`, combatantUndo(tokenId, before), tokenId);
}

export function processTurn(
  current: RulebearSceneState,
  tokenId: string,
  trigger: Trigger,
  rollDie?: DieRoller,
): TriggerResult {
  const before = clone(getCombatant(current, tokenId));
  if (trigger === "TURN_START" && current.activeTokenId) throw new Error("Encerre o turno aberto antes de iniciar outro.");
  if (trigger === "TURN_END" && current.activeTokenId !== tokenId) throw new Error("Somente o combatente ativo pode encerrar o turno.");

  const state = clone(current);
  const combatant = getCombatant(state, tokenId);
  if (trigger === "TURN_START") state.activeTokenId = tokenId;
  const messages: string[] = [];
  const damageDetails: NonNullable<HistoryEntry["damageDetails"]> = [];
  const conditionSnapshot = [...combatant.conditions];

  for (const applied of conditionSnapshot) {
    const definition = state.conditionDefinitions.find((item) => item.id === applied.definitionId);
    if (!definition) continue;
    for (const effect of definition.effects.filter((item) => item.trigger === trigger)) {
      const multiplier = effect.multiplyByStacks ? applied.stacks : 1;
      if (effect.kind === "DAMAGE") {
        const result = resolveDamageComponent(combatant, effect, multiplier, rollDie);
        damageDetails.push(damageHistory(state, tokenId, result, definition.name));
        assertHpValue(combatant.currentHp - result.finalAmount);
        combatant.currentHp -= result.finalAmount;
        messages.push(`${definition.name}: ${result.finalAmount} de dano`);
      } else {
        const rolled = evaluateExpression(effect.expression, rollDie);
        const requested = rolled.total * multiplier;
        if (requested <= 0) throw new Error(`O efeito de cura de “${definition.name}” precisa ser positivo.`);
        const recovered = combatant.currentHp >= combatant.maximumHp ? 0 : Math.min(requested, combatant.maximumHp - combatant.currentHp);
        combatant.currentHp += recovered;
        messages.push(`${definition.name}: ${recovered} de cura`);
      }
    }
  }

  for (const applied of conditionSnapshot) {
    const currentApplied = combatant.conditions.find((item) => item.id === applied.id);
    const definition = state.conditionDefinitions.find((item) => item.id === applied.definitionId);
    if (!currentApplied || !definition?.duration || definition.duration.decrementOn !== trigger) continue;
    const remaining = (currentApplied.remainingTicks ?? definition.duration.ticks) - 1;
    if (remaining <= 0) {
      combatant.conditions = combatant.conditions.filter((item) => item.id !== currentApplied.id);
      messages.push(`${definition.name}: condição expirada`);
    } else {
      currentApplied.remainingTicks = remaining;
    }
  }

  if (trigger === "TURN_END") delete state.activeTokenId;
  const label = trigger === "TURN_START" ? "Turno iniciado" : "Turno encerrado";
  const committed = commit(
      state,
      trigger,
      (messages.length ? `${label} · ${messages.join(" · ")}` : label).slice(0, 240),
      { ...combatantUndo(tokenId, before), activeTokenId: current.activeTokenId ?? null },
      tokenId,
    );
  if (damageDetails.length) committed.history.at(-1)!.damageDetails = damageDetails;
  return { state: committed, messages };
}

export function undoLastAction(current: RulebearSceneState): RulebearSceneState {
  const currentUndo = current.undo;
  if (!currentUndo) throw new Error("Não há uma ação para desfazer.");
  const state = clone(current);
  const undo = clone(currentUndo);
  if (undo.combatants) {
    for (const [tokenId, combatant] of Object.entries(undo.combatants)) {
      if (combatant) state.combatants[tokenId] = clone(combatant);
      else delete state.combatants[tokenId];
  state.encounter.order = state.encounter.order.filter((id) => id !== tokenId);
  if (state.activeTokenId === tokenId) state.encounter.paused = true;
    }
  }
  if (undo.conditionDefinitions) state.conditionDefinitions = clone(undo.conditionDefinitions);
  if (undo.damageTypes) state.damageTypes = clone(undo.damageTypes);
  if (undo.defensePresets) state.defensePresets = clone(undo.defensePresets);
  if (undo.activeTokenId !== undefined) {
    if (undo.activeTokenId === null) delete state.activeTokenId;
    else state.activeTokenId = undo.activeTokenId;
  }
  state.history = state.history.map((entry) => entry.id === undo.historyId ? { ...entry, undoneAt: new Date().toISOString() } : entry);
  state.revision += 1;
  delete state.undo;
  return state;
}

export function cleanupMissingTokens(current: RulebearSceneState, existingTokenIds: Set<string>): RulebearSceneState {
  let state = current;
  for (const tokenId of Object.keys(state.combatants)) {
    if (!existingTokenIds.has(tokenId)) state = removeCombatant(state, tokenId);
  }
  return state;
}
