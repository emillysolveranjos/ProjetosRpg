import { create } from "zustand";
import type { RulebearSceneState, TokenView, Participant, DisplayPreferences } from "../domain/types";
import type { OwlbearGateway, Role, ThemeMode } from "../owlbear/gateway";
import { createEmptyState, parseSceneState, isLegacyState, migrateLegacyState } from "./schema";
import { CommandClient } from "../owlbear/sync";
import type { Command } from "../domain/commands";
import { readPreferences, savePreferences } from "./preferences";
export type AppStatus = "LOADING" | "OUTSIDE" | "NO_SCENE" | "READY" | "INVALID";
interface AppStore {
  gateway?: OwlbearGateway; status: AppStatus; role: Role; theme: ThemeMode; self?: Participant;
  participants: Participant[]; online: boolean; busy: boolean; state: RulebearSceneState; tokens: TokenView[];
  preferences: DisplayPreferences; pendingTokenId?: string; error?: string; notice?: string;
  initialize(gateway?: OwlbearGateway): Promise<() => void>;
  refreshScene(): Promise<void>; command(command: Command, revision?: number): Promise<boolean>;
  requestSelectedToken(): Promise<void>; setPendingToken(tokenId?: string): void; clearMessage(): void;
  setPreferences(value: DisplayPreferences): void;
}
let client: CommandClient | undefined;
export const useAppStore = create<AppStore>((set, get) => ({
  status: "LOADING", role: "PLAYER", theme: "DARK", participants: [], online: false, busy: false,
  state: createEmptyState(), tokens: [], preferences: { position: "BOTTOM", horizontal: "CENTER", size: "MEDIUM", overrides: {} },
  async initialize(gateway) {
    client?.dispose(); client = undefined;
    if (!gateway) { set({ status: "OUTSIDE" }); return () => {}; }
    set({ gateway, status: "LOADING", online: false, busy: false, error: undefined });
    await gateway.ready();
    const [self, theme, participants] = await Promise.all([gateway.getSelf(), gateway.getThemeMode(), gateway.getParticipants()]);
    set({ self, role: self.role, theme, participants, preferences: readPreferences(gateway.getRoomId(), self.id) });
    document.documentElement.dataset.theme = theme.toLowerCase();
    const instance = new CommandClient(gateway, (online) => set({ online }), (error) => set({ error }));
    client = instance;
    await get().refreshScene();
    const updateParty = async () => {
      const [nextSelf, nextParty] = await Promise.all([gateway.getSelf(), gateway.getParticipants()]);
      set({ self: nextSelf, role: nextSelf.role, participants: nextParty });
    };
    const unsubscribers = [
      gateway.onSceneReadyChange(() => { set({ online: false, pendingTokenId: undefined }); void get().refreshScene(); }),
      gateway.onSceneStateChange(() => void get().refreshScene()),
      gateway.onItemsChange((tokens) => set({ tokens })),
      gateway.onParticipantsChange(() => void updateParty().catch(() => set({ online: false }))),
      gateway.onThemeChange((theme) => { document.documentElement.dataset.theme = theme.toLowerCase(); set({ theme }); }),
      gateway.onPendingToken((tokenId) => { if (get().role === "GM") set({ pendingTokenId: tokenId }); }),
    ];
    const pending = await gateway.consumePendingToken();
    if (pending && self.role === "GM") set({ pendingTokenId: pending });
    return () => { unsubscribers.forEach((off) => off()); instance.dispose(); if (client === instance) client = undefined; };
  },
  async refreshScene() {
    const { gateway } = get(); if (!gateway) return;
    if (!await gateway.isSceneReady()) { set({ status: "NO_SCENE", tokens: [], state: createEmptyState(), online: false }); return; }
    try {
      const [raw, tokens] = await Promise.all([gateway.readSceneState(), gateway.getCharacterTokens()]);
      const state = raw ? isLegacyState(raw) ? migrateLegacyState(raw) : parseSceneState(raw) : createEmptyState();
      set({ state, tokens, status: "READY" });
      // A generic badge cannot reveal the number of hidden combatants to players.
      await gateway.setBadge(0);
    } catch { set({ status: "INVALID", online: false, error: "Os dados da cena são inválidos ou de outra versão. Eles não foram sobrescritos." }); }
  },
  async command(command, revision) {
    if (!client || get().busy) return false;
    set({ busy: true, error: undefined, notice: undefined });
    try {
      await client.dispatch({ ...get().state, revision: revision ?? get().state.revision }, command);
      await get().refreshScene();
      set({ notice: "Alteração salva." });
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Não foi possível aplicar a ação." });
      return false;
    } finally { set({ busy: false }); }
  },
  async requestSelectedToken() {
    const { gateway, state, role } = get(); if (!gateway || role !== "GM") return;
    const token = await gateway.getSelectedToken();
    if (!token) { set({ error: "Selecione exatamente um token da camada Personagem." }); return; }
    if (state.combatants[token.id]) { set({ error: "Este token já está na Rulebear." }); return; }
    set({ pendingTokenId: token.id });
  },
  setPendingToken(pendingTokenId) { set({ pendingTokenId }); },
  clearMessage() { set({ error: undefined, notice: undefined }); },
  setPreferences(preferences) {
    const { self, gateway } = get(); if (!self || !gateway) return;
    try {
      savePreferences(gateway.getRoomId(), self.id, preferences); set({ preferences });
      void gateway.sendMessage({ type: "preferences", playerId: self.id }).catch(() => {});
    } catch { set({ error: "Não foi possível salvar a preferência neste navegador." }); }
  },
}));
