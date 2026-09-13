import type { RulebearSceneState, TokenView, Participant } from "../domain/types";
import { createEmptyState } from "../state/schema";
import { addCombatant } from "../domain/engine";
import { executeCommand, type CommandEnvelope } from "../domain/commands";
import { PROTOCOL_VERSION } from "./sync";
import type { OwlbearGateway, Role, ThemeMode } from "./gateway";
const tokens: TokenView[] = [{ id: "token-urso", name: "Urso-coruja" }, { id: "token-lina", name: "Lina, a Cinzenta" }, { id: "token-goblin", name: "Sentinela goblin" }];
export class MockOwlbearGateway implements OwlbearGateway {
  private state = addCombatant(addCombatant(createEmptyState(), "token-urso", 31, 48), "token-lina", 22, 28);
  private listeners = new Set<(value: unknown) => void>();
  private messages = new Set<(data: unknown, connectionId: string) => void>();
  private role: Role = new URLSearchParams(location.search).get("role") === "player" ? "PLAYER" : "GM";
  constructor() {
    for (const c of Object.values(this.state.combatants)) {
      c.settings.owners = ["player"];
      for (const a of Object.values(c.settings.visibility)) a.mode = "ALL";
      for (const m of c.markers) { m.audience.mode = "ALL"; m.editable = true; }
      c.settings.permissions = { initiative: ["player"], damage: ["player"], heal: ["player"], adjustCurrentHp: ["player"], adjustMaximumHp: ["player"], conditions: ["player"], endTurn: ["player"] };
    }
  }
  async ready() {}
  async getSelf(): Promise<Participant> { return { id: this.role === "GM" ? "gm" : "player", connectionId: "mock-user", name: "Você", role: this.role }; }
  async getParticipants(): Promise<Participant[]> { return [await this.getSelf(), { id: "gm", connectionId: "mock-gm", name: "Mestre", role: "GM" }, { id: "player", connectionId: "mock-player", name: "Jogador", role: "PLAYER" }]; }
  onParticipantsChange() { return () => {}; }
  async sendMessage(data: unknown) {
    const message = data as { type: string; envelope?: CommandEnvelope };
    if (message.type === "discover") this.messages.forEach((cb) => cb({ type: "presence", protocol: PROTOCOL_VERSION, session: "mock", ready: true, sceneReady: true }, "mock-gm"));
    if (message.type === "command" && message.envelope) {
      const env = message.envelope;
      try {
        if (env.revision !== this.state.revision) throw new Error("Estado mudou.");
        this.state = executeCommand(this.state, env.command, await this.getSelf());
        this.listeners.forEach((cb) => cb(this.state));
        this.messages.forEach((cb) => cb({ type: "result", protocol: PROTOCOL_VERSION, id: env.id, coordinator: "mock-gm/mock", ok: true }, "mock-gm"));
      } catch (error) { this.messages.forEach((cb) => cb({ type: "result", protocol: PROTOCOL_VERSION, id: env.id, coordinator: "mock-gm/mock", ok: false, message: String(error) }, "mock-gm")); }
    }
  }
  onMessage(callback: (data: unknown, connectionId: string) => void) { this.messages.add(callback); return () => this.messages.delete(callback); }
  getRoomId() { return "mock"; }
  async saveBackup() {}
  async readBackup() { return []; }
  async getTokenMetadata() { return {}; }
  async getRole() { return this.role; }
  async isSceneReady() { return new URLSearchParams(location.search).get("scene") !== "none"; }
  async readSceneState() { return structuredClone(this.state); }
  async writeSceneState(state: RulebearSceneState) { this.state = state; this.listeners.forEach((cb) => cb(state)); }
  onSceneStateChange(callback: (value: unknown) => void) { this.listeners.add(callback); return () => this.listeners.delete(callback); }
  onSceneReadyChange() { return () => {}; }
  async getCharacterTokens() { return tokens; }
  onItemsChange() { return () => {}; }
  async getSelectedToken() { return tokens[2] ?? null; }
  async consumePendingToken() { return null; }
  onPendingToken() { return () => {}; }
  async getThemeMode(): Promise<ThemeMode> { return "DARK"; }
  onThemeChange() { return () => {}; }
  async setBadge() {}
}
