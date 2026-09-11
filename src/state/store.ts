import { create } from "zustand";
import { cleanupMissingTokens } from "../domain/engine";
import type { RulebearSceneState, TokenView } from "../domain/types";
import type { OwlbearGateway, Role, ThemeMode } from "../owlbear/gateway";
import { createEmptyState, parseSceneState } from "./schema";

export type AppStatus = "LOADING" | "OUTSIDE" | "NO_SCENE" | "PLAYER" | "READY" | "INVALID";

interface AppStore {
  gateway?: OwlbearGateway;
  status: AppStatus;
  role: Role;
  theme: ThemeMode;
  state: RulebearSceneState;
  tokens: TokenView[];
  pendingTokenId?: string;
  error?: string;
  notice?: string;
  initialize(gateway?: OwlbearGateway): Promise<() => void>;
  refreshScene(): Promise<void>;
  persist(next: RulebearSceneState, notice?: string): Promise<void>;
  requestSelectedToken(): Promise<void>;
  setPendingToken(tokenId?: string): void;
  clearMessage(): void;
}

function readState(value: unknown): { state: RulebearSceneState; invalid: boolean } {
  if (value === undefined || value === null) return { state: createEmptyState(), invalid: false };
  const parsed = parseSceneState(value);
  return { state: parsed, invalid: false };
}

export const useAppStore = create<AppStore>((set, get) => ({
  status: "LOADING",
  role: "PLAYER",
  theme: "DARK",
  state: createEmptyState(),
  tokens: [],

  async initialize(gateway) {
    if (!gateway) {
      set({ status: "OUTSIDE" });
      return () => undefined;
    }
    set({ gateway, status: "LOADING" });
    await gateway.ready();
    const [role, theme] = await Promise.all([gateway.getRole(), gateway.getThemeMode()]);
    set({ role, theme });
    document.documentElement.dataset.theme = theme.toLowerCase();
    await get().refreshScene();

    const unsubscribers = [
      gateway.onSceneReadyChange(() => { void get().refreshScene(); }),
      gateway.onSceneStateChange((value) => {
        if (get().role !== "GM") return;
        try {
          const { state } = readState(value);
          set({ state, status: get().role === "GM" ? "READY" : "PLAYER", error: undefined });
          void gateway.setBadge(Object.keys(state.combatants).length);
        } catch {
          set({ status: "INVALID", error: "A metadata da Rulebear nesta cena é inválida. Ela não foi sobrescrita." });
        }
      }),
      gateway.onItemsChange((tokens) => {
        if (get().role !== "GM") return;
        set({ tokens });
        if (get().role !== "GM" || get().status !== "READY") return;
        const current = get().state;
        const next = cleanupMissingTokens(current, new Set(tokens.map((token) => token.id)));
        if (next !== current) void get().persist(next, "Token removido da cena; combatente removido da Rulebear.");
      }),
      gateway.onThemeChange((themeMode) => {
        document.documentElement.dataset.theme = themeMode.toLowerCase();
        set({ theme: themeMode });
      }),
      gateway.onPendingToken((tokenId) => set({ pendingTokenId: tokenId })),
    ];
    const pendingTokenId = await gateway.consumePendingToken();
    if (pendingTokenId) set({ pendingTokenId });
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  },

  async refreshScene() {
    const { gateway, role } = get();
    if (!gateway) return;
    const ready = await gateway.isSceneReady();
    if (!ready) {
      set({ status: "NO_SCENE", tokens: [], state: createEmptyState() });
      await gateway.setBadge(0);
      return;
    }
    if (role !== "GM") {
      set({ status: "PLAYER", tokens: [], state: createEmptyState(), error: undefined });
      await gateway.setBadge(0);
      return;
    }
    try {
      const [value, tokens] = await Promise.all([gateway.readSceneState(), gateway.getCharacterTokens()]);
      const { state } = readState(value);
      const cleaned = cleanupMissingTokens(state, new Set(tokens.map((token) => token.id)));
      set({ state: cleaned, tokens, status: "READY", error: undefined });
      if (cleaned !== state) await gateway.writeSceneState(cleaned);
      await gateway.setBadge(Object.keys(cleaned.combatants).length);
    } catch {
      set({ status: "INVALID", error: "A metadata da Rulebear nesta cena é inválida. Ela não foi sobrescrita." });
    }
  },

  async persist(next, notice) {
    const { gateway, state: previous } = get();
    if (!gateway) return;
    try {
      const checked = parseSceneState(next);
      set({ state: checked, notice, error: undefined });
      await gateway.writeSceneState(checked);
      await gateway.setBadge(Object.keys(checked.combatants).length);
    } catch (error) {
      set({ state: previous, error: error instanceof Error ? error.message : "Não foi possível salvar a cena." });
      throw error;
    }
  },

  async requestSelectedToken() {
    const { gateway, state } = get();
    if (!gateway) return;
    const token = await gateway.getSelectedToken();
    if (!token) {
      set({ error: "Selecione exatamente um token da camada Personagem." });
      return;
    }
    if (state.combatants[token.id]) {
      set({ error: "Este token já está na Rulebear." });
      return;
    }
    set({ pendingTokenId: token.id, error: undefined });
  },

  setPendingToken(tokenId) {
    set({ pendingTokenId: tokenId });
  },

  clearMessage() { set({ error: undefined, notice: undefined }); },
}));
