export type Trigger = "TURN_START" | "TURN_END";
export type EffectKind = "DAMAGE" | "HEAL";
export type DefenseKind = "REDUCTION" | "IMMUNITY";

export interface DamageReduction {
  id: string;
  label: string;
  kind: DefenseKind;
  amount: number;
  damageTypeIds: string[];
}

export interface DamageComponent {
  expression: string;
  damageTypeIds: string[];
  ignoreImmunity: boolean;
  ignoreReductionExpression?: string;
}

export interface ConditionEffect {
  id: string;
  trigger: Trigger;
  kind: EffectKind;
  expression: string;
  damageTypeIds: string[];
  multiplyByStacks: boolean;
  ignoreImmunity: boolean;
  ignoreReductionExpression?: string;
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
  settings: CombatantSettings;
  markers: Marker[];
  initiative: number | null;
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
  | "TURN_END" | "ENCOUNTER_CHANGED" | "MARKER_CHANGED" | "ACCESS_CHANGED" | "LIBRARY_CHANGED";

export interface HistoryEntry {
  damageDetails?: DamageHistoryDetail[];
  id: string;
  occurredAt: string;
  kind: HistoryKind;
  summary: string;
  tokenId?: string;
  amount?: number;
  undoneAt?: string;
}

export interface DamageHistoryDetail {
  tokenId: string;
  source?: string;
  types: string[];
  raw: number;
  rd: number;
  penetration: number;
  immune: boolean;
  ignoreImmunity: boolean;
  final: number;
}

export interface UndoRecord {
  historyId: string;
  snapshot?: EncounterSnapshot;
  combatants?: Record<string, CombatantState | null>;
  conditionDefinitions?: ConditionDefinition[];
  damageTypes?: DamageTypeDefinition[];
  defensePresets?: DefensePreset[];
  activeTokenId?: string | null;
}

export interface RulebearSceneState {
  schemaVersion: 6;
  sceneId: string;
  encounter: Encounter;
  templates: MarkerTemplate[];
  receipts: string[];
  revision: number;
  combatants: Record<string, CombatantState>;
  conditionDefinitions: ConditionDefinition[];
  damageTypes: DamageTypeDefinition[];
  defensePresets: DefensePreset[];
  activeTokenId?: string;
  history: HistoryEntry[];
  undo?: UndoRecord;
}

export interface TokenView {
  visible?: boolean;
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
  ignoredReduction: number;
  blockedByImmunity: boolean;
  finalAmount: number;
  hpBefore: number;
  hpAfter: number;
  components: DamageComponentResult[];
}

export interface DamageComponentResult extends DamageComponent {
  expression: string;
  rolls: number[];
  baseAmount: number;
  rawAmount: number;
  penetrationRolls: number[];
  penetrationAmount: number;
  availableReduction: number;
  ignoredReduction: number;
  reducedBy: number;
  blockedByImmunity: boolean;
  finalAmount: number;
}

export interface TriggerResult {
  state: RulebearSceneState;
  messages: string[];
}

export interface DamageTypeDefinition {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface DefensePreset {
  id: string;
  name: string;
  kind: DefenseKind;
  amount: number;
  damageTypeIds: string[];
}


export interface Audience {
  mode: "GM" | "ALL" | "OWNERS" | "SELECTED";
  playerIds: string[];
}
export interface CombatantSettings {
  owners: string[];
  visibility: { identity: Audience; initiative: Audience; defenses: Audience; conditions: Audience; history: Audience };
  permissions: CombatantPermissions;
}
export type PermissionKey = "initiative" | "damage" | "heal" | "adjustCurrentHp" | "adjustMaximumHp" | "conditions" | "endTurn";
export type CombatantPermissions = Record<PermissionKey, string[]>;
export interface Marker {
  id: string;
  name: string;
  kind: "bar" | "number" | "counter" | "checkbox";
  color: string;
  onMap: boolean;
  audience: Audience;
  display: "FULL" | "PERCENT" | "HIDDEN";
  editable: boolean;
  hp?: boolean;
  value: number;
  maximum: number;
  checked: boolean;
}
export interface MarkerTemplate { id: string; name: string; markers: Marker[] }
export interface Encounter { order: string[]; round: number; started: boolean; paused: boolean }
export interface EncounterSnapshot {
  combatants: Record<string, CombatantState>;
  conditionDefinitions: ConditionDefinition[];
  damageTypes: DamageTypeDefinition[];
  defensePresets: DefensePreset[];
  activeTokenId?: string;
  encounter: Encounter;
  templates: MarkerTemplate[];
}
export interface Participant { id: string; connectionId: string; name: string; role: "GM" | "PLAYER" }
export interface Viewer { id: string; role: "GM" | "PLAYER" }
export type PositionPreference = "TOP" | "BOTTOM";
export type HorizontalPreference = "LEFT" | "CENTER" | "RIGHT";
export type MarkerSizePreference = "SMALL" | "MEDIUM" | "LARGE";
export interface MarkerDisplayLayout {
  position: PositionPreference;
  horizontal: HorizontalPreference;
  size: MarkerSizePreference;
}
export type TokenDisplayOverride = Partial<MarkerDisplayLayout>;
export interface DisplayPreferences extends MarkerDisplayLayout {
  overrides: Record<string, TokenDisplayOverride>;
}
