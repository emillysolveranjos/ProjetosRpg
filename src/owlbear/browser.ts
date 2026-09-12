import OBR, { isImage, type Item, type Metadata } from "@owlbear-rodeo/sdk";
import { PENDING_TOKEN_KEY, STATE_KEY } from "../config";
import type { RulebearSceneState, TokenView, Participant } from "../domain/types";
import type { OwlbearGateway, PendingToken, ThemeMode } from "./gateway";

function toTokens(items: Item[]): TokenView[] {
  const tokens: TokenView[] = [];
  for (const item of items) {
    if (!isImage(item) || item.layer !== "CHARACTER") continue;
    tokens.push({
      id: item.id,
      visible: item.visible,
      name: item.name.trim() || "Token sem nome",
      ...(item.image.url ? { imageUrl: item.image.url } : {}),
    });
  }
  return tokens;
}

function pendingFrom(metadata: Metadata): PendingToken | null {
  const value = metadata[PENDING_TOKEN_KEY];
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PendingToken>;
  return typeof candidate.tokenId === "string" && typeof candidate.nonce === "string"
    ? { tokenId: candidate.tokenId, nonce: candidate.nonce }
    : null;
}

export class BrowserOwlbearGateway implements OwlbearGateway {
  async getSelf(): Promise<Participant> {
    return { id: await OBR.player.getId(), connectionId: await OBR.player.getConnectionId(), name: await OBR.player.getName(), role: await OBR.player.getRole() };
  }
  async getParticipants() { return [await this.getSelf(), ...await OBR.party.getPlayers()]; }
  onParticipantsChange(callback: () => void) {
    let previous = "";
    const notify = async () => {
      const participants = await this.getParticipants();
      const next = JSON.stringify(participants.map((p) => [p.id, p.connectionId, p.name, p.role]).sort());
      if (next !== previous) { previous = next; callback(); }
    };
    void notify();
    const a = OBR.party.onChange(() => void notify()), b = OBR.player.onChange(() => void notify());
    return () => { a(); b(); };
  }
  sendMessage(data: unknown) { return OBR.broadcast.sendMessage("io.github.samuelsanjos.rulebear/v2", data, { destination: "ALL" }); }
  onMessage(callback: (data: unknown, connectionId: string) => void) {
    return OBR.broadcast.onMessage("io.github.samuelsanjos.rulebear/v2", (event) => callback(event.data, event.connectionId));
  }
  getRoomId() { return OBR.room.id; }
  async saveBackup(value: unknown) {
    // Keep every migrated scene, rather than overwriting another scene's backup in this room.
    const key = STATE_KEY + "/backup/" + OBR.room.id;
    const previous = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
    const text = JSON.stringify(value);
    if (!previous.some((x) => JSON.stringify(x) === text)) previous.push(value);
    localStorage.setItem(key, JSON.stringify(previous));
  }
  async readBackup(): Promise<unknown> { return JSON.parse(localStorage.getItem(STATE_KEY + "/backup/" + OBR.room.id) ?? "[]"); }
  async getTokenMetadata(tokenId: string) { return (await OBR.scene.items.getItems([tokenId]))[0]?.metadata ?? {}; }
  async ready(): Promise<void> {
    if (OBR.isReady) return;
    await new Promise<void>((resolve) => OBR.onReady(resolve));
  }

  getRole() { return OBR.player.getRole(); }
  isSceneReady() { return OBR.scene.isReady(); }
  onSceneReadyChange(callback: (ready: boolean) => void) { return OBR.scene.onReadyChange(callback); }

  async readSceneState(): Promise<unknown> {
    return (await OBR.scene.getMetadata())[STATE_KEY];
  }

  async writeSceneState(state: RulebearSceneState): Promise<void> {
    await OBR.scene.setMetadata({ [STATE_KEY]: state });
  }

  onSceneStateChange(callback: (value: unknown) => void): () => void {
    return OBR.scene.onMetadataChange((metadata) => callback(metadata[STATE_KEY]));
  }

  async getCharacterTokens(): Promise<TokenView[]> {
    return toTokens(await OBR.scene.items.getItems());
  }

  onItemsChange(callback: (tokens: TokenView[]) => void): () => void {
    return OBR.scene.items.onChange((items) => callback(toTokens(items)));
  }

  async getSelectedToken(): Promise<TokenView | null> {
    const selected = await OBR.player.getSelection();
    if (!selected || selected.length !== 1) return null;
    const items = await OBR.scene.items.getItems((item) => item.id === selected[0]);
    return toTokens(items)[0] ?? null;
  }

  async consumePendingToken(): Promise<string | null> {
    const pending = pendingFrom(await OBR.player.getMetadata());
    if (!pending) return null;
    await OBR.player.setMetadata({ [PENDING_TOKEN_KEY]: null });
    return pending.tokenId;
  }

  onPendingToken(callback: (tokenId: string) => void): () => void {
    let lastNonce = "";
    return OBR.player.onChange((player) => {
      const pending = pendingFrom(player.metadata);
      if (!pending || pending.nonce === lastNonce) return;
      lastNonce = pending.nonce;
      callback(pending.tokenId);
      void OBR.player.setMetadata({ [PENDING_TOKEN_KEY]: null });
    });
  }

  async getThemeMode(): Promise<ThemeMode> {
    return (await OBR.theme.getTheme()).mode;
  }

  onThemeChange(callback: (mode: ThemeMode) => void): () => void {
    return OBR.theme.onChange((theme) => callback(theme.mode));
  }

  async setBadge(count: number): Promise<void> {
    await OBR.action.setBadgeText(count > 0 ? String(count) : undefined);
    await OBR.action.setBadgeBackgroundColor("#d97706");
  }
}

export function isInsideOwlbear(): boolean {
  return OBR.isAvailable;
}
