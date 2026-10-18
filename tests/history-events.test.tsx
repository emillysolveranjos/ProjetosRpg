import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { addCombatant, applyCondition, applyDamageComponents, saveConditionDefinition, setReductions } from "../src/domain/engine";
import { executeCommand } from "../src/domain/commands";
import { visibleHistory } from "../src/domain/access";
import { createEmptyState, parseSceneState } from "../src/state/schema";
import { HistoryList } from "../src/action/HistoryList";
import type { Participant } from "../src/domain/types";

const gm: Participant = { id: "gm", connectionId: "gm", role: "GM", name: "GM" };
const player: Participant = { id: "p", connectionId: "p", role: "PLAYER", name: "P" };
function scene() {
  let state = addCombatant(addCombatant(createEmptyState(), "a", 30, 30), "b", 20, 20);
  for (const id of ["a", "b"]) {
    const c = state.combatants[id]!;
    for (const audience of Object.values(c.settings.visibility)) audience.mode = "ALL";
    c.markers[0]!.audience.mode = "ALL";
  }
  state = setReductions(state, "a", [{ id: "armor", label: "Armadura", kind: "REDUCTION", amount: 2, damageTypeIds: [] }]);
  return saveConditionDefinition(state, { id: "bleed", name: "Sangrando", maximumStacks: 3, effects: [{ id: "tick", trigger: "TURN_START", kind: "DAMAGE", expression: "4", damageTypeIds: [], multiplyByStacks: true, ignoreImmunity: false }] });
}

describe("eventos do histórico", () => {
  it("guarda os dados rolados, a defesa e o HP antes e depois", () => {
    const next = applyDamageComponents(scene(), "a", [{ expression: "2d6+3", damageTypeIds: ["damage-fire"], ignoreImmunity: false }], 1, () => 4).state;
    expect(parseSceneState(next).history.at(-1)!.events).toEqual([{ kind: "DAMAGE", tokenId: "a", total: 9, hpBefore: 30, hpAfter: 21, parts: [{ roll: { expression: "2d6+3", rolls: [4, 4], total: 11 }, multiplier: 1, types: ["Fogo"], immune: false, rd: 2, penetration: 0, final: 9 }] }]);
  });

  it("resume rolagens grandes sem guardar todos os dados", () => {
    const next = applyDamageComponents(scene(), "b", [{ expression: "40d2", damageTypeIds: [], ignoreImmunity: false }], 1, () => 1).state;
    const roll = next.history.at(-1)!.events![0]!.kind === "DAMAGE" ? (next.history.at(-1)!.events![0] as { parts: { roll: { rolls: number[]; truncated?: boolean; total: number } }[] }).parts[0]!.roll : undefined;
    expect(roll).toMatchObject({ total: 40, truncated: true });
    expect(roll!.rolls).toHaveLength(20);
  });

  it("avanço de turno registra fim, início, rodada e efeitos de condição numa entrada só", () => {
    let state = applyCondition(scene(), "b", "bleed", 2);
    state = executeCommand(state, { type: "start", tokenId: "a" }, gm);
    state = executeCommand(state, { type: "advance" }, gm);
    const entry = state.history.at(-1)!;
    expect(entry.tokenId).toBe("b");
    expect(entry.events!.map((e) => e.kind + (e.kind === "TURN" ? ":" + e.phase : ""))).toEqual(["TURN:END", "TURN:START", "DAMAGE"]);
    expect(entry.events![2]).toMatchObject({ source: "Sangrando", total: 8, parts: [{ multiplier: 2 }] });
  });

  it("ações da biblioteca não ficam associadas ao token em turno", () => {
    let state = executeCommand(scene(), { type: "start", tokenId: "a" }, gm);
    state = executeCommand(state, { type: "deleteDefinition", definitionId: "bleed" }, gm);
    expect(state.history.at(-1)!.tokenId).toBeUndefined();
  });

  it("ajustes de HP registram o valor anterior e o novo", () => {
    const state = executeCommand(scene(), { type: "hpAdjust", tokenId: "b", target: "MAXIMUM", expression: "+5" }, gm);
    expect(state.history.at(-1)!.events).toEqual([{ kind: "HP", tokenId: "b", target: "MAXIMUM", before: 20, after: 25 }]);
  });

  it("jogador sem HP completo vê o que aconteceu sem números, e condições ocultas somem", () => {
    let state = applyCondition(scene(), "b", "bleed");
    state = applyDamageComponents(state, "a", [{ expression: "5", damageTypeIds: [], ignoreImmunity: false }]).state;
    state.combatants.a!.markers[0]!.display = "PERCENT";
    state.combatants.b!.settings.visibility.conditions.mode = "GM";
    const view = visibleHistory(state, player);
    expect(view.at(-1)!.events).toEqual([{ kind: "DAMAGE", tokenId: "a", hidden: true }]);
    expect(view.some((entry) => entry.events?.some((e) => e.kind === "CONDITION"))).toBe(false);
    expect(visibleHistory(state, gm).at(-1)!.events![0]).toMatchObject({ kind: "DAMAGE", total: 3 });
  });
});

describe("histórico amigável", () => {
  it("mostra frases diretas e os dados como peças", () => {
    let state = applyDamageComponents(scene(), "a", [{ expression: "2d6+3", damageTypeIds: [], ignoreImmunity: false }], 1, () => 4).state;
    state = executeCommand(state, { type: "start", tokenId: "b" }, gm);
    render(<HistoryList entries={state.history} nameOf={(id) => id === "a" ? "Goblin" : "Lina"} />);
    expect(screen.getByText(/levou/).closest("p")).toHaveTextContent("Goblin levou 9 de dano");
    expect(screen.getAllByText("4")).toHaveLength(2);
    expect(screen.getByText("defesa −2")).toBeInTheDocument();
    expect(screen.getByText("Rodada 1")).toBeInTheDocument();
  });

  it("versão oculta não mostra valores", () => {
    render(<HistoryList entries={[{ id: "e", kind: "ENCOUNTER_CHANGED", occurredAt: new Date().toISOString(), summary: "", events: [{ kind: "DAMAGE", tokenId: "a", hidden: true }] }]} nameOf={() => "Goblin"} />);
    expect(screen.getByText("Goblin").closest("p")).toHaveTextContent("Goblin levou dano");
  });
});
