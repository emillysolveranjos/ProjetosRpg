import { describe, expect, it } from "vitest";
import {
  addCombatant,
  applyCondition,
  applyDamage,
  applyHealing,
  changeConditionStacks,
  processTurn,
  saveConditionDefinition,
  setReductions,
  undoLastAction,
} from "../src/domain/engine";
import type { ConditionDefinition, RulebearSceneState } from "../src/domain/types";
import { createEmptyState } from "../src/state/schema";

function fighter(hp = 40): RulebearSceneState {
  return addCombatant(createEmptyState(), "token-1", hp, hp);
}

function poison(overrides: Partial<ConditionDefinition> = {}): ConditionDefinition {
  return {
    id: "poison",
    name: "Envenenado",
    maximumStacks: 4,
    duration: { ticks: 2, decrementOn: "TURN_END" },
    effects: [{ id: "poison-damage", trigger: "TURN_START", kind: "DAMAGE", expression: "3", categories: ["VENENO"], multiplyByStacks: true, bypassReductions: false }],
    ...overrides,
  };
}

describe("dano, cura e reduções", () => {
  it("aplica dano e impede HP negativo em overkill", () => {
    const { state, result } = applyDamage(fighter(10), "token-1", "24");
    expect(result).toMatchObject({ rawAmount: 24, finalAmount: 24, hpBefore: 10, hpAfter: 0 });
    expect(state.combatants["token-1"]?.currentHp).toBe(0);
  });

  it("aplica reduções universais e categorizadas em sequência", () => {
    let state = fighter();
    state = setReductions(state, "token-1", [
      { id: "armor", label: "Armadura", amount: 3, categories: [] },
      { id: "fire", label: "Proteção ígnea", amount: 4, categories: ["fogo"] },
      { id: "cold", label: "Proteção gélida", amount: 99, categories: ["gelo"] },
    ]);
    const result = applyDamage(state, "token-1", "12", ["FOGO"]).result;
    expect(result).toMatchObject({ rawAmount: 12, reducedBy: 7, finalAmount: 5 });
  });

  it("bypass ignora todas as reduções", () => {
    const reduced = setReductions(fighter(), "token-1", [{ id: "all", label: "Tudo", amount: 99, categories: [] }]);
    expect(applyDamage(reduced, "token-1", "8", [], true).result.finalAmount).toBe(8);
  });

  it("redução nunca torna o dano negativo", () => {
    const reduced = setReductions(fighter(), "token-1", [{ id: "all", label: "Tudo", amount: 99, categories: [] }]);
    expect(applyDamage(reduced, "token-1", "8").result.finalAmount).toBe(0);
  });

  it("cura é limitada ao HP máximo", () => {
    const state = applyDamage(fighter(20), "token-1", "7").state;
    const healed = applyHealing(state, "token-1", 99);
    expect(healed.recovered).toBe(7);
    expect(healed.state.combatants["token-1"]?.currentHp).toBe(20);
  });

  it("cura em HP cheio não cria revisão ou histórico", () => {
    const state = fighter(20);
    expect(applyHealing(state, "token-1", 2)).toEqual({ state, recovered: 0 });
  });

  it("desfaz a última alteração compatível", () => {
    const damaged = applyDamage(fighter(20), "token-1", "7").state;
    const undone = undoLastAction(damaged);
    expect(undone.combatants["token-1"]?.currentHp).toBe(20);
    expect(undone.history.at(-1)?.undoneAt).toBeDefined();
    expect(undone.undo).toBeUndefined();
  });
});

describe("condições e turnos", () => {
  it("multiplica efeito por stacks e decrementa duração no gatilho configurado", () => {
    let state = saveConditionDefinition(fighter(40), poison());
    state = applyCondition(state, "token-1", "poison", 2);
    const start = processTurn(state, "token-1", "TURN_START");
    expect(start.state.combatants["token-1"]?.currentHp).toBe(34);
    expect(start.state.combatants["token-1"]?.conditions[0]?.remainingTicks).toBe(2);
    const end = processTurn(start.state, "token-1", "TURN_END");
    expect(end.state.combatants["token-1"]?.conditions[0]?.remainingTicks).toBe(1);
  });

  it("expira ao zerar a duração", () => {
    let state = saveConditionDefinition(fighter(), poison({ duration: { ticks: 1, decrementOn: "TURN_END" } }));
    state = applyCondition(state, "token-1", "poison");
    state = processTurn(state, "token-1", "TURN_START").state;
    const end = processTurn(state, "token-1", "TURN_END");
    expect(end.state.combatants["token-1"]?.conditions).toHaveLength(0);
    expect(end.messages).toContain("Envenenado: condição expirada");
  });

  it("executa cura no fim do turno", () => {
    const regen = poison({ id: "regen", name: "Regeneração", duration: undefined, effects: [{ id: "heal", trigger: "TURN_END", kind: "HEAL", expression: "5", categories: [], multiplyByStacks: false, bypassReductions: false }] });
    let state = applyDamage(fighter(20), "token-1", "10").state;
    state = saveConditionDefinition(state, regen);
    state = applyCondition(state, "token-1", "regen");
    state = processTurn(state, "token-1", "TURN_START").state;
    expect(processTurn(state, "token-1", "TURN_END").state.combatants["token-1"]?.currentHp).toBe(15);
  });

  it("respeita limite de stacks", () => {
    let state = saveConditionDefinition(fighter(), poison({ maximumStacks: 2 }));
    state = applyCondition(state, "token-1", "poison", 1);
    const conditionId = state.combatants["token-1"]!.conditions[0]!.id;
    state = changeConditionStacks(state, "token-1", conditionId, 1);
    expect(state.combatants["token-1"]?.conditions[0]?.stacks).toBe(2);
    expect(() => changeConditionStacks(state, "token-1", conditionId, 1)).toThrow("entre 1 e 2");
  });

  it("impede dois turnos simultâneos e encerra apenas o ativo", () => {
    let state = addCombatant(fighter(), "token-2", 10, 10);
    state = processTurn(state, "token-1", "TURN_START").state;
    expect(() => processTurn(state, "token-2", "TURN_START")).toThrow("Encerre o turno");
    expect(() => processTurn(state, "token-2", "TURN_END")).toThrow("Somente o combatente ativo");
  });

  it("não deixa mutações parciais escaparem quando um efeito falha", () => {
    const invalid = poison({ effects: [{ id: "one", trigger: "TURN_START", kind: "DAMAGE", expression: "2", categories: [], multiplyByStacks: false, bypassReductions: false }, { id: "bad", trigger: "TURN_START", kind: "DAMAGE", expression: "1d1-2", categories: [], multiplyByStacks: false, bypassReductions: false }] });
    let state = fighter(20);
    // A validação antecipada aceita a sintaxe; a execução recusa o resultado não positivo.
    state = saveConditionDefinition(state, invalid);
    state = applyCondition(state, "token-1", "poison");
    expect(() => processTurn(state, "token-1", "TURN_START", () => 1)).toThrow("dano precisa");
    expect(state.combatants["token-1"]?.currentHp).toBe(20);
    expect(state.activeTokenId).toBeUndefined();
  });
});

describe("limites do encontro", () => {
  it("impede tokens duplicados", () => {
    expect(() => addCombatant(fighter(), "token-1", 10, 10)).toThrow("já está");
  });

  it("limita histórico às 50 ações mais recentes", () => {
    let state = fighter(100);
    for (let index = 0; index < 60; index += 1) {
      state = applyDamage(state, "token-1", "1").state;
    }
    expect(state.history).toHaveLength(50);
  });
});
