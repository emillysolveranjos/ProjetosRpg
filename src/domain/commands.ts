import * as engine from "./engine";
import { markerEditable, permitted, allowed } from "./access";
import { parseSceneState } from "../state/schema";
import type { CombatantSettings, ConditionDefinition, DamageReduction, Marker, MarkerTemplate, Participant, RulebearSceneState, EncounterSnapshot } from "./types";
export type Command =
  | { type: "add"; tokenId: string; currentHp: number; maximumHp: number }
  | { type: "remove"; tokenId: string }
  | { type: "damage"; tokenId: string; expression: string; categories: string[]; bypass: boolean }
  | { type: "heal"; tokenId: string; amount: number }
  | { type: "reductions"; tokenId: string; reductions: DamageReduction[] }
  | { type: "condition"; tokenId: string; definitionId: string }
  | { type: "stacks"; tokenId: string; appliedId: string; delta: number }
  | { type: "removeCondition"; tokenId: string; appliedId: string }
  | { type: "saveDefinition"; definition: ConditionDefinition }
  | { type: "deleteDefinition"; definitionId: string }
  | { type: "initiative"; tokenId: string; value: number | null }
  | { type: "order"; order: string[] }
  | { type: "sort" } | { type: "start"; tokenId?: string } | { type: "advance" } | { type: "stop" }
  | { type: "settings"; tokenId: string; settings: CombatantSettings }
  | { type: "markers"; tokenId: string; markers: Marker[]; maximumHp?: number; currentHp?: number }
  | { type: "markerValue"; tokenId: string; markerId: string; expression?: string; checked?: boolean }
  | { type: "template"; template: MarkerTemplate } | { type: "deleteTemplate"; templateId: string }
  | { type: "prune"; tokenIds: string[] } | { type: "undo" };
