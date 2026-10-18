import OBR from "@owlbear-rodeo/sdk";
import { describe, expect, it } from "vitest";
import { renderGroup } from "../src/preview/render";
import { placeScenarios } from "../src/preview/layout";
import { GROUPS } from "../src/preview/scenarios";

// Fora de uma sala o SDK não tem usuário; a prévia usa um ID fictício para construir as etiquetas.
Object.defineProperty(OBR.player, "id", { value: "test" });

describe("prévia do mapa", () => {
  it("desenha todos os grupos com o tamanho calculado pelo layout", () => {
    for (const group of GROUPS) {
      const { svg, width, height } = renderGroup(group);
      expect(svg.startsWith("<svg")).toBe(true);
      expect({ width, height }).toEqual({ width: placeScenarios(group.scenarios).width, height: placeScenarios(group.scenarios).height });
    }
  });

  it("usa as etiquetas reais da Rulebear, inclusive siglas e regras de visibilidade", () => {
    const tipos = renderGroup(GROUPS.find((group) => group.id === "tipos")!).svg;
    expect(tipos).toContain(">CA 15<");
    const jogador = GROUPS.find((group) => group.id === "jogador")!;
    const hidden = renderGroup({ ...jogador, scenarios: jogador.scenarios.filter((s) => s.title === "HP oculto") }).svg;
    expect(hidden).not.toContain(">31/48<");
    const invisible = renderGroup({ ...jogador, scenarios: jogador.scenarios.filter((s) => s.title === "Token invisível") }).svg;
    expect(invisible).not.toContain("<image");
  });
});
