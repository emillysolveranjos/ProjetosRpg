import OBR, { isImage, type Item, type Metadata } from "@owlbear-rodeo/sdk";
import { PENDING_TOKEN_KEY, STATE_KEY } from "../config";
import type { RulebearSceneState, TokenView } from "../domain/types";
import type { OwlbearGateway, PendingToken, ThemeMode } from "./gateway";

function toTokens(items: Item[]): TokenView[] {
  const tokens: TokenView[] = [];
  for (const item of items) {
    if (!isImage(item) || item.layer !== "CHARACTER") continue;
    tokens.push({
      id: item.id,
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
