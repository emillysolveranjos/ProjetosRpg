import type { OwlbearGateway } from "./gateway";
import type { Participant, RulebearSceneState } from "../domain/types";
import { executeCommand, type Command, type CommandEnvelope } from "../domain/commands";
import { createEmptyState, isLegacyState, migrateLegacyState, parseSceneState } from "../state/schema";
export const CHANNEL = "io.github.samuelsanjos.rulebear/v2";
export interface Peer { connectionId: string; session: string; seen: number; ready: boolean }
export function elect(peers: Peer[], participants: Participant[], now = Date.now()): Peer | undefined {
  return peers.filter((p) => now - p.seen < 6500 && participants.some((u) => u.connectionId === p.connectionId && u.role === "GM")).sort((a, b) => a.connectionId.localeCompare(b.connectionId))[0];
}
export class CommandProcessor {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private gateway: OwlbearGateway, private isCurrent: () => boolean) {}
  process(envelope: CommandEnvelope, actor: Participant): Promise<void> {
    const action = this.queue.then(async () => {
      if (!this.isCurrent()) throw new Error("Coordenador mudou. Aguarde a sincronização.");
      if (!await this.gateway.isSceneReady()) throw new Error("A cena está indisponível.");
      const state = parseSceneState(await this.gateway.readSceneState());
      if (state.sceneId !== envelope.sceneId) throw new Error("A cena mudou.");
      if (state.receipts.includes(envelope.id)) return;
      if (state.revision !== envelope.revision) throw new Error("O encontro mudou. Confira os valores e tente novamente.");
      // Re-resolve identity and role at execution, not when the command was queued.
      const fresh = (await this.gateway.getParticipants()).find((p) => p.connectionId === actor.connectionId);
      if (!fresh) throw new Error("Participante desconectado.");
      if (envelope.command.type === "add") {
        const tokenId = envelope.command.tokenId;
        const tokens = await this.gateway.getCharacterTokens();
        if (!tokens.some((t) => t.id === tokenId)) throw new Error("Token indisponível.");
      }
      const next = executeCommand(state, envelope.command, fresh);
      next.receipts = [...state.receipts, envelope.id].slice(-100);
      if (!this.isCurrent()) throw new Error("Aguarde o novo coordenador.");
      if (!await this.gateway.isSceneReady()) throw new Error("A cena mudou.");
      const latest = parseSceneState(await this.gateway.readSceneState());
      if (latest.sceneId !== state.sceneId || latest.revision !== state.revision || !this.isCurrent()) throw new Error("O encontro mudou durante a ação. Confira o estado.");
      await this.gateway.writeSceneState(next);
    });
    this.queue = action.catch(() => {});
    return action;
  }
}
function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;
}
export function startCoordinator(gateway: OwlbearGateway): () => void {
  let alive = true, ready = false, initializing = false, selected = "", changedAt = Date.now(), generation = 0;
  let self: Participant | undefined, participants: Participant[] = [];
  const session = crypto.randomUUID();
  const peers = new Map<string, Peer>();
  let ticks = Promise.resolve();
  const token = () => self ? self.connectionId + "/" + session : "";
  const current = () => alive && ready && selected === token();
  const processor = new CommandProcessor(gateway, current);
  const send = (data: unknown) => gateway.sendMessage(data).catch(() => {});
  async function refresh() {
    if (!alive) return;
    participants = await gateway.getParticipants();
    self = await gateway.getSelf();
    const sceneReady = await gateway.isSceneReady();
    if (!sceneReady || self.role !== "GM") { ready = false; peers.delete(self.connectionId); }
    else peers.set(self.connectionId, { connectionId: self.connectionId, session, seen: Date.now(), ready });
    const leader = elect([...peers.values()], participants);
    const next = sceneReady && leader ? leader.connectionId + "/" + leader.session : "";
    if (next !== selected) { selected = next; changedAt = Date.now(); ready = false; }
    if (sceneReady && selected === token() && Date.now() - changedAt >= 2200 && !ready && !initializing) {
      initializing = true;
      const version = generation;
      const valid = () => alive && version === generation && selected === token();
      try {
        const raw = await gateway.readSceneState();
        if (!raw && valid()) await gateway.writeSceneState(createEmptyState());
        else if (isLegacyState(raw)) {
          const migrated = migrateLegacyState(raw);
          await gateway.saveBackup(raw);
          if (valid() && await gateway.isSceneReady()) await gateway.writeSceneState(migrated);
        } else parseSceneState(raw);
        if (valid()) ready = true;
      } catch (error) {
        await send({ type: "coordinatorError", message: error instanceof Error ? error.message : "Não foi possível abrir a cena." });
      } finally { initializing = false; }
    }
    if (current()) {
      const state = parseSceneState(await gateway.readSceneState());
      const tokens = await gateway.getCharacterTokens();
      const missing = Object.keys(state.combatants).filter((id) => !tokens.some((t) => t.id === id));
      if (missing.length) await processor.process({ id: crypto.randomUUID(), coordinator: token(), sceneId: state.sceneId, revision: state.revision, command: { type: "prune", tokenIds: missing } }, self);
    }
    await send({ type: "presence", session, ready: current(), sceneReady, role: self.role });
  }
  const unsubscribe = gateway.onMessage((data, connectionId) => {
    const message = object(data);
    if (!message) return;
    if (message.type === "presence" && typeof message.session === "string") {
      if (message.sceneReady) peers.set(connectionId, { connectionId, session: message.session, seen: Date.now(), ready: message.ready === true });
      else peers.delete(connectionId);
    }
    if (message.type === "discover") void send({ type: "presence", session, ready: current(), sceneReady: !!selected });
    if (message.type === "command" && current()) {
      const envelope = message.envelope as CommandEnvelope | undefined;
      if (!envelope || typeof envelope.id !== "string" || envelope.id.length > 200 || envelope.coordinator !== token() || !object(envelope.command)) return;
      const actor = participants.find((p) => p.connectionId === connectionId);
      if (!actor) return;
      void processor.process(envelope, actor).then(
        () => send({ type: "result", id: envelope.id, coordinator: token(), ok: true }),
        (error: unknown) => send({ type: "result", id: envelope.id, coordinator: token(), ok: false, message: error instanceof Error ? error.message : "Não foi possível aplicar a ação." }),
      );
    }
  });
  const tick = () => { ticks = ticks.then(refresh).catch(() => { ready = false; }); };
  const timer = setInterval(tick, 1500);
  const unready = gateway.onSceneReadyChange(() => { generation++; ready = false; selected = ""; peers.clear(); changedAt = Date.now(); tick(); });
  const unparty = gateway.onParticipantsChange(() => { generation++; ready = false; tick(); });
  tick();
  return () => { generation++; alive = false; ready = false; clearInterval(timer); unsubscribe(); unready(); unparty(); };
}
export class CommandClient {
  private peers = new Map<string, Peer>();
  private pending = new Map<string, { resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>; coordinator: string }>();
  private participants: Participant[] = [];
  private leader?: Peer;
  private timer: ReturnType<typeof setInterval>;
  private unsubscribe: () => void;
  constructor(private gateway: OwlbearGateway, private onStatus: (online: boolean) => void, private onError?: (message: string) => void) {
    this.unsubscribe = gateway.onMessage((data, connectionId) => {
      const message = object(data);
      if (!message) return;
      if (message.type === "presence" && typeof message.session === "string") {
        if (message.sceneReady) this.peers.set(connectionId, { connectionId, session: message.session, ready: message.ready === true, seen: Date.now() });
        else this.peers.delete(connectionId);
        void this.refresh();
      }
      if (message.type === "coordinatorError" && this.leader?.connectionId === connectionId) {
        void this.gateway.getSelf().then((self) => {
          if (self.role === "GM") this.onError?.("Não foi possível preparar a cena ou salvar o backup. Confira o armazenamento do navegador e os dados da cena.");
        });
      }
      if (message.type === "result" && typeof message.id === "string") {
        const item = this.pending.get(message.id);
        if (!item || item.coordinator !== message.coordinator || !item.coordinator.startsWith(connectionId + "/")) return;
        clearTimeout(item.timer); this.pending.delete(message.id);
        if (message.ok === true) item.resolve(); else item.reject(new Error(String(message.message)));
      }
    });
    this.timer = setInterval(() => void this.refresh(), 1500);
    void gateway.sendMessage({ type: "discover" }).catch(() => {});
    void this.refresh();
  }
  private async refresh() {
    try {
      this.participants = await this.gateway.getParticipants();
      this.leader = elect([...this.peers.values()], this.participants);
      this.onStatus(!!this.leader?.ready);
    } catch { this.leader = undefined; this.onStatus(false); }
  }
  async dispatch(state: RulebearSceneState, command: Command): Promise<void> {
    await this.refresh();
    if (!this.leader?.ready) throw new Error("Aguarde um mestre conectado e a sincronização.");
    const coordinator = this.leader.connectionId + "/" + this.leader.session;
    const envelope: CommandEnvelope = { id: crypto.randomUUID(), sceneId: state.sceneId, revision: state.revision, coordinator, command };
    if (new TextEncoder().encode(JSON.stringify(envelope)).length > 15000) throw new Error("Esta alteração é grande demais. Salve em partes.");
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(envelope.id);
        reject(new Error("A confirmação não chegou. Confira o estado antes de tentar novamente; a ação não será repetida automaticamente."));
      }, 9000);
      this.pending.set(envelope.id, { resolve, reject, timer, coordinator });
      void this.gateway.sendMessage({ type: "command", envelope }).catch((error: unknown) => {
        clearTimeout(timer); this.pending.delete(envelope.id);
        reject(error instanceof Error ? error : new Error("Falha ao enviar a ação."));
      });
    });
  }
  dispose() {
    clearInterval(this.timer); this.unsubscribe();
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error("A conexão foi encerrada.")); }
    this.pending.clear();
  }
}
