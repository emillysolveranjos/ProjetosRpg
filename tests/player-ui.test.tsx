import { act, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/action/App";
import { useAppStore } from "../src/state/store";
import { createEmptyState, parseSceneState } from "../src/state/schema";
import { addCombatant } from "../src/domain/engine";
import { Network } from "./network";
beforeEach(() => useAppStore.setState({ status: "LOADING", state: createEmptyState(), participants: [], self: undefined, role: "PLAYER", online: false, busy: false, error: undefined, notice: undefined, pendingTokenId: undefined }));
function setup() {
  const n = new Network(), gm = n.join("gm", "GM"), p = n.join("p", "PLAYER"), other = n.join("other", "PLAYER");
  const s = addCombatant(addCombatant(createEmptyState(), "a", 13, 29), "b", 3, 5);
  const a = s.combatants.a!; a.settings.owners = ["p"]; a.settings.visibility.identity.mode = "OWNERS";
  a.markers[0]!.audience.mode = "OWNERS"; a.markers[0]!.display = "PERCENT";
  a.settings.permissions.heal = ["p"]; a.settings.permissions.initiative = ["p"];
  n.value = s; return { n, gm, p, other };
}
describe("painel de jogadores", () => {
  it("mostra somente tokens liberados, porcentagem e ações permitidas", async () => {
    const { p } = setup(); render(<App gateway={p} />);
    expect(await screen.findByText("1 combatente")).toBeInTheDocument();
    expect(screen.getByText("A", { selector: "h2" })).toBeInTheDocument();
    expect(screen.queryByText("B", { selector: "h2" })).not.toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(screen.queryByText("13/29")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cura" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ações de HP: 45%" }));
    expect(screen.getByRole("button", { name: "Cura" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aplicar cura" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Dano" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Acesso" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Token selecionado" })).not.toBeInTheDocument();
  });
  it("outro jogador não recebe a mesma visão do responsável", async () => {
    const { other } = setup(); render(<App gateway={other} />);
    expect(await screen.findByText("Nenhum combatente liberado")).toBeInTheDocument();
    expect(screen.queryByText("45%")).not.toBeInTheDocument();
  });
  it("prévia do mestre usa o jogador escolhido e não permite ações", async () => {
    const { gm } = setup(); render(<App gateway={gm} />);
    await screen.findByText("2 combatentes");
    fireEvent.click(screen.getByRole("button", { name: "Preferências visuais" }));
    fireEvent.change(screen.getByLabelText("Ver como"), { target: { value: "p" } });
    expect(screen.getByText("1 combatente")).toBeInTheDocument();
    expect(screen.getByText("Prévia de jogador · somente leitura")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcadores" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ações de HP/ })).not.toBeInTheDocument();
    expect(screen.queryByText("13/29")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar iniciativa" })).not.toBeInTheDocument();
  });
  it("mudança de papel retira controles do mestre sem recarregar", async () => {
    const { gm } = setup(); render(<App gateway={gm} />);
    await screen.findByRole("button", { name: "+ Token selecionado" });
    await act(async () => { gm.self.role = "PLAYER"; gm.parties.forEach((cb) => cb()); });
    await waitFor(() => expect(screen.queryByRole("button", { name: "+ Token selecionado" })).not.toBeInTheDocument());
    expect(screen.getByText("Nenhum combatente liberado")).toBeInTheDocument();
  });
  it("token invisível não aparece no painel nem no histórico do jogador", async () => {
    const { n, p } = setup(); n.tokens[0]!.visible = false;
    render(<App gateway={p} />);
    expect(await screen.findByText("Nenhum combatente liberado")).toBeInTheDocument();
  });
  it("revogação de visibilidade remove imediatamente o cartão e os valores", async () => {
    const { n, gm, p } = setup(); render(<App gateway={p} />);
    await screen.findByText("45%");
    await act(async () => { const s = parseSceneState(n.value); s.combatants.a!.settings.visibility.identity.mode = "GM"; await gm.writeSceneState(s); });
    await waitFor(() => expect(screen.queryByText("45%")).not.toBeInTheDocument());
  });
  it("preferência visual funciona sem mestre conectado", async () => {
    const { n, p } = setup(); n.gateways = [p];
    render(<App gateway={p} />); await screen.findByText("1 combatente");
    fireEvent.click(screen.getByRole("button", { name: "Preferências visuais" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Posição vertical padrão"), { target: { value: "TOP" } });
    fireEvent.change(within(dialog).getByLabelText("Alinhamento horizontal padrão"), { target: { value: "RIGHT" } });
    fireEvent.change(within(dialog).getByLabelText("Tamanho padrão dos marcadores"), { target: { value: "LARGE" } });
    expect(useAppStore.getState().preferences).toMatchObject({ position: "TOP", horizontal: "RIGHT", size: "LARGE" });
    expect(n.writes).toBe(0);
  });
  it("salva exceções independentes por propriedade e token sem alterar a cena", async () => {
    const { n, p } = setup(); render(<App gateway={p} />); await screen.findByText("1 combatente");
    fireEvent.click(screen.getByRole("button", { name: "Detalhes de A" }));
    fireEvent.change(screen.getByLabelText("Posição vertical"), { target: { value: "TOP" } });
    fireEvent.change(screen.getByLabelText("Alinhamento"), { target: { value: "LEFT" } });
    fireEvent.change(screen.getByLabelText("Tamanho"), { target: { value: "SMALL" } });
    const preferenceKey = `${useAppStore.getState().state.sceneId}/a`;
    expect(useAppStore.getState().preferences.overrides[preferenceKey]).toEqual({ position: "TOP", horizontal: "LEFT", size: "SMALL" });
    fireEvent.change(screen.getByLabelText("Alinhamento"), { target: { value: "" } });
    expect(useAppStore.getState().preferences.overrides[preferenceKey]).toEqual({ position: "TOP", size: "SMALL" });
    expect(n.writes).toBe(0);
  });
  it("expande apenas um cartão e mantém a edição recolhida inicialmente", async () => {
    const { gm } = setup(); render(<App gateway={gm} />);
    await screen.findByText("2 combatentes");
    expect(screen.queryByLabelText("Dano")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ações de HP: 13/29" }));
    expect(screen.getByLabelText("Dano")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Detalhes de B" }));
    expect(screen.queryByLabelText("Dano")).not.toBeInTheDocument();
    expect(screen.getAllByRole("region", { name: "Detalhes do combatente" })).toHaveLength(1);
  });
  it("mostra ajustes separados de HP atual e máximo conforme a autorização", async () => {
    const { n, p } = setup();
    const s = parseSceneState(n.value); s.combatants.a!.settings.permissions.heal = [];
    s.combatants.a!.settings.permissions.adjustCurrentHp = ["p"];
    s.combatants.a!.settings.permissions.adjustMaximumHp = ["p"];
    n.value = s; render(<App gateway={p} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ações de HP: 45%" }));
    expect(screen.getByLabelText("Ajustar HP atual")).toBeInTheDocument();
    expect(screen.getByLabelText("Ajustar HP máximo")).toBeInTheDocument();
    expect(screen.queryByText("13/29")).not.toBeInTheDocument();
  });
  it("oferece imunidade, penetração e múltiplos componentes ao jogador autorizado", async () => {
    const { n, p } = setup();
    const s = parseSceneState(n.value); s.combatants.a!.settings.permissions.heal = []; s.combatants.a!.settings.permissions.damage = ["p"];
    n.value = s; render(<App gateway={p} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ações de HP: 45%" }));
    expect(screen.getByLabelText("Ignorar imunidade")).toBeInTheDocument();
    expect(screen.getByLabelText("Ignorar RD")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "＋ Adicionar componente" })).toBeInTheDocument();
  });
  it("permite escolher operação de condição sem revelar condições aplicadas", async () => {
    const { n, p } = setup();
    const s = parseSceneState(n.value), a = s.combatants.a!;
    a.settings.permissions.conditions = ["p"]; a.settings.visibility.conditions.mode = "GM";
    s.conditionDefinitions = [{ id: "secret", name: "Veneno", maximumStacks: 3, effects: [] }];
    n.value = s; render(<App gateway={p} />);
    fireEvent.click(await screen.findByRole("button", { name: "Detalhes de A" }));
    fireEvent.click(screen.getByRole("button", { name: /Condições/ }));
    expect(screen.getByLabelText("Operação")).toBeInTheDocument();
    expect(screen.getByText(/condições aplicadas estão ocultas/i)).toBeInTheDocument();
    expect(screen.queryByText(/Veneno ·/)).not.toBeInTheDocument();
  });
  it("mostra cartões de permissões individuais no acesso do mestre", async () => {
    const { gm } = setup(); render(<App gateway={gm} />);
    await screen.findByText("2 combatentes");
    fireEvent.click(screen.getByRole("button", { name: "Detalhes de A" }));
    fireEvent.click(screen.getByRole("button", { name: "⚙ Acesso" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Permissões por jogador")).toBeInTheDocument();
    expect(within(dialog).getAllByLabelText("Aplicar dano")).toHaveLength(2);
    expect(within(dialog).getAllByLabelText("Ajustar HP atual")).toHaveLength(2);
    expect(within(dialog).getAllByLabelText("Ajustar HP máximo")).toHaveLength(2);
    expect(within(dialog).queryByText("Editar HP")).not.toBeInTheDocument();
  });
  it("abre a Biblioteca com três abas e os tipos iniciais", async () => {
    const { gm } = setup(); render(<App gateway={gm} />);
    fireEvent.click(await screen.findByRole("button", { name: /Biblioteca/ }));
    const dialog = screen.getByRole("dialog", { name: "Biblioteca da cena" });
    expect(within(dialog).getByRole("button", { name: /Condições/ })).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(dialog).getByRole("button", { name: /Tipos de dano/ }));
    expect(within(dialog).getByText("Físico")).toBeInTheDocument();
    expect(within(dialog).getByText("Mágico")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Presets de defesa/ }));
    expect(within(dialog).getByText("Nenhum preset")).toBeInTheDocument();
  });
});
