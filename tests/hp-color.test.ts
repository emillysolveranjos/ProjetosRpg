import { describe, expect, it } from "vitest";
import { hpColor } from "../src/action/CompactCard";
describe("cor da barra de HP no painel", () => {
  it("usa faixas de saúde quando o HP mantém a cor padrão", () => {
    expect(hpColor("#d94848", 30, 48)).toBe("#3fae6a");
    expect(hpColor("#D94848", 24, 48)).toBe("#e0a21b");
    expect(hpColor("#d94848", 12, 48)).toBe("#d94848");
    expect(hpColor("#d94848", -4, 48)).toBe("#d94848");
  });
  it("respeita a cor escolhida pelo mestre", () => {
    expect(hpColor("#6366f1", 1, 48)).toBe("#6366f1");
  });
});
