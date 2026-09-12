import { defaultMarker, defaultSettings } from "./defaults";
import { MAX_COMBATANTS, MAX_DEFINITIONS, MAX_HISTORY } from "../config";
import { evaluateExpression, type DieRoller } from "./dice";
import type {
  AppliedCondition,
  CombatantState,
  ConditionDefinition,
  DamageReduction,
  DamageResult,
  HistoryEntry,
  HistoryKind,
  RulebearSceneState,
  Trigger,
  TriggerResult,
  UndoRecord,
} from "./types";

const clone = <T,>(value: T): T => structuredClone(value);
const newId = (): string => crypto.randomUUID();

function normalizeCategories(categories: string[]): string[] {
  return [...new Set(categories.map((category) => category.trim().toLocaleUpperCase("pt-BR")).filter(Boolean))];
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
  if (!Number.isInteger(maximumHp) || maximumHp < 1) throw new Error("O HP máximo deve ser um inteiro maior que zero.");
  if (!Number.isInteger(currentHp) || currentHp < 0 || currentHp > maximumHp) throw new Error("O HP atual deve estar entre zero e o máximo.");

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
  categories: string[],
  bypassReductions: boolean,
  multiplier = 1,
  rollDie?: DieRoller,
): DamageResult {
  if (!Number.isInteger(multiplier) || multiplier < 1 || multiplier > 99) throw new Error("Multiplicador inválido.");
  const rolled = evaluateExpression(expression, rollDie);
  const rawAmount = rolled.total * multiplier;
  if (!Number.isSafeInteger(rawAmount) || rawAmount <= 0) throw new Error("O dano precisa resultar em um valor positivo.");
  const normalized = normalizeCategories(categories);
  let remaining = rawAmount;
  let reducedBy = 0;
  if (!bypassReductions) {
    for (const reduction of combatant.reductions) {
      const applies = reduction.categories.length === 0
        || reduction.categories.some((category) => normalized.includes(category.toLocaleUpperCase("pt-BR")));
      if (!applies || remaining === 0) continue;
      const applied = Math.min(remaining, reduction.amount);
      remaining -= applied;
      reducedBy += applied;
    }
  }
  return {
    expression: rolled.expression,
    rolls: rolled.rolls,
    baseAmount: rolled.total,
    rawAmount,
    reducedBy,
    finalAmount: remaining,
    hpBefore: combatant.currentHp,
    hpAfter: Math.max(0, combatant.currentHp - remaining),
  };
}

export function applyDamage(
  current: RulebearSceneState,
  tokenId: string,
  expression: string,
  categories: string[] = [],
  bypassReductions = false,
  multiplier = 1,
  rollDie?: DieRoller,
): { state: RulebearSceneState; result: DamageResult } {
  const before = clone(getCombatant(current, tokenId));
  const state = clone(current);
  const combatant = getCombatant(state, tokenId);
  const result = resolveDamage(combatant, expression, categories, bypassReductions, multiplier, rollDie);
  combatant.currentHp = result.hpAfter;
  const next = commit(
    state,
    "DAMAGE",
    `${result.finalAmount} de dano${result.reducedBy ? ` · ${result.reducedBy} reduzido` : ""}`,
    combatantUndo(tokenId, before),
    tokenId,
    result.finalAmount,
  );
  return { state: next, result };
}

export function applyHealing(
  current: RulebearSceneState,
  tokenId: string,
  amount: number,
): { state: RulebearSceneState; recovered: number } {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("A cura deve ser um inteiro positivo.");
  const before = clone(getCombatant(current, tokenId));
  const recovered = Math.min(amount, before.maximumHp - before.currentHp);
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
    if (!reduction.label.trim() || !Number.isInteger(reduction.amount) || reduction.amount < 0) throw new Error("Redução inválida.");
  }
  const before = clone(getCombatant(current, tokenId));
  const state = clone(current);
  getCombatant(state, tokenId).reductions = reductions.map((reduction) => ({
    ...reduction,
    label: reduction.label.trim(),
    categories: normalizeCategories(reduction.categories),
  }));
  return commit(state, "REDUCTION_CHANGED", "Reduções atualizadas", combatantUndo(tokenId, before), tokenId);
}

export function saveConditionDefinition(
  current: RulebearSceneState,
  definition: ConditionDefinition,
): RulebearSceneState {
  const index = current.conditionDefinitions.findIndex((item) => item.id === definition.id);
  if (index < 0 && current.conditionDefinitions.length >= MAX_DEFINITIONS) throw new Error(`A cena aceita no máximo ${MAX_DEFINITIONS} condições.`);
  if (!definition.name.trim() || definition.maximumStacks < 1) throw new Error("Definição de condição inválida.");
  for (const effect of definition.effects) evaluateExpression(effect.expression, () => 1);
  const state = clone(current);
  const cleaned: ConditionDefinition = {
    ...clone(definition),
    name: definition.name.trim(),
    ...(definition.description?.trim() ? { description: definition.description.trim() } : {}),
    effects: definition.effects.map((effect) => ({ ...effect, categories: normalizeCategories(effect.categories) })),
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
  const conditionSnapshot = [...combatant.conditions];

  for (const applied of conditionSnapshot) {
    const definition = state.conditionDefinitions.find((item) => item.id === applied.definitionId);
    if (!definition) continue;
    for (const effect of definition.effects.filter((item) => item.trigger === trigger)) {
      const multiplier = effect.multiplyByStacks ? applied.stacks : 1;
      if (effect.kind === "DAMAGE") {
        const result = resolveDamage(combatant, effect.expression, effect.categories, effect.bypassReductions, multiplier, rollDie);
        combatant.currentHp = result.hpAfter;
        messages.push(`${definition.name}: ${result.finalAmount} de dano`);
      } else {
        const rolled = evaluateExpression(effect.expression, rollDie);
        const requested = rolled.total * multiplier;
        if (requested <= 0) throw new Error(`O efeito de cura de “${definition.name}” precisa ser positivo.`);
        const recovered = Math.min(requested, combatant.maximumHp - combatant.currentHp);
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
  return {
    state: commit(
      state,
      trigger,
      messages.length ? `${label} · ${messages.join(" · ")}` : label,
      { ...combatantUndo(tokenId, before), activeTokenId: current.activeTokenId ?? null },
      tokenId,
    ),
    messages,
  };
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
