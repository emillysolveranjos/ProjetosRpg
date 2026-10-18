import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/action/App";
import { useAppStore } from "../src/state/store";
import { createEmptyState, parseSceneState } from "../src/state/schema";
import { addCombatant } from "../src/domain/engine";
import { markerMapText } from "../src/domain/access";
import { markerLayout } from "../src/background/marker-layout";
import type { Marker } from "../src/domain/types";
import { Network } from "./network";

const gmViewer = { id: "gm", role: "GM" as const };
const bounds = { min: { x: 0, y: 0 }, max: { x: 100, y: 100 }, center: { x: 50, y: 50 }, width: 100 };
function withArmor(extra: Partial<Marker> = {}) {
  const s = addCombatant(addCombatant(createEmptyState(), "a", 13, 29), "b", 3, 5);
  const a = s.combatants.a!;
  a.markers.push({ ...a.markers[0]!, hp: false, id: "ca", kind: "number", name: "Classe de Armadura", value: 15, mapLabel: "CA", description: "Acerta com d20 + bônus igual ou maior.", ...extra });
  return s;
}
beforeEach(() => useAppStore.setState({ status: "LOADING", state: createEmptyState(), participants: [], self: undefined, role: "PLAYER", online: false, busy: false, error: undefined, notice: undefined, pendingTokenId: undefined, focusTokenId: undefined }));

describe("sigla e descrição dos marcadores", () => {
  it("mostra a sigla antes do valor no mapa e mantém só o valor sem sigla", () => {
    const s = withArmor(), a = s.combatants.a!, armor = a.markers[1]!;
    expect(markerMapText(armor, a, gmViewer)).toBe("CA 15");
    expect(markerMapText({ ...armor, mapLabel: "  " }, a, gmViewer)).toBe("15");
    const labels = markerLayout(a, gmViewer, bounds, { position: "BOTTOM", horizontal: "CENTER", size: "MEDIUM" });
    expect(labels.find((l) => l.key === "ca/label")?.text).toBe("CA 15");
  });

  it("valida o tamanho da sigla e da descrição", () => {
    expect(parseSceneState(withArmor()).combatants.a!.markers[1]).toMatchObject({ mapLabel: "CA", description: "Acerta com d20 + bônus igual ou maior." });
    expect(() => parseSceneState(withArmor({ mapLabel: "LONGO" + "X" }))).toThrow();
    expect(() => parseSceneState(withArmor({ description: "x".repeat(201) }))).toThrow();
  });

  it("jogador lê a descrição só dos marcadores que pode ver", async () => {
    const n = new Network(), p = n.join("p", "PLAYER"); n.join("gm", "GM");
    const s = withArmor();
    const a = s.combatants.a!; a.settings.visibility.identity.mode = "ALL";
    a.markers[1]!.audience.mode = "ALL";
    a.markers.push({ ...a.markers[1]!, id: "segredo", name: "Fraqueza", mapLabel: undefined, description: "Vulnerável a fogo.", audience: { mode: "GM", playerIds: [] } });
    n.value = s;
    render(<App gateway={p} />);
    fireEvent.click(await screen.findByRole("button", { name: "Detalhes de A" }));
    expect(screen.getByText("Acerta com d20 + bônus igual ou maior.")).toBeInTheDocument();
    expect(screen.queryByText("Vulnerável a fogo.")).not.toBeInTheDocument();
  });

  it("retrato centraliza o token no mapa", async () => {
    const n = new Network(), gm = n.join("gm", "GM"); n.value = withArmor();
    render(<App gateway={gm} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mostrar A no mapa" }));
    expect(gm.focused).toEqual(["a"]);
  });
});

describe("Abrir na Rulebear pelo menu do token", () => {
  it("abre o cartão do combatente e, para o mestre, oferece adicionar tokens novos", async () => {
    const n = new Network(), gm = n.join("gm", "GM"); n.value = withArmor();
    n.tokens = [...n.tokens, { id: "c", name: "C" }];
    render(<App gateway={gm} />);
    await screen.findByText("2 combatentes");
    act(() => useAppStore.getState().openToken("b"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Detalhes de B" })).toHaveAttribute("aria-expanded", "true"));
    act(() => useAppStore.getState().openToken("c"));
    expect(await screen.findByRole("dialog", { name: "Adicionar combatente" })).toBeInTheDocument();
  });

  it("jogador sem acesso recebe aviso genérico", async () => {
    const n = new Network(), p = n.join("p", "PLAYER"); n.join("gm", "GM"); n.value = withArmor();
    render(<App gateway={p} />);
    await screen.findByText("Nenhum combatente liberado");
    act(() => useAppStore.getState().openToken("a"));
    expect(await screen.findByText("Este token não está liberado para você na Rulebear.")).toBeInTheDocument();
    expect(useAppStore.getState().pendingTokenId).toBeUndefined();
  });
});
