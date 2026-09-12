import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandClient, CommandProcessor, elect, startCoordinator } from "../src/owlbear/sync";
import { addCombatant } from "../src/domain/engine";
import { createEmptyState, parseSceneState } from "../src/state/schema";
import type { CommandEnvelope } from "../src/domain/commands";
import { Network } from "./network";
afterEach(() => vi.useRealTimers());
function setup() {
  const n = new Network(), gm = n.join("gm", "GM"), p = n.join("p", "PLAYER");
  n.value = addCombatant(createEmptyState(), "a", 10, 20);
  const s = parseSceneState(n.value), c = s.combatants.a!;
  c.settings.owners = ["p"]; c.settings.visibility.identity.mode = "ALL"; c.settings.permissions.heal = true; n.value = s;
  const envelope = (id: string): CommandEnvelope => ({ id, sceneId: s.sceneId, revision: s.revision, coordinator: "gm/session", command: { type: "heal", tokenId: "a", amount: 2 } });
  return { n, gm, p, s, envelope };
}
describe("coordenação multiplayer", () => {
  it("serializa cliques simultâneos e rejeita estado antigo sem perder dados", async () => {
    const { n, gm, p, envelope } = setup(), processor = new CommandProcessor(gm, () => true);
    const results = await Promise.allSettled([processor.process(envelope("1"), p.self), processor.process(envelope("2"), p.self)]);
    expect(results[0]!.status).toBe("fulfilled"); expect(results[1]!.status).toBe("rejected");
    expect(parseSceneState(n.value).combatants.a!.currentHp).toBe(12); expect(n.writes).toBe(1);
  });
  it("deduplica inclusive depois de recriar o processador", async () => {
    const { n, gm, p, envelope } = setup();
    await new CommandProcessor(gm, () => true).process(envelope("same"), p.self);
    await new CommandProcessor(gm, () => true).process(envelope("same"), p.self);
    expect(n.writes).toBe(1);
  });
  it("falha de gravação não confirma nem muda a cena; fila pode continuar", async () => {
    const { n, gm, p, envelope } = setup(), processor = new CommandProcessor(gm, () => true);
    n.failWrite = true; await expect(processor.process(envelope("1"), p.self)).rejects.toThrow("Falha");
    expect(parseSceneState(n.value).combatants.a!.currentHp).toBe(10);
    n.failWrite = false; await processor.process(envelope("2"), p.self); expect(n.writes).toBe(1);
  });
  it("revalida papel, permissão e cena antes de executar", async () => {
    const { n, gm, p, envelope } = setup(), processor = new CommandProcessor(gm, () => true);
    const forged = { ...p.self, role: "GM" as const };
    await expect(processor.process({ ...envelope("1"), command: { type: "sort" } }, forged)).rejects.toThrow("exclusiva");
    n.ready = false; await expect(processor.process(envelope("2"), p.self)).rejects.toThrow("indisponível");
    n.ready = true; n.value = createEmptyState(); await expect(processor.process(envelope("3"), p.self)).rejects.toThrow("cena mudou");
  });
  it("não grava quando perde a coordenação", async () => {
    const { n, gm, p, envelope } = setup();
    await expect(new CommandProcessor(gm, () => false).process(envelope("1"), p.self)).rejects.toThrow("Coordenador");
    expect(n.writes).toBe(0);
  });
  it("eleição desconsidera jogadores, ausentes e presenças vencidas", () => {
    const { gm, p } = setup();
    const peers = [{ connectionId: "p", session: "x", seen: 9000, ready: true }, { connectionId: "gm", session: "y", seen: 9000, ready: true }];
    expect(elect(peers, [gm.self, p.self], 10000)?.connectionId).toBe("gm");
    expect(elect(peers, [gm.self], 20000)).toBeUndefined();
    expect(elect(peers, [p.self], 10000)).toBeUndefined();
  });
  it("background processa ação com painel do mestre fechado e troca de coordenador", async () => {
    vi.useFakeTimers();
    const { n, gm, p } = setup(), gm2 = n.join("z-gm", "GM");
    const stop = startCoordinator(gm), stop2 = startCoordinator(gm2);
    let online = false; const client = new CommandClient(p, (value) => { online = value; });
    await vi.advanceTimersByTimeAsync(6500);
    expect(online).toBe(true);
    await client.dispatch(parseSceneState(n.value), { type: "heal", tokenId: "a", amount: 1 });
    expect(parseSceneState(n.value).combatants.a!.currentHp).toBe(11);
    stop(); n.gateways = n.gateways.filter((g) => g !== gm);
    await vi.advanceTimersByTimeAsync(6500);
    await client.dispatch(parseSceneState(n.value), { type: "heal", tokenId: "a", amount: 1 });
    expect(parseSceneState(n.value).combatants.a!.currentHp).toBe(12);
    stop2(); n.gateways = [p]; await vi.advanceTimersByTimeAsync(2000);
    expect(online).toBe(false); await expect(client.dispatch(parseSceneState(n.value), { type: "sort" })).rejects.toThrow("mestre");
    client.dispose();
  });
  it("migra só depois de salvar backup e preserva v1 quando backup falha", async () => {
    vi.useFakeTimers();
    const n = new Network(), gm = n.join("gm", "GM");
    const legacy = { schemaVersion: 1, revision: 0, combatants: {}, conditionDefinitions: [], history: [] };
    n.value = legacy; n.failBackup = true;
    const stop = startCoordinator(gm); await vi.advanceTimersByTimeAsync(6500);
    expect(n.value).toEqual(legacy); expect(n.writes).toBe(0);
    n.failBackup = false; await vi.advanceTimersByTimeAsync(2000);
    expect(n.backups).toEqual([legacy]); expect(parseSceneState(n.value).schemaVersion).toBe(2);
    stop();
  });
  it("não repete automaticamente uma ação sem confirmação", async () => {
    vi.useFakeTimers();
    const { n, gm, p } = setup(); let count = 0;
    gm.onMessage((data) => { if ((data as { type: string }).type === "command") count++; });
    const client = new CommandClient(p, () => {});
    await gm.sendMessage({ type: "presence", session: "session", ready: true, sceneReady: true });
    const request = client.dispatch(parseSceneState(n.value), { type: "heal", tokenId: "a", amount: 1 });
    const result = expect(request).rejects.toThrow("não será repetida");
    await vi.advanceTimersByTimeAsync(10000); await result; expect(count).toBe(1); client.dispose();
  });
});
