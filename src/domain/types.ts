export type Trigger = "TURN_START" | "TURN_END";
export type EffectKind = "DAMAGE" | "HEAL";

export interface DamageReduction {
  id: string;
  label: string;
  amount: number;
  categories: string[];
}

export interface ConditionEffect {
  id: string;
  trigger: Trigger;
  kind: EffectKind;
  expression: string;
  categories: string[];
  multiplyByStacks: boolean;
  bypassReductions: boolean;
}

export interface ConditionDefinition {
  id: string;
  name: string;
  description?: string;
  maximumStacks: number;
  duration?: {
    ticks: number;
    decrementOn: Trigger;
  };
  effects: ConditionEffect[];
}

export interface AppliedCondition {
  id: string;
  definitionId: string;
  stacks: number;
  remainingTicks?: number;
}

export interface CombatantState {
  tokenId: string;
  currentHp: number;
  maximumHp: number;
  reductions: DamageReduction[];
  conditions: AppliedCondition[];
}

export type HistoryKind =
  | "COMBATANT_ADDED"
  | "COMBATANT_REMOVED"
  | "DAMAGE"
  | "HEAL"
  | "REDUCTION_CHANGED"
  | "CONDITION_APPLIED"
  | "CONDITION_CHANGED"
  | "CONDITION_REMOVED"
  | "DEFINITION_CHANGED"
  | "TURN_START"
  | "TURN_END";

export interface HistoryEntry {
  id: string;
  occurredAt: string;
  kind: HistoryKind;
  summary: string;
  tokenId?: string;
  amount?: number;
  undoneAt?: string;
}

export interface UndoRecord {
  historyId: string;
  combatants?: Record<string, CombatantState | null>;
  conditionDefinitions?: ConditionDefinition[];
  activeTokenId?: string | null;
}

export interface RulebearSceneState {
  schemaVersion: 1;
  revision: number;
  combatants: Record<string, CombatantState>;
  conditionDefinitions: ConditionDefinition[];
  activeTokenId?: string;
  history: HistoryEntry[];
  undo?: UndoRecord;
}

export interface TokenView {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface DamageResult {
  expression: string;
  rolls: number[];
  baseAmount: number;
  rawAmount: number;
  reducedBy: number;
  finalAmount: number;
  hpBefore: number;
  hpAfter: number;
}

export interface TriggerResult {
  state: RulebearSceneState;
  messages: string[];
}
