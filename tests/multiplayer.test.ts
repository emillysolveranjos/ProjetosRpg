import { describe, expect, it } from "vitest";
import { addCombatant, saveConditionDefinition, applyCondition } from "../src/domain/engine";
import { executeCommand, adjustValue } from "../src/domain/commands";
import { createEmptyState, migrateLegacyState, parseSceneState } from "../src/state/schema";
import { allowed, markerEditable, markerText, markerVisible, visibleCombatant, visibleHistory } from "../src/domain/access";
import { defaultMarker } from "../src/domain/defaults";
import { mergeImported, readOwlTrackers } from "../src/domain/import-trackers";
import { readPreferences, savePreferences, tokenDisplayLayout, tokenPosition } from "../src/state/preferences";
import type { Participant } from "../src/domain/types";
import { PLUGIN_ID } from "../src/config";
const gm: Participant = { id: "gm", connectionId: "gm", role: "GM", name: "GM" };
const p: Participant = { id: "p", connectionId: "p", role: "PLAYER", name: "P" };
const other = { ...p, id: "other", connectionId: "other" };
function scene() { return addCombatant(addCombatant(createEmptyState(), "a", 10, 20), "b", 7, 10); }
function legacy() { return { schemaVersion: 1, revision: 9, combatants: { a: { tokenId: "a", currentHp: 10, maximumHp: 20, reductions: [], conditions: [] } }, conditionDefinitions: [], history: [], activeTokenId: "a" }; }
describe("migração e validação", () => {
  it("preserva estado v1 e inicia acesso restrito, sem modificar a origem", () => {
    const original = legacy(), before = structuredClone(original), result = migrateLegacyState(original);
    expect(original).toEqual(before); expect(result.schemaVersion).toBe(3); expect(result.combatants.a!.currentHp).toBe(10);
    expect(result.activeTokenId).toBe("a"); expect(result.encounter.round).toBe(1);
    expect(visibleCombatant(result.combatants.a!, p)).toBe(false);
    expect(result.combatants.a!.initiative).toBeNull();
  });
  it("migra v2 preservando encontro, histórico e Undo", () => {
    const source = scene() as unknown as { schemaVersion: number; revision: number; undo?: unknown; combatants: Record<string, unknown> };
    source.schemaVersion = 2;
    const before = structuredClone(source), result = migrateLegacyState(source);
    expect(source).toEqual(before);
    expect(result.schemaVersion).toBe(3);
    expect(result.revision).toBe(before.revision + 1);
    expect(result.undo).toEqual(before.undo);
    expect(result.combatants).toEqual(before.combatants);
  });
  it("não interpreta versões futuras ou HP inválido como cena vazia", () => {
    expect(() => migrateLegacyState({ ...legacy(), schemaVersion: 99 })).toThrow();
    const raw = legacy(); raw.combatants.a.currentHp = 21; expect(() => migrateLegacyState(raw)).toThrow();
    const v2 = scene() as unknown as { schemaVersion: number; combatants: Record<string, { currentHp: number }> };
    v2.schemaVersion = 2; v2.combatants.a!.currentHp = 21;
    expect(() => migrateLegacyState(v2)).toThrow("HP atual");
  });
  it("rejeita ordem duplicada, valores não finitos e duas barras de HP", () => {
    const s = scene(); s.encounter.order = ["a", "a"]; expect(() => parseSceneState(s)).toThrow();
    s.encounter.order = ["a", "b"]; s.combatants.a!.initiative = Infinity; expect(() => parseSceneState(s)).toThrow();
    s.combatants.a!.initiative = null; s.combatants.a!.markers.push(defaultMarker(true)); expect(() => parseSceneState(s)).toThrow();
  });
});
describe("permissões e superfícies", () => {
  it("responsabilidade não libera automaticamente informação ou ação", () => {
    const s = scene(), c = s.combatants.a!; c.settings.owners = [p.id];
    expect(visibleCombatant(c, p)).toBe(false);
    expect(() => executeCommand(s, { type: "heal", tokenId: "a", amount: 1 }, p)).toThrow();
  });
  it("aplica ação autorizada somente no token atribuído", () => {
    const s = scene(), c = s.combatants.a!; c.settings.owners = [p.id]; c.settings.visibility.identity.mode = "OWNERS"; c.settings.permissions.heal = true;
    expect(executeCommand(s, { type: "heal", tokenId: "a", amount: 2 }, p).combatants.a!.currentHp).toBe(12);
    expect(() => executeCommand(s, { type: "heal", tokenId: "a", amount: 2 }, other)).toThrow();
    expect(() => executeCommand(s, { type: "heal", tokenId: "b", amount: 2 }, p)).toThrow();
    expect(() => executeCommand(s, { type: "settings", tokenId: "a", settings: c.settings }, p)).toThrow();
    expect(() => executeCommand(s, { type: "sort" }, p)).toThrow();
  });
  it("resolve audiências individuais e revoga acesso imediatamente", () => {
    const c = scene().combatants.a!, a = { mode: "SELECTED" as const, playerIds: [p.id] };
    expect(allowed(a, c, p)).toBe(true); expect(allowed(a, c, other)).toBe(false);
    a.playerIds = []; expect(allowed(a, c, p)).toBe(false); expect(allowed(a, c, gm)).toBe(true);
  });
  it("porcentagem não oferece edição nem números exatos no texto", () => {
    const c = scene().combatants.a!, m = c.markers[0]!;
    c.settings.visibility.identity.mode = "ALL"; c.settings.owners = [p.id];
    m.audience.mode = "ALL"; m.display = "PERCENT"; m.editable = true;
    expect(markerText(m, c, p)).toBe("50%"); expect(markerEditable(m, c, p)).toBe(false);
    expect(markerText(m, c, gm)).toBe("10/20");
    c.currentHp = 25; expect(markerText(m, c, p)).toBe("125%");
    c.currentHp = -5; expect(markerText(m, c, p)).toBe("-25%");
    m.display = "HIDDEN"; expect(markerVisible(m, c, p)).toBe(false);
  });
  it("histórico antigo não revela valores nem condições ocultas", () => {
    const s = scene(), c = s.combatants.a!;
    c.settings.visibility.identity.mode = "ALL"; c.settings.visibility.history.mode = "ALL";
    s.history = [{ id: "e", occurredAt: new Date().toISOString(), kind: "DAMAGE", tokenId: "a", amount: 37, summary: "Veneno secreto: 37 de dano" }];
    const entries = visibleHistory(s, p);
    expect(entries[0]?.amount).toBeUndefined();
    const result = entries.map((e) => e.summary).join(" ");
    expect(result).not.toContain("37"); expect(result).not.toContain("Veneno");
    c.settings.visibility.identity.mode = "GM"; expect(visibleHistory(s, p)).toEqual([]);
  });
});
describe("iniciativa e Undo atômico", () => {
  it("ordena de forma estável e só reordena por solicitação", () => {
    let s = scene();
    s = executeCommand(s, { type: "initiative", tokenId: "a", value: 2 }, gm);
    s = executeCommand(s, { type: "initiative", tokenId: "b", value: 9 }, gm);
    expect(s.encounter.order).toEqual(["a", "b"]);
    s = executeCommand(s, { type: "sort" }, gm); expect(s.encounter.order).toEqual(["b", "a"]);
    s = executeCommand(s, { type: "initiative", tokenId: "a", value: 9 }, gm);
    s = executeCommand(s, { type: "sort" }, gm); expect(s.encounter.order).toEqual(["b", "a"]);
  });
  it("aplica efeitos de fim e início uma vez; Undo restaura ambos e rodada", () => {
    let s = scene();
    s = saveConditionDefinition(s, { id: "poison", name: "Veneno", maximumStacks: 1, effects: [{ id: "x", trigger: "TURN_END", kind: "DAMAGE", expression: "2", categories: [], multiplyByStacks: false, bypassReductions: false }] });
    s = saveConditionDefinition(s, { id: "regen", name: "Regeneração", maximumStacks: 1, duration: { ticks: 2, decrementOn: "TURN_START" }, effects: [{ id: "y", trigger: "TURN_START", kind: "HEAL", expression: "1", categories: [], multiplyByStacks: false, bypassReductions: false }] });
    s = applyCondition(s, "a", "poison"); s = applyCondition(s, "b", "regen");
    s = executeCommand(s, { type: "start" }, gm); const before = structuredClone(s);
    s = executeCommand(s, { type: "advance" }, gm);
    expect(s.combatants.a!.currentHp).toBe(8); expect(s.combatants.b!.currentHp).toBe(8);
    expect(s.activeTokenId).toBe("b"); expect(s.history.length).toBe(before.history.length + 1);
    const restored = executeCommand(s, { type: "undo" }, gm);
    expect(restored.combatants).toEqual(before.combatants); expect(restored.encounter).toEqual(before.encounter); expect(restored.activeTokenId).toBe("a");
    s = executeCommand(s, { type: "advance" }, gm); expect(s.encounter.round).toBe(2);
  });
  it("permite ao responsável encerrar apenas o próprio turno ativo", () => {
    let s = scene(); const c = s.combatants.a!;
    c.settings.owners = [p.id]; c.settings.visibility.identity.mode = "ALL"; c.settings.permissions.endTurn = true;
    s = executeCommand(s, { type: "start" }, gm);
    s = executeCommand(s, { type: "advance" }, p); expect(s.activeTokenId).toBe("b");
    expect(() => executeCommand(s, { type: "advance" }, p)).toThrow();
  });
  it("novos tokens vão ao fim; remoção do ativo pausa e pode ser desfeita", () => {
    let s = executeCommand(scene(), { type: "start" }, gm);
    s = executeCommand(s, { type: "add", tokenId: "c", currentHp: 1, maximumHp: 1 }, gm); expect(s.encounter.order).toEqual(["a", "b", "c"]);
    s = executeCommand(s, { type: "remove", tokenId: "a" }, gm); expect(s.encounter.paused).toBe(true); expect(s.activeTokenId).toBeUndefined();
    expect(() => executeCommand(s, { type: "advance" }, gm)).toThrow();
    s = executeCommand(s, { type: "undo" }, gm); expect(s.activeTokenId).toBe("a"); expect(s.encounter.order).toEqual(["a", "b", "c"]);
  });
});
describe("recursos e importação", () => {
  it("ajusta recursos sem avaliar código", () => {
    expect(adjustValue(10, "-3")).toBe(7); expect(adjustValue(10, "=-3")).toBe(-3); expect(adjustValue(10, "*2")).toBe(20); expect(adjustValue(10, "/4")).toBe(2.5);
    expect(() => adjustValue(10, "globalThis.alert(1)")).toThrow(); expect(() => adjustValue(10, "/0")).toThrow();
  });
  it("barra HP e motor de dano usam a mesma fonte", () => {
    let s = scene();
    s = executeCommand(s, { type: "markerValue", tokenId: "a", markerId: "hp", expression: "+999" }, gm);
    expect(s.combatants.a!.currentHp).toBe(1009);
    s = executeCommand(s, { type: "damage", tokenId: "a", expression: "3", categories: [], bypass: false }, gm);
    expect(markerText(s.combatants.a!.markers[0]!, s.combatants.a!, gm)).toBe("1006/20");
    expect(s.combatants.a!.markers[0]!.value).toBe(0);
    const undone = executeCommand(s, { type: "undo" }, gm);
    expect(undone.combatants.a!.currentHp).toBe(1009);
  });
  it("alterar o máximo não recorta HP negativo nem sobrevida", () => {
    let s = scene();
    s = executeCommand(s, { type: "markers", tokenId: "a", markers: s.combatants.a!.markers, currentHp: 25, maximumHp: 10 }, gm);
    expect(s.combatants.a).toMatchObject({ currentHp: 25, maximumHp: 10 });
    s = executeCommand(s, { type: "markers", tokenId: "a", markers: s.combatants.a!.markers, currentHp: -7, maximumHp: 30 }, gm);
    expect(s.combatants.a).toMatchObject({ currentHp: -7, maximumHp: 30 });
  });
  it("importa os quatro tipos e não altera os dados de origem", () => {
    const raw = { "com.owl-trackers/trackers": [{ id: "hp", variant: "value-max", name: "Vida", value: 5, max: 10, color: 0 }, { id: "n", variant: "value", value: -3, color: 1 }, { id: "c", variant: "counter", value: 4, color: 2 }, { id: "x", variant: "checkbox", checked: true, color: 3 }] };
    const original = structuredClone(raw), candidates = readOwlTrackers(raw);
    expect(candidates.map((c) => c.marker.kind)).toEqual(["bar", "number", "counter", "checkbox"]);
    const result = mergeImported([defaultMarker(true)], candidates, "hp", "append");
    expect(result.markers.length).toBe(4); expect(result.currentHp).toBe(5); expect(raw).toEqual(original);
    expect(result.markers.every((m) => m.audience.mode === "GM")).toBe(true);
    candidates[0]!.marker.value = 15;
    expect(mergeImported([defaultMarker(true)], candidates.slice(0, 1), "hp", "replace").currentHp).toBe(15);
    candidates[0]!.marker.value = -5;
    expect(mergeImported([defaultMarker(true)], candidates.slice(0, 1), "hp", "replace").currentHp).toBe(-5);
  });
  it("rejeita excesso e HP importado incompatível", () => {
    const candidates = Array.from({ length: 12 }, (_, i) => ({ sourceId: String(i), marker: defaultMarker() }));
    expect(() => mergeImported([defaultMarker(true)], candidates, "", "append")).toThrow("12");
    candidates[0]!.marker.value = -2.5; expect(() => mergeImported([defaultMarker(true)], candidates.slice(0, 1), "0", "append")).toThrow("HP");
  });
  it("preferências independem do usuário, sala e cena", () => {
    savePreferences("r", "p", { position: "TOP", horizontal: "RIGHT", size: "LARGE", overrides: { "s/a": { position: "BOTTOM", size: "SMALL" } } });
    expect(readPreferences("r", "other")).toEqual({ position: "BOTTOM", horizontal: "CENTER", size: "MEDIUM", overrides: {} });
    expect(tokenPosition(readPreferences("r", "p"), "s", "a")).toBe("BOTTOM");
    expect(tokenDisplayLayout(readPreferences("r", "p"), "s", "a")).toEqual({ position: "BOTTOM", horizontal: "RIGHT", size: "SMALL" });
    expect(tokenDisplayLayout(readPreferences("r", "p"), "other", "a")).toEqual({ position: "TOP", horizontal: "RIGHT", size: "LARGE" });
    expect(readPreferences("other", "p")).toEqual({ position: "BOTTOM", horizontal: "CENTER", size: "MEDIUM", overrides: {} });
  });
  it("migra posição antiga e ignora campos locais inválidos", () => {
    localStorage.setItem(`${PLUGIN_ID}/display/r/legacy`, JSON.stringify({ position: "TOP", overrides: { "s/a": "BOTTOM", "s/b": "SIDE", "s/c": { horizontal: "LEFT" } } }));
    const migrated = readPreferences("r", "legacy");
    expect(migrated).toEqual({ position: "TOP", horizontal: "CENTER", size: "MEDIUM", overrides: { "s/a": { position: "BOTTOM" }, "s/c": { horizontal: "LEFT" } } });
    expect(tokenDisplayLayout(migrated, "s", "a")).toEqual({ position: "BOTTOM", horizontal: "CENTER", size: "MEDIUM" });
    localStorage.setItem(`${PLUGIN_ID}/display/r/bad`, JSON.stringify({ position: "SIDE", horizontal: "TOP", size: "HUGE", overrides: { "s/a": { position: "SIDE", horizontal: 2, size: null } } }));
    expect(readPreferences("r", "bad")).toEqual({ position: "BOTTOM", horizontal: "CENTER", size: "MEDIUM", overrides: {} });
  });
});
