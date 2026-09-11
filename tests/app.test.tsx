import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/action/App";
import type { RulebearSceneState, TokenView } from "../src/domain/types";
import type { OwlbearGateway, Role, ThemeMode } from "../src/owlbear/gateway";
import { createEmptyState } from "../src/state/schema";
import { useAppStore } from "../src/state/store";

class FakeGateway implements OwlbearGateway {
  role: Role = "GM";
  readyScene = true;
  value: unknown = createEmptyState();
  tokens: TokenView[] = [];
  readCount = 0;
  metadataCallback?: (value: unknown) => void;
  async ready() {}
  async getRole() { return this.role; }
  async isSceneReady() { return this.readyScene; }
  async readSceneState() { this.readCount += 1; return this.value; }
  async writeSceneState(state: RulebearSceneState) { this.value = state; }
  onSceneStateChange(callback: (value: unknown) => void) { this.metadataCallback = callback; return () => undefined; }
  onSceneReadyChange() { return () => undefined; }
  async getCharacterTokens() { return this.tokens; }
  onItemsChange() { return () => undefined; }
  async getSelectedToken() { return null; }
  async consumePendingToken() { return null; }
  onPendingToken() { return () => undefined; }
  async getThemeMode(): Promise<ThemeMode> { return "DARK"; }
  onThemeChange() { return () => undefined; }
  async setBadge() {}
}

beforeEach(() => {
  useAppStore.setState({ status: "LOADING", role: "PLAYER", state: createEmptyState(), tokens: [], theme: "DARK", error: undefined, notice: undefined, pendingTokenId: undefined });
});

describe("superfície da extensão", () => {
  it("mostra instruções quando aberta fora do Owlbear", async () => {
    render(<App />);
    expect(await screen.findByText("Rulebear vive dentro da sua mesa.")).toBeInTheDocument();
  });

  it("mostra estado orientativo sem cena", async () => {
    const gateway = new FakeGateway(); gateway.readyScene = false;
    render(<App gateway={gateway} />);
    expect(await screen.findByText("Abra uma cena para começar")).toBeInTheDocument();
  });

  it("não expõe dados a jogadores", async () => {
    const gateway = new FakeGateway(); gateway.role = "PLAYER";
    render(<App gateway={gateway} />);
    expect(await screen.findByText("Esta ferramenta é privada")).toBeInTheDocument();
    expect(gateway.readCount).toBe(0);
  });

  it("mostra erro e preserva metadata inválida", async () => {
    const gateway = new FakeGateway(); gateway.value = { schemaVersion: 99 };
    render(<App gateway={gateway} />);
    expect(await screen.findByText("A cena precisa de atenção")).toBeInTheDocument();
  });

  it("aceita atualização externa last-write-wins", async () => {
    const gateway = new FakeGateway();
    render(<App gateway={gateway} />);
    expect(await screen.findByText("0 combatentes")).toBeInTheDocument();
    const external = { ...createEmptyState(), revision: 8, combatants: { token: { tokenId: "token", currentHp: 5, maximumHp: 5, reductions: [], conditions: [] } } };
    gateway.metadataCallback?.(external);
    await waitFor(() => expect(screen.getByText("1 combatente")).toBeInTheDocument());
  });
});
