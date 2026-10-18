import type { RulebearSceneState, TokenView, Participant } from "../domain/types";

export type Role = "GM" | "PLAYER";
export type ThemeMode = "DARK" | "LIGHT";

/** Paleta do Owlbear, para o painel combinar com a interface da sala. */
export interface PanelTheme {
  mode: ThemeMode;
  primary: string;
  primaryContrast: string;
  background: string;
  paper: string;
  text: string;
  textSecondary: string;
}

// Valores usados fora do Owlbear (modo de demonstração e testes).
export const FALLBACK_THEMES: Record<ThemeMode, PanelTheme> = {
  DARK: { mode: "DARK", primary: "#bb99ff", primaryContrast: "rgba(0, 0, 0, 0.87)", background: "#1e2231", paper: "#222639", text: "#ffffff", textSecondary: "rgba(255, 255, 255, 0.7)" },
  LIGHT: { mode: "LIGHT", primary: "#7744dd", primaryContrast: "#ffffff", background: "#eef0f6", paper: "#ffffff", text: "rgba(0, 0, 0, 0.87)", textSecondary: "rgba(0, 0, 0, 0.6)" },
};

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
  getTheme(): Promise<PanelTheme>;
  onThemeChange(callback: (theme: PanelTheme) => void): () => void;
  setBadge(count: number): Promise<void>;
  /** Ajusta a altura do popover ao conteúdo, como as extensões oficiais. */
  setActionHeight(height: number): Promise<void>;
  /** Centraliza a câmera no token e, para o mestre, seleciona-o. */
  focusToken(tokenId: string): Promise<void>;
}