export interface CommandEnvelope { id: string; sceneId: string; revision: number; coordinator: string; command: Command }
export function adjustValue(current: number, expression: string): number {
  const match = /^\s*(=|\+|-|\*|\/)?\s*(-?(?:\d+(?:\.\d*)?|\.\d+))\s*$/.exec(expression);
  if (!match) throw new Error("Use um número, =valor, +valor, -valor, *valor ou /valor.");
  const n = Number(match[2]);
  const op = match[1] ?? "=";
  const next = op === "+" ? current + n : op === "-" ? current - n : op === "*" ? current * n : op === "/" ? current / n : n;
  if (!Number.isFinite(next)) throw new Error("O resultado precisa ser um número finito.");
  return next;
}
function snapshot(s: RulebearSceneState): EncounterSnapshot {
  return structuredClone({ combatants: s.combatants, conditionDefinitions: s.conditionDefinitions, activeTokenId: s.activeTokenId, encounter: s.encounter, templates: s.templates });
}
export function authorize(state: RulebearSceneState, command: Command, actor: Participant) {
  if (actor.role === "GM") return;
  const tokenId = "tokenId" in command ? command.tokenId : command.type === "advance" ? state.activeTokenId : undefined;
  const c = tokenId ? state.combatants[tokenId] : undefined;
  if (!c) throw new Error("Ação exclusiva do mestre.");
  const map = { initiative: "initiative", damage: "damage", heal: "heal", condition: "conditions", stacks: "conditions", removeCondition: "conditions", advance: "endTurn" } as const;
  if (command.type === "markerValue") {
    const m = c.markers.find((m) => m.id === command.markerId);
    if (m && markerEditable(m, c, actor)) return;
  } else if (command.type in map) {
    const permission = map[command.type as keyof typeof map];
    if (permitted(c, actor, permission)) {
      if (permission === "conditions" && !allowed(c.settings.visibility.conditions, c, actor)) throw new Error("Condições não liberadas.");
      return;
    }
  }
  throw new Error("Você não tem permissão para esta ação.");
}
export function executeCommand(current: RulebearSceneState, command: Command, actor: Participant): RulebearSceneState {
  authorize(current, command, actor);
  let next = structuredClone(current);
  const c = "tokenId" in command && command.tokenId ? next.combatants[command.tokenId] : undefined;
  if ("tokenId" in command && command.tokenId && command.type !== "add" && !c) throw new Error("Combatente indisponível.");
  switch (command.type) {
    case "add": next = engine.addCombatant(next, command.tokenId, command.currentHp, command.maximumHp); break;
    case "remove": next = engine.removeCombatant(next, command.tokenId); break;
    case "damage": next = engine.applyDamage(next, command.tokenId, command.expression, command.categories, actor.role === "GM" && command.bypass).state; break;
    case "heal": next = engine.applyHealing(next, command.tokenId, command.amount).state; break;
    case "reductions": next = engine.setReductions(next, command.tokenId, command.reductions); break;
    case "condition": next = engine.applyCondition(next, command.tokenId, command.definitionId); break;
    case "stacks": next = engine.changeConditionStacks(next, command.tokenId, command.appliedId, command.delta); break;
    case "removeCondition": next = engine.removeCondition(next, command.tokenId, command.appliedId); break;
    case "saveDefinition": next = engine.saveConditionDefinition(next, command.definition); break;
    case "deleteDefinition": next = engine.deleteConditionDefinition(next, command.definitionId); break;
    case "initiative": c!.initiative = command.value; break;
    case "settings": c!.settings = structuredClone(command.settings); break;
    case "markers":
      c!.markers = structuredClone(command.markers);
      if (command.maximumHp !== undefined) c!.maximumHp = command.maximumHp;
      if (command.currentHp !== undefined) c!.currentHp = command.currentHp;
      break;
    case "markerValue": {
      const m = c!.markers.find((m) => m.id === command.markerId);
      if (!m) throw new Error("Marcador indisponível.");
      if (m.kind === "checkbox") {
        if (typeof command.checked !== "boolean") throw new Error("Marcação inválida.");
        m.checked = command.checked;
      } else {
        const value = adjustValue(m.hp ? c!.currentHp : m.value, command.expression ?? "");
        if (m.hp) {
          if (!Number.isInteger(value)) throw new Error("HP precisa ser inteiro.");
          c!.currentHp = Math.max(0, Math.min(c!.maximumHp, value));
        } else m.value = value;
      }
      break;
    }
    case "order": next.encounter.order = [...command.order]; break;
    case "sort":
      next.encounter.order.sort((a, b) => (next.combatants[b]!.initiative ?? -Infinity) - (next.combatants[a]!.initiative ?? -Infinity));
      break;
    case "start": {
      if (next.activeTokenId) throw new Error("Já existe um turno ativo.");
      const target = command.tokenId ?? next.encounter.order[0];
      if (!target || !next.combatants[target]) throw new Error("Adicione um combatente.");
      next.encounter.started = true; next.encounter.paused = false;
      next.encounter.round = Math.max(1, next.encounter.round);
      next = engine.processTurn(next, target, "TURN_START").state;
      break;
    }
    case "advance": {
      if (!next.activeTokenId || next.encounter.paused) throw new Error("O mestre precisa iniciar ou retomar o turno.");
      const index = next.encounter.order.indexOf(next.activeTokenId);
      const target = next.encounter.order[(index + 1) % next.encounter.order.length];
      if (!target) throw new Error("A ordem está vazia.");
      next = engine.processTurn(next, next.activeTokenId, "TURN_END").state;
      if (index === next.encounter.order.length - 1) next.encounter.round++;
      next = engine.processTurn(next, target, "TURN_START").state;
      break;
    }
    case "stop":
      if (next.activeTokenId) next = engine.processTurn(next, next.activeTokenId, "TURN_END").state;
      next.encounter.started = false; next.encounter.paused = false; next.encounter.round = 0;
      break;
    case "template": {
      const index = next.templates.findIndex((t) => t.id === command.template.id);
      if (index < 0) next.templates.push(command.template); else next.templates[index] = command.template;
      break;
    }
    case "deleteTemplate": next.templates = next.templates.filter((t) => t.id !== command.templateId); break;
    case "prune":
      for (const tokenId of command.tokenIds) if (next.combatants[tokenId]) next = engine.removeCombatant(next, tokenId);
      break;
    case "undo":
      if (!current.undo) throw new Error("Não há uma ação para desfazer.");
      if (current.undo.snapshot) {
        Object.assign(next, structuredClone(current.undo.snapshot));
        if (!current.undo.snapshot.activeTokenId) delete next.activeTokenId;
        next.history = next.history.map((e) => e.id === current.undo!.historyId ? { ...e, undoneAt: new Date().toISOString() } : e);
        delete next.undo;
      } else {
        next = engine.undoLastAction(next);
        next.encounter.order = next.encounter.order.filter((id) => !!next.combatants[id]);
        for (const id of Object.keys(next.combatants)) if (!next.encounter.order.includes(id)) next.encounter.order.push(id);
      }
      next.revision = current.revision + 1;
      return parseSceneState(next);
    default: throw new Error("Comando desconhecido.");
  }
  const added = next.history.slice(current.history.length < 50 ? current.history.length : 49);
  const summary = command.type === "advance" ? "Turno avançado; efeitos de fim e início aplicados." : added[0]?.id !== current.history.at(-1)?.id && next.revision > current.revision ? added.map((e) => e.summary).join(" · ").slice(0, 240) : command.type === "settings" ? "Permissões atualizadas." : command.type === "markerValue" || command.type === "markers" ? "Marcadores atualizados." : "Encontro atualizado.";
  const historyId = crypto.randomUUID();
  next.history = [...current.history, { id: historyId, occurredAt: new Date().toISOString(), kind: "ENCOUNTER_CHANGED" as const, summary, tokenId: "tokenId" in command ? command.tokenId : current.activeTokenId }].slice(-50);
  next.undo = { historyId, snapshot: snapshot(current) };
  next.revision = current.revision + 1;
  return parseSceneState(next);
}
