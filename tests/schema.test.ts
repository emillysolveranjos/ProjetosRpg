import { describe, expect, it } from "vitest";
import { addCombatant } from "../src/domain/engine";
import { createEmptyState, parseSceneState } from "../src/state/schema";

describe("metadata da cena", () => {
  it("cria estado vazio versionado", () => {
    expect(createEmptyState()).toMatchObject({ schemaVersion: 3, revision: 0, combatants: {}, conditionDefinitions: [], history: [], encounter: { order: [], round: 0 } });
  });

  it("aceita uma metadata válida", () => {
    const state = addCombatant(createEmptyState(), "token", 4, 8);
    expect(parseSceneState(state)).toEqual(state);
  });

  it("rejeita versão desatualizada sem migrá-la silenciosamente", () => {
    expect(() => parseSceneState({ ...createEmptyState(), schemaVersion: 0 })).toThrow();
  });

  it("aceita HP negativo e sobrevida acima do máximo", () => {
    const state = addCombatant(createEmptyState(), "token", 4, 8);
    state.combatants.token!.currentHp = 9; expect(parseSceneState(state).combatants.token!.currentHp).toBe(9);
    state.combatants.token!.currentHp = -3; expect(parseSceneState(state).combatants.token!.currentHp).toBe(-3);
    state.combatants.token!.currentHp = 2_147_483_648; expect(() => parseSceneState(state)).toThrow();
  });

  it("rejeita chave de combatente diferente do ID do token", () => {
    const state = addCombatant(createEmptyState(), "token", 4, 8);
    state.combatants.token!.tokenId = "outro";
    expect(() => parseSceneState(state)).toThrow("não corresponde");
  });
});
