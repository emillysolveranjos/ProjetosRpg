import type { OwlbearGateway, ThemeMode } from "../src/owlbear/gateway";
import type { Participant, RulebearSceneState, TokenView } from "../src/domain/types";
import { createEmptyState } from "../src/state/schema";
export class Network {
  value: unknown = createEmptyState();
  ready = true; failWrite = false; failBackup = false; backups: unknown[] = []; writes = 0;
  tokens: TokenView[] = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
  gateways: MemoryGateway[] = [];
  join(id: string, role: Participant["role"]) { const gateway = new MemoryGateway(this, { id, connectionId: id, role, name: id }); this.gateways.push(gateway); return gateway; }
}
export class MemoryGateway implements OwlbearGateway {
  messages = new Set<(data: unknown, connectionId: string) => void>();
  states = new Set<(data: unknown) => void>();
  parties = new Set<() => void>();
  constructor(public network: Network, public self: Participant) {}
  async ready() {}
  async getSelf() { return { ...this.self }; }
  async getRole() { return this.self.role; }
  async getParticipants() { return this.network.gateways.map((g) => ({ ...g.self })); }
  onParticipantsChange(cb: () => void) { this.parties.add(cb); return () => this.parties.delete(cb); }
  async sendMessage(data: unknown) { for (const g of this.network.gateways) for (const cb of g.messages) cb(structuredClone(data), this.self.connectionId); }
  onMessage(cb: (data: unknown, connectionId: string) => void) { this.messages.add(cb); return () => this.messages.delete(cb); }
  getRoomId() { return "room"; }
  async saveBackup(value: unknown) { if (this.network.failBackup) throw new Error("Backup indisponível"); this.network.backups.push(structuredClone(value)); }
  async readBackup() { return this.network.backups; }
  async getTokenMetadata() { return {}; }
  async isSceneReady() { return this.network.ready; }
  async readSceneState() { return structuredClone(this.network.value); }
  async writeSceneState(value: RulebearSceneState) { if (this.network.failWrite) throw new Error("Falha ao salvar"); this.network.value = structuredClone(value); this.network.writes++; for (const g of this.network.gateways) for (const cb of g.states) cb(value); }
  onSceneStateChange(cb: (value: unknown) => void) { this.states.add(cb); return () => this.states.delete(cb); }
  onSceneReadyChange() { return () => {}; }
  async getCharacterTokens() { return this.network.tokens; }
  onItemsChange() { return () => {}; }
  async getSelectedToken() { return this.network.tokens[0] ?? null; }
  async consumePendingToken() { return null; }
  onPendingToken() { return () => {}; }
  async getThemeMode(): Promise<ThemeMode> { return "DARK"; }
  onThemeChange() { return () => {}; }
  async setBadge() {}
}
