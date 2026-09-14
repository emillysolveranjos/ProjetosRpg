import { describe, expect, it } from "vitest";
import { addCombatant, applyCondition, applyDamageComponents, processTurn, saveConditionDefinition, setReductions } from "../src/domain/engine";
import { createEmptyState, parseSceneState } from "../src/state/schema";
import { executeCommand } from "../src/domain/commands";
import { visibleHistory } from "../src/domain/access";
import type { Participant } from "../src/domain/types";

const gm: Participant = { id: "gm", connectionId: "gm", role: "GM", name: "GM" };
const player: Participant = { id: "p", connectionId: "p", role: "PLAYER", name: "Player" };
function scene() {
  const state = addCombatant(createEmptyState(), "a", 40, 40);
  const c = state.combatants.a!;
  for (const visibility of Object.values(c.settings.visibility)) visibility.mode = "ALL";
  c.markers[0]!.audience.mode = "ALL";
  c.settings.permissions.damage = ["p"];
  return setReductions(state, "a", [{ id: "armor", label: "Armadura", kind: "REDUCTION", amount: 3, damageTypeIds: [] }]);
}
const components = [
  { expression: "10", damageTypeIds: ["damage-physical"], ignoreImmunity: false, ignoreReductionExpression: "1" },
  { expression: "6", damageTypeIds: ["damage-fire"], ignoreImmunity: true },
];

describe("histórico por componente e validação atômica", () => {
  it("preserva componentes após comando, serialização, filtragem e Undo", () => {
    const before = scene();
    const next = executeCommand(before, { type: "damage", tokenId: "a", components }, player);
    expect(next.combatants.a!.currentHp).toBe(29);
    const entry = parseSceneState(next).history.at(-1)!;
    expect(entry.damageDetails).toMatchObject([{ raw: 10, rd: 3, penetration: 1, final: 8 }, { raw: 6, rd: 3, final: 3 }]);
    expect(visibleHistory(next, player).at(-1)!.damageDetails).toHaveLength(2);
    next.combatants.a!.settings.visibility.defenses.mode = "GM";
    expect(visibleHistory(next, player).at(-1)!.damageDetails).toBeUndefined();
    next.combatants.a!.settings.visibility.defenses.mode = "ALL";
    next.combatants.a!.markers[0]!.display = "PERCENT";
    expect(visibleHistory(next, player).at(-1)!.damageDetails).toBeUndefined();
    expect(visibleHistory(next, gm).at(-1)!.damageDetails).toHaveLength(2);
    expect(executeCommand(next, { type: "undo" }, gm).combatants.a!.currentHp).toBe(40);
  });

  it("rejeita expressão inválida mesmo num componente bloqueado por imunidade", () => {
    const state = setReductions(scene(), "a", [{ id: "immune", label: "Imune", kind: "IMMUNITY", amount: 0, damageTypeIds: [] }]);
    const before = structuredClone(state);
    for (const expression of ["-1", "1.5", "1000001", "abc", "1d6-7"]) {
      expect(() => applyDamageComponents(state, "a", [{ ...components[0]!, ignoreReductionExpression: expression }], 1, () => 1)).toThrow();
      expect(state).toEqual(before);
    }
  });

  it("aceita penetração rolada zero e conserva histórico de condições", () => {
    let state = saveConditionDefinition(scene(), { id: "burn", name: "Queimando", maximumStacks: 1, effects: [{ id: "tick", kind: "DAMAGE", trigger: "TURN_START", expression: "8", damageTypeIds: ["damage-fire"], ignoreImmunity: true, ignoreReductionExpression: "1d6-1", multiplyByStacks: false }] });
    state = applyCondition(state, "a", "burn");
    const next = processTurn(state, "a", "TURN_START", () => 1).state;
    expect(next.history.at(-1)!.damageDetails).toMatchObject([{ source: "Queimando", raw: 8, penetration: 0, final: 5 }]);
    expect(visibleHistory(next, player).at(-1)!.damageDetails).toHaveLength(1);
    next.combatants.a!.settings.visibility.conditions.mode = "GM";
    expect(visibleHistory(next, player).at(-1)!.damageDetails).toBeUndefined();
  });
});
