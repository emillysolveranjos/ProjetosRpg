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
type OldTestCombatant = { currentHp: number; settings: { owners: string[]; permissions: unknown }; markers: Array<{ hp?: boolean; editable: boolean }> };
function oldState(version: 2 | 3) {
  const value = structuredClone(scene()) as unknown as {
    schemaVersion: number; revision: number; conditionDefinitions: unknown[]; encounter: unknown; templates: unknown[];
    combatants: Record<string, OldTestCombatant>;
    undo?: unknown;
  };
  value.schemaVersion = version;
  delete value.undo;
  const oldPermissions = { initiative: false, damage: false, heal: false, conditions: false, endTurn: false };
  for (const c of Object.values(value.combatants)) c.settings.permissions = { ...oldPermissions };
  return value;
}
describe("migração e validação", () => {
  it("preserva estado v1 e inicia acesso restrito, sem modificar a origem", () => {
    const original = legacy(), before = structuredClone(original), result = migrateLegacyState(original);
    expect(original).toEqual(before); expect(result.schemaVersion).toBe(6); expect(result.combatants.a!.currentHp).toBe(10);
    expect(result.activeTokenId).toBe("a"); expect(result.encounter.round).toBe(1);
    expect(visibleCombatant(result.combatants.a!, p)).toBe(false);
    expect(result.combatants.a!.initiative).toBeNull();
  });
  it("migra v2 preservando encontro, histórico e Undo", () => {
    const source = oldState(2);
    const before = structuredClone(source), result = migrateLegacyState(source);
    expect(source).toEqual(before);
    expect(result.schemaVersion).toBe(6);
    expect(result.revision).toBe(before.revision + 1);
    expect(result.combatants.a!.currentHp).toBe(10);
    expect(result.combatants.a!.settings.permissions.adjustMaximumHp).toEqual([]);
  });
  it("migra categorias v4 para IDs compartilhados, incluindo condições e Undo", () => {
    const current = scene();
    const source = structuredClone(current) as unknown as Record<string, unknown>;
    source.schemaVersion = 4;
    delete source.damageTypes; delete source.defensePresets;
    const combatants = source.combatants as Record<string, { reductions: unknown[] }>;
    combatants.a!.reductions = [{ id: "fire", label: "Resistência", amount: 2, categories: ["FOGO", "Etéreo"] }];
    source.conditionDefinitions = [{ id: "burn", name: "Queimando", maximumStacks: 1, effects: [{ id: "tick", trigger: "TURN_START", kind: "DAMAGE", expression: "1", categories: ["fogo"], multiplyByStacks: false, bypassReductions: false }] }];
    source.undo = { historyId: "undo", snapshot: { combatants: structuredClone(combatants), conditionDefinitions: structuredClone(source.conditionDefinitions), encounter: structuredClone(source.encounter), templates: structuredClone(source.templates) } };
    const migrated = migrateLegacyState(source);
    const fireId = migrated.damageTypes.find((type) => type.name === "Fogo")!.id;
    const customId = migrated.damageTypes.find((type) => type.name === "Etéreo")!.id;
    expect(migrated.combatants.a!.reductions[0]!.damageTypeIds).toEqual([fireId, customId]);
    expect(migrated.combatants.a!.reductions[0]!.kind).toBe("REDUCTION");
    expect(migrated.conditionDefinitions[0]!.effects[0]!.damageTypeIds).toEqual([fireId]);
    expect(migrated.undo!.snapshot!.combatants.a!.reductions[0]!.damageTypeIds).toEqual([fireId, customId]);
    expect(migrated.damageTypes.find((type) => type.id === customId)?.color).toBe("#64748b");
  });
  it("migra v5 para reduções explícitas e reinterpreta bypass somente como imunidade", () => {
    const current = scene();
    current.combatants.a!.reductions = [{ id: "armor", label: "Armadura", kind: "REDUCTION", amount: 3, damageTypeIds: ["damage-physical"] }];
    current.conditionDefinitions = [{ id: "legacy", name: "Legado", maximumStacks: 1, effects: [{ id: "tick", trigger: "TURN_START", kind: "DAMAGE", expression: "4", damageTypeIds: ["damage-fire", "damage-physical"], multiplyByStacks: false, ignoreImmunity: true }] }];
    current.defensePresets = [{ id: "preset", name: "Proteção", kind: "REDUCTION", amount: 2, damageTypeIds: [] }];
    const source = structuredClone(current) as unknown as Record<string, unknown>;
    source.schemaVersion = 5;
    const downgradeCombatants = (combatants: Record<string, { reductions: Array<Record<string, unknown>> }>) => Object.values(combatants).forEach((combatant) => combatant.reductions.forEach((defense) => delete defense.kind));
    const downgradeDefinitions = (definitions: Array<{ effects: Array<Record<string, unknown>> }>) => definitions.forEach((definition) => definition.effects.forEach((effect) => { effect.bypassReductions = effect.ignoreImmunity; delete effect.ignoreImmunity; }));
    downgradeCombatants(source.combatants as Record<string, { reductions: Array<Record<string, unknown>> }>);
    downgradeDefinitions(source.conditionDefinitions as Array<{ effects: Array<Record<string, unknown>> }>);
    (source.defensePresets as Array<Record<string, unknown>>).forEach((preset) => delete preset.kind);
    source.undo = { historyId: "undo", snapshot: { combatants: structuredClone(source.combatants), conditionDefinitions: structuredClone(source.conditionDefinitions), encounter: structuredClone(source.encounter), templates: structuredClone(source.templates), damageTypes: structuredClone(source.damageTypes), defensePresets: structuredClone(source.defensePresets) } };
    const migrated = migrateLegacyState(source);
    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.combatants.a!.reductions[0]).toMatchObject({ kind: "REDUCTION", amount: 3 });
    expect(migrated.conditionDefinitions[0]!.effects[0]).toMatchObject({ damageTypeIds: ["damage-fire", "damage-physical"], ignoreImmunity: true });
    expect(migrated.conditionDefinitions[0]!.effects[0]!.ignoreReductionExpression).toBeUndefined();
    expect(migrated.undo!.snapshot!.combatants.a!.reductions[0]!.kind).toBe("REDUCTION");
  });
  it("não interpreta versões futuras ou HP inválido como cena vazia", () => {
    expect(() => migrateLegacyState({ ...legacy(), schemaVersion: 99 })).toThrow();
    const raw = legacy(); raw.combatants.a.currentHp = 21; expect(() => migrateLegacyState(raw)).toThrow();
    const v2 = oldState(2); v2.combatants.a!.currentHp = 21;
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
    const s = scene(), c = s.combatants.a!; c.settings.visibility.identity.mode = "ALL"; c.settings.permissions.heal = [p.id];
    expect(executeCommand(s, { type: "heal", tokenId: "a", amount: 2 }, p).combatants.a!.currentHp).toBe(12);
    expect(() => executeCommand(s, { type: "heal", tokenId: "a", amount: 2 }, other)).toThrow();
    expect(() => executeCommand(s, { type: "heal", tokenId: "b", amount: 2 }, p)).toThrow();
    expect(() => executeCommand(s, { type: "settings", tokenId: "a", settings: c.settings }, p)).toThrow();
    expect(() => executeCommand(s, { type: "sort" }, p)).toThrow();
  });
  it("autoriza ações por jogador sem exigir responsabilidade", () => {
    let s = scene(); const c = s.combatants.a!;
    c.settings.visibility.identity.mode = "ALL";
    c.settings.permissions = { initiative: [p.id], damage: [p.id], heal: [p.id], adjustCurrentHp: [p.id], adjustMaximumHp: [p.id], conditions: [p.id], endTurn: [p.id] };
    s.conditionDefinitions = [{ id: "poison", name: "Veneno", maximumStacks: 3, effects: [] }];
    s = executeCommand(s, { type: "damage", tokenId: "a", components: [{ expression: "2", damageTypeIds: [], ignoreImmunity: false }] }, p);
    s = executeCommand(s, { type: "heal", tokenId: "a", amount: 1 }, p);
    s = executeCommand(s, { type: "hpAdjust", tokenId: "a", target: "CURRENT", expression: "+4" }, p);
    s = executeCommand(s, { type: "hpAdjust", tokenId: "a", target: "MAXIMUM", expression: "+5" }, p);
    s = executeCommand(s, { type: "condition", tokenId: "a", definitionId: "poison" }, p);
    expect(s.combatants.a).toMatchObject({ currentHp: 13, maximumHp: 25 });
    expect(s.combatants.a!.conditions).toHaveLength(1);
    s = executeCommand(s, { type: "conditionByDefinition", tokenId: "a", definitionId: "poison", operation: "INCREASE" }, p);
    expect(s.combatants.a!.conditions[0]!.stacks).toBe(2);
    s = executeCommand(s, { type: "conditionByDefinition", tokenId: "a", definitionId: "poison", operation: "DECREASE" }, p);
    s = executeCommand(s, { type: "conditionByDefinition", tokenId: "a", definitionId: "poison", operation: "REMOVE" }, p);
    expect(s.combatants.a!.conditions).toEqual([]);
    expect(() => executeCommand(s, { type: "damage", tokenId: "a", components: [{ expression: "1", damageTypeIds: [], ignoreImmunity: false }] }, other)).toThrow("permissão");
    expect(() => executeCommand(s, { type: "initiative", tokenId: "a", value: 9 }, p)).toThrow("permissão");
    s.combatants.a!.settings.owners = [p.id];
    expect(executeCommand(s, { type: "initiative", tokenId: "a", value: 9 }, p).combatants.a!.initiative).toBe(9);
  });
  it("permite ao jogador autorizado combinar imunidade ignorada e penetração", () => {
    const s = scene(), c = s.combatants.a!;
    c.settings.visibility.identity.mode = "ALL"; c.settings.permissions.damage = [p.id];
    c.reductions = [
      { id: "immune", label: "Imune", kind: "IMMUNITY", amount: 0, damageTypeIds: ["damage-fire"] },
      { id: "ward", label: "Proteção", kind: "REDUCTION", amount: 5, damageTypeIds: ["damage-fire"] },
    ];
    const next = executeCommand(s, { type: "damage", tokenId: "a", components: [{ expression: "8", damageTypeIds: ["damage-fire"], ignoreImmunity: true, ignoreReductionExpression: "3" }] }, p);
    expect(next.combatants.a!.currentHp).toBe(4);
  });
  it("permite ações de HP e condições sem revelar valores ocultos", () => {
    let s = scene(); const c = s.combatants.a!;
    c.settings.visibility.identity.mode = "ALL"; c.settings.visibility.conditions.mode = "GM";
    c.markers[0]!.audience.mode = "GM"; c.markers[0]!.display = "HIDDEN";
    c.settings.permissions.damage = [p.id]; c.settings.permissions.conditions = [p.id];
    s.conditionDefinitions = [{ id: "secret", name: "Segredo", maximumStacks: 2, effects: [] }];
    s = executeCommand(s, { type: "damage", tokenId: "a", components: [{ expression: "3", damageTypeIds: [], ignoreImmunity: false }] }, p);
    s = executeCommand(s, { type: "condition", tokenId: "a", definitionId: "secret" }, p);
    expect(s.combatants.a!.currentHp).toBe(7);
    expect(markerVisible(s.combatants.a!.markers[0]!, s.combatants.a!, p)).toBe(false);
    expect(visibleHistory(s, p).every((entry) => !entry.summary.includes("3") && !entry.summary.includes("Segredo"))).toBe(true);
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
    s = saveConditionDefinition(s, { id: "poison", name: "Veneno", maximumStacks: 1, effects: [{ id: "x", trigger: "TURN_END", kind: "DAMAGE", expression: "2", damageTypeIds: [], multiplyByStacks: false, ignoreImmunity: false }] });
    s = saveConditionDefinition(s, { id: "regen", name: "Regeneração", maximumStacks: 1, duration: { ticks: 2, decrementOn: "TURN_START" }, effects: [{ id: "y", trigger: "TURN_START", kind: "HEAL", expression: "1", damageTypeIds: [], multiplyByStacks: false, ignoreImmunity: false }] });
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
    c.settings.owners = [p.id]; c.settings.visibility.identity.mode = "ALL"; c.settings.permissions.endTurn = [p.id];
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
    s = executeCommand(s, { type: "damage", tokenId: "a", components: [{ expression: "3", damageTypeIds: [], ignoreImmunity: false }] }, gm);
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
  it("ajusta HP atual e máximo por expressão, valida o máximo e desfaz os dois", () => {
    let s = scene();
    s = executeCommand(s, { type: "hpAdjust", tokenId: "a", target: "CURRENT", expression: "=25" }, gm);
    const beforeMaximum = structuredClone(s);
    s = executeCommand(s, { type: "hpAdjust", tokenId: "a", target: "MAXIMUM", expression: "/2" }, gm);
    expect(s.combatants.a).toMatchObject({ currentHp: 25, maximumHp: 10 });
    expect(executeCommand(s, { type: "undo" }, gm).combatants.a).toMatchObject({ currentHp: beforeMaximum.combatants.a!.currentHp, maximumHp: 20 });
    expect(() => executeCommand(s, { type: "hpAdjust", tokenId: "a", target: "MAXIMUM", expression: "=0" }, gm)).toThrow("máximo");
    expect(() => executeCommand(s, { type: "hpAdjust", tokenId: "a", target: "MAXIMUM", expression: "/3" }, gm)).toThrow("inteiro");
  });
  it("migra permissões v3 e o snapshot de Undo para listas de responsáveis", () => {
    const source = oldState(3), a = source.combatants.a!;
    a.settings.permissions = { initiative: true, damage: true, heal: false, conditions: true, endTurn: true };
    (a.settings as unknown as { owners: string[] }).owners = [p.id];
    a.markers.find((marker) => marker.hp)!.editable = true;
    source.undo = { historyId: "undo", snapshot: { combatants: structuredClone(source.combatants), conditionDefinitions: source.conditionDefinitions, encounter: source.encounter, templates: source.templates } };
    const migrated = migrateLegacyState(source), permissions = migrated.combatants.a!.settings.permissions;
    expect(permissions).toEqual({ initiative: [p.id], damage: [p.id], heal: [], adjustCurrentHp: [p.id], adjustMaximumHp: [], conditions: [p.id], endTurn: [p.id] });
    expect(migrated.undo?.snapshot?.combatants.a!.settings.permissions.adjustCurrentHp).toEqual([p.id]);
  });
  it("preserva Undo legado v1 com acesso restrito", () => {
    const source = legacy();
    const oldCombatant = structuredClone(source.combatants.a);
    const value = { ...source, undo: { historyId: "undo", combatants: { a: oldCombatant }, activeTokenId: null } };
    const migrated = migrateLegacyState(value);
    expect(migrated.undo?.combatants?.a?.currentHp).toBe(10);
    expect(migrated.undo?.combatants?.a?.settings.permissions.adjustCurrentHp).toEqual([]);
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
