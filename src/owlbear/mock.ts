import type { RulebearSceneState, TokenView } from "../domain/types";
import { createEmptyState } from "../state/schema";
import type { OwlbearGateway, Role, ThemeMode } from "./gateway";

const tokens: TokenView[] = [
  { id: "token-urso", name: "Urso-coruja", imageUrl: "https://images.unsplash.com/photo-1589656966895-2f33e7653819?auto=format&fit=crop&w=160&q=80" },
  { id: "token-lina", name: "Lina, a Cinzenta", imageUrl: "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=160&q=80" },
  { id: "token-goblin", name: "Sentinela goblin", imageUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=160&q=80" },
];

const initialState: RulebearSceneState = {
  ...createEmptyState(),
  revision: 4,
  combatants: {
    "token-urso": { tokenId: "token-urso", currentHp: 31, maximumHp: 48, reductions: [{ id: "fur", label: "Pelagem espessa", amount: 2, categories: ["FÍSICO"] }], conditions: [] },
    "token-lina": { tokenId: "token-lina", currentHp: 22, maximumHp: 28, reductions: [], conditions: [] },
  },
};

export class MockOwlbearGateway implements OwlbearGateway {
  private state = structuredClone(initialState);
  private metadataListeners = new Set<(value: unknown) => void>();
  private itemListeners = new Set<(value: TokenView[]) => void>();
  private theme: ThemeMode = matchMedia("(prefers-color-scheme: dark)").matches ? "DARK" : "LIGHT";
  private role: Role = new URLSearchParams(location.search).get("role") === "player" ? "PLAYER" : "GM";

  async ready() {}
  async getRole() { return this.role; }
  async isSceneReady() { return new URLSearchParams(location.search).get("scene") !== "none"; }
  async readSceneState() { return structuredClone(this.state); }
  async writeSceneState(state: RulebearSceneState) { this.state = structuredClone(state); this.metadataListeners.forEach((listener) => listener(this.state)); }
  onSceneStateChange(callback: (value: unknown) => void) { this.metadataListeners.add(callback); return () => this.metadataListeners.delete(callback); }
  onSceneReadyChange() { return () => undefined; }
  async getCharacterTokens() { return structuredClone(tokens); }
  onItemsChange(callback: (value: TokenView[]) => void) { this.itemListeners.add(callback); return () => this.itemListeners.delete(callback); }
  async getSelectedToken() { return tokens[2] ?? null; }
  async consumePendingToken() { return null; }
  onPendingToken() { return () => undefined; }
  async getThemeMode() { return this.theme; }
  onThemeChange() { return () => undefined; }
  async setBadge() {}
}
