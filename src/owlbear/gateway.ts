import type { RulebearSceneState, TokenView } from "../domain/types";

export type Role = "GM" | "PLAYER";
export type ThemeMode = "DARK" | "LIGHT";

export interface PendingToken {
  tokenId: string;
  nonce: string;
}

export interface OwlbearGateway {
  ready(): Promise<void>;
  getRole(): Promise<Role>;
  isSceneReady(): Promise<boolean>;
  readSceneState(): Promise<unknown>;
  writeSceneState(state: RulebearSceneState): Promise<void>;
  onSceneStateChange(callback: (value: unknown) => void): () => void;
  onSceneReadyChange(callback: (ready: boolean) => void): () => void;
  getCharacterTokens(): Promise<TokenView[]>;
  onItemsChange(callback: (tokens: TokenView[]) => void): () => void;
  getSelectedToken(): Promise<TokenView | null>;
  consumePendingToken(): Promise<string | null>;
  onPendingToken(callback: (tokenId: string) => void): () => void;
  getThemeMode(): Promise<ThemeMode>;
  onThemeChange(callback: (mode: ThemeMode) => void): () => void;
  setBadge(count: number): Promise<void>;
}
