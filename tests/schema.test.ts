import { describe, expect, it } from "vitest";
import { addCombatant } from "../src/domain/engine";
import { createEmptyState, parseSceneState } from "../src/state/schema";

describe("metadata da cena", () => {
  it("cria estado vazio versionado", () => {
    expect(createEmptyState()).toEqual({ schemaVersion: 1, revision: 0, combatants: {}, conditionDefinitions: [], history: [] });
  });

  it("aceita uma metadata válida", () => {
    const state = addCombatant(createEmptyState(), "token", 4, 8);
    expect(parseSceneState(state)).toEqual(state);
  });

  it("rejeita versão desatualizada sem migrá-la silenciosamente", () => {
    expect(() => parseSceneState({ ...createEmptyState(), schemaVersion: 0 })).toThrow();
  });

  it("rejeita HP atual maior que o máximo", () => {
    const state = addCombatant(createEmptyState(), "token", 4, 8);
    state.combatants.token!.currentHp = 9;
    expect(() => parseSceneState(state)).toThrow("HP atual");
  });

  it("rejeita chave de combatente diferente do ID do token", () => {
    const state = addCombatant(createEmptyState(), "token", 4, 8);
    state.combatants.token!.tokenId = "outro";
    expect(() => parseSceneState(state)).toThrow("não corresponde");
  });
});
