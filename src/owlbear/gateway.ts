import type { RulebearSceneState, TokenView, Participant } from "../domain/types";

export type Role = "GM" | "PLAYER";
export type ThemeMode = "DARK" | "LIGHT";

export interface PendingToken {
  tokenId: string;
  nonce: string;
}

export interface OwlbearGateway {
  ready(): Promise<void>;
  getSelf(): Promise<Participant>;
  getParticipants(): Promise<Participant[]>;
  onParticipantsChange(callback: () => void): () => void;
  sendMessage(data: unknown): Promise<void>;
  onMessage(callback: (data: unknown, connectionId: string) => void): () => void;
  getRoomId(): string;
  saveBackup(value: unknown): Promise<void>;
  readBackup(): Promise<unknown>;
  getTokenMetadata(tokenId: string): Promise<Record<string, unknown>>;
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
