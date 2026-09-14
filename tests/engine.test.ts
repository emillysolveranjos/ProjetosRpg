import { describe, expect, it } from "vitest";
import {
  addCombatant,
  applyCondition,
  applyDamage,
  applyDamageComponents,
  applyHealing,
  changeConditionStacks,
  processTurn,
  saveDamageType,
  deleteDamageType,
  saveDefensePreset,
  deleteDefensePreset,
  applyDefensePreset,
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
    effects: [{ id: "poison-damage", trigger: "TURN_START", kind: "DAMAGE", expression: "3", damageTypeIds: ["damage-poison"], multiplyByStacks: true, ignoreImmunity: false }],
    ...overrides,
  };
}

describe("dano, cura e reduções", () => {
  it("aplica dano, consome sobrevida e permite HP negativo em overkill", () => {
    const { state, result } = applyDamage(fighter(10), "token-1", "24");
    expect(result).toMatchObject({ rawAmount: 24, finalAmount: 24, hpBefore: 10, hpAfter: -14 });
    expect(state.combatants["token-1"]?.currentHp).toBe(-14);
    const over = addCombatant(createEmptyState(), "over", 25, 20);
    expect(applyDamage(over, "over", "30").state.combatants.over?.currentHp).toBe(-5);
  });

  it("aplica reduções universais e categorizadas em sequência", () => {
    let state = fighter();
    state = setReductions(state, "token-1", [
      { id: "armor", label: "Armadura", kind: "REDUCTION", amount: 3, damageTypeIds: [] },
      { id: "fire", label: "Proteção ígnea", kind: "REDUCTION", amount: 4, damageTypeIds: ["damage-fire"] },
      { id: "cold", label: "Proteção gélida", kind: "REDUCTION", amount: 99, damageTypeIds: ["damage-cold"] },
    ]);
    const result = applyDamage(state, "token-1", "12", ["damage-fire"]).result;
    expect(result).toMatchObject({ rawAmount: 12, reducedBy: 7, finalAmount: 5 });
  });

  it("ignorar imunidade não ignora RD", () => {
    const defended = setReductions(fighter(), "token-1", [
      { id: "immune", label: "Imune", kind: "IMMUNITY", amount: 0, damageTypeIds: [] },
      { id: "armor", label: "Armadura", kind: "REDUCTION", amount: 3, damageTypeIds: [] },
    ]);
    expect(applyDamage(defended, "token-1", "8", [], true).result).toMatchObject({ finalAmount: 5, reducedBy: 3, blockedByImmunity: false });
  });

  it("redução nunca torna o dano negativo", () => {
    const reduced = setReductions(fighter(), "token-1", [{ id: "all", label: "Tudo", kind: "REDUCTION", amount: 99, damageTypeIds: [] }]);
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

  it("cura soma a partir do negativo e preserva sobrevida existente", () => {
    const negative = addCombatant(createEmptyState(), "negative", -5, 20);
    const healed = applyHealing(negative, "negative", 8);
    expect(healed.recovered).toBe(8);
    expect(healed.state.combatants.negative?.currentHp).toBe(3);
    const over = addCombatant(createEmptyState(), "over", 25, 20);
    expect(applyHealing(over, "over", 8)).toEqual({ state: over, recovered: 0 });
  });

  it("desfaz a última alteração compatível", () => {
    const damaged = applyDamage(fighter(20), "token-1", "7").state;
    const undone = undoLastAction(damaged);
    expect(undone.combatants["token-1"]?.currentHp).toBe(20);
    expect(undone.history.at(-1)?.undoneAt).toBeDefined();
    expect(undone.undo).toBeUndefined();
  });
});

describe("biblioteca de dano e defesas", () => {
  it("recusa nomes equivalentes e tipos inexistentes", () => {
    const state = createEmptyState();
    expect(() => saveDamageType(state, { id: "outro", name: "fisico", color: "#ffffff" })).toThrow("nome");
    expect(() => saveDefensePreset(state, { id: "preset", name: "Teste", kind: "REDUCTION", amount: 2, damageTypeIds: ["inexistente"] })).toThrow("não existe");
  });

  it("aplica uma defesa uma só vez quando vários tipos correspondem", () => {
    let state = fighter(20);
    state = setReductions(state, "token-1", [{ id: "ward", label: "Proteção elemental", kind: "REDUCTION", amount: 4, damageTypeIds: ["damage-fire", "damage-cold"] }]);
    expect(applyDamage(state, "token-1", "10", ["damage-fire", "damage-cold"]).result).toMatchObject({ reducedBy: 4, finalAmount: 6 });
  });

  it("aplica preset como cópia e preserva o token ao editar ou excluir o original", () => {
    let state = saveDefensePreset(fighter(20), { id: "armor", name: "Armadura", kind: "REDUCTION", amount: 3, damageTypeIds: ["damage-physical"] });
    state = applyDefensePreset(state, "token-1", "armor");
    const copiedId = state.combatants["token-1"]!.reductions[0]!.id;
    state = saveDefensePreset(state, { id: "armor", name: "Armadura aprimorada", kind: "REDUCTION", amount: 8, damageTypeIds: [] });
    state = deleteDefensePreset(state, "armor");
    expect(state.combatants["token-1"]!.reductions[0]).toEqual({ id: copiedId, label: "Armadura", kind: "REDUCTION", amount: 3, damageTypeIds: ["damage-physical"] });
  });

  it("bloqueia exclusão de tipo referenciado e permite após remover o uso", () => {
    let state = saveDamageType(createEmptyState(), { id: "radiant", name: "Radiante", color: "#ffffff" });
    state = saveDefensePreset(state, { id: "ward", name: "Proteção", kind: "REDUCTION", amount: 2, damageTypeIds: ["radiant"] });
    expect(() => deleteDamageType(state, "radiant")).toThrow("preset");
    state = deleteDefensePreset(state, "ward");
    expect(deleteDamageType(state, "radiant").damageTypes.some((type) => type.id === "radiant")).toBe(false);
  });
});

describe("imunidade, componentes e penetração de RD", () => {
  it("bloqueia somente o componente imune de um ataque misto", () => {
    const defended = setReductions(fighter(30), "token-1", [
      { id: "fire-immunity", label: "Imune a fogo", kind: "IMMUNITY", amount: 0, damageTypeIds: ["damage-fire"] },
      { id: "armor", label: "Armadura", kind: "REDUCTION", amount: 2, damageTypeIds: ["damage-physical"] },
    ]);
    const { state, result } = applyDamageComponents(defended, "token-1", [
      { expression: "10", damageTypeIds: ["damage-physical"], ignoreImmunity: false },
      { expression: "6", damageTypeIds: ["damage-fire"], ignoreImmunity: false },
    ]);
    expect(result.components.map((component) => component.finalAmount)).toEqual([8, 0]);
    expect(result.components[1]).toMatchObject({ blockedByImmunity: true, reducedBy: 0 });
    expect(state.combatants["token-1"]?.currentHp).toBe(22);
  });

  it("combina ignorar imunidade com uma expressão de penetração", () => {
    const defended = setReductions(fighter(30), "token-1", [
      { id: "immune", label: "Imunidade", kind: "IMMUNITY", amount: 0, damageTypeIds: ["damage-fire"] },
      { id: "ward", label: "Proteção", kind: "REDUCTION", amount: 7, damageTypeIds: ["damage-fire"] },
    ]);
    const result = applyDamageComponents(defended, "token-1", [{ expression: "12", damageTypeIds: ["damage-fire"], ignoreImmunity: true, ignoreReductionExpression: "1d6+1" }], 1, () => 3).result;
    expect(result).toMatchObject({ rawAmount: 12, ignoredReduction: 4, reducedBy: 3, finalAmount: 9, blockedByImmunity: false });
    expect(result.components[0]).toMatchObject({ penetrationAmount: 4, availableReduction: 7 });
  });

  it("limita a penetração à RD disponível abaixo, igual ou acima do total", () => {
    const defended = setReductions(fighter(40), "token-1", [
      { id: "one", label: "Armadura", kind: "REDUCTION", amount: 3, damageTypeIds: [] },
      { id: "two", label: "Escudo", kind: "REDUCTION", amount: 2, damageTypeIds: [] },
    ]);
    const resolve = (penetration: string) => applyDamageComponents(defended, "token-1", [{ expression: "10", damageTypeIds: [], ignoreImmunity: false, ignoreReductionExpression: penetration }]).result;
    expect(resolve("2")).toMatchObject({ ignoredReduction: 2, reducedBy: 3, finalAmount: 7 });
    expect(resolve("5")).toMatchObject({ ignoredReduction: 5, reducedBy: 0, finalAmount: 10 });
    expect(resolve("9")).toMatchObject({ ignoredReduction: 5, reducedBy: 0, finalAmount: 10 });
    expect(resolve("0")).toMatchObject({ ignoredReduction: 0, reducedBy: 5, finalAmount: 5 });
  });

  it("aplica imunidade universal também a dano sem tipo", () => {
    const defended = setReductions(fighter(20), "token-1", [{ id: "immune", label: "Imunidade total", kind: "IMMUNITY", amount: 0, damageTypeIds: [] }]);
    expect(applyDamageComponents(defended, "token-1", [{ expression: "7", damageTypeIds: [], ignoreImmunity: false }]).result.finalAmount).toBe(0);
  });

  it("exige cobertura completa para bloquear um componente híbrido legado", () => {
    let defended = setReductions(fighter(20), "token-1", [{ id: "fire", label: "Imune a fogo", kind: "IMMUNITY", amount: 0, damageTypeIds: ["damage-fire"] }]);
    const hybrid = { expression: "8", damageTypeIds: ["damage-fire", "damage-physical"], ignoreImmunity: false };
    expect(applyDamageComponents(defended, "token-1", [hybrid]).result.finalAmount).toBe(8);
    defended = setReductions(defended, "token-1", [
      ...defended.combatants["token-1"]!.reductions,
      { id: "physical", label: "Imune a físico", kind: "IMMUNITY", amount: 0, damageTypeIds: ["damage-physical"] },
    ]);
    expect(applyDamageComponents(defended, "token-1", [hybrid]).result.finalAmount).toBe(0);
  });

  it("rejeita penetração inválida e mantém o ataque inteiro atômico", () => {
    const state = fighter(20);
    expect(() => applyDamageComponents(state, "token-1", [
      { expression: "5", damageTypeIds: [], ignoreImmunity: false },
      { expression: "4", damageTypeIds: [], ignoreImmunity: false, ignoreReductionExpression: "-1" },
    ])).toThrow("RD ignorada");
    expect(state.combatants["token-1"]?.currentHp).toBe(20);
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
    const regen = poison({ id: "regen", name: "Regeneração", duration: undefined, effects: [{ id: "heal", trigger: "TURN_END", kind: "HEAL", expression: "5", damageTypeIds: [], multiplyByStacks: false, ignoreImmunity: false }] });
    let state = applyDamage(fighter(20), "token-1", "10").state;
    state = saveConditionDefinition(state, regen);
    state = applyCondition(state, "token-1", "regen");
    state = processTurn(state, "token-1", "TURN_START").state;
    expect(processTurn(state, "token-1", "TURN_END").state.combatants["token-1"]?.currentHp).toBe(15);
  });

  it("efeitos de condições atravessam zero e curam a partir do negativo", () => {
    const damage = poison({ effects: [{ id: "damage", trigger: "TURN_START", kind: "DAMAGE", expression: "30", damageTypeIds: [], multiplyByStacks: false, ignoreImmunity: false }] });
    const heal = poison({ id: "heal", name: "Cura", effects: [{ id: "heal", trigger: "TURN_END", kind: "HEAL", expression: "8", damageTypeIds: [], multiplyByStacks: false, ignoreImmunity: false }] });
    let state = addCombatant(createEmptyState(), "token-1", 20, 20);
    state = saveConditionDefinition(saveConditionDefinition(state, damage), heal);
    state = applyCondition(applyCondition(state, "token-1", "poison"), "token-1", "heal");
    state = processTurn(state, "token-1", "TURN_START").state;
    expect(state.combatants["token-1"]?.currentHp).toBe(-10);
    state = processTurn(state, "token-1", "TURN_END").state;
    expect(state.combatants["token-1"]?.currentHp).toBe(-2);
  });

  it("resolve componentes de condição com imunidade e penetração separadas", () => {
    let state = setReductions(fighter(30), "token-1", [
      { id: "fire", label: "Imune a fogo", kind: "IMMUNITY", amount: 0, damageTypeIds: ["damage-fire"] },
      { id: "armor", label: "Armadura", kind: "REDUCTION", amount: 4, damageTypeIds: ["damage-physical"] },
    ]);
    state = saveConditionDefinition(state, poison({ effects: [
      { id: "fire", trigger: "TURN_START", kind: "DAMAGE", expression: "6", damageTypeIds: ["damage-fire"], multiplyByStacks: false, ignoreImmunity: false },
      { id: "physical", trigger: "TURN_START", kind: "DAMAGE", expression: "8", damageTypeIds: ["damage-physical"], multiplyByStacks: false, ignoreImmunity: false, ignoreReductionExpression: "2" },
    ] }));
    state = applyCondition(state, "token-1", "poison");
    const result = processTurn(state, "token-1", "TURN_START");
    expect(result.state.combatants["token-1"]?.currentHp).toBe(24);
    expect(result.messages).toEqual(["Envenenado: 0 de dano", "Envenenado: 6 de dano"]);
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
    const invalid = poison({ effects: [{ id: "one", trigger: "TURN_START", kind: "DAMAGE", expression: "2", damageTypeIds: [], multiplyByStacks: false, ignoreImmunity: false }, { id: "bad", trigger: "TURN_START", kind: "DAMAGE", expression: "1d1-2", damageTypeIds: [], multiplyByStacks: false, ignoreImmunity: false }] });
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
