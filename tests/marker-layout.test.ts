import { describe, expect, it } from "vitest";
import { addCombatant } from "../src/domain/engine";
import type { MarkerDisplayLayout } from "../src/domain/types";
import { createEmptyState } from "../src/state/schema";
import { markerLayout } from "../src/background/marker-layout";
const viewer = { id: "gm", role: "GM" as const };
const bounds = { min: { x: 0, y: 0 }, max: { x: 100, y: 100 }, center: { x: 50, y: 50 }, width: 100 };
const layout = (value: Partial<MarkerDisplayLayout> = {}): MarkerDisplayLayout => ({ position: "BOTTOM", horizontal: "CENTER", size: "MEDIUM", ...value });
function combatant() {
  const c = addCombatant(createEmptyState(), "a", 20, 20).combatants.a!;
  c.markers.push({ ...c.markers[0]!, hp: false, id: "counter", kind: "counter", name: "Pontos", value: 0 });
  return c;
}
describe("layout compacto no mapa", () => {
  it("coloca HP na borda e contador circular voltado para a imagem em ambas as posições", () => {
    const c = combatant();
    for (const position of ["BOTTOM", "TOP"] as const) {
      const labels = markerLayout(c, viewer, bounds, layout({ position }));
      const hp = labels.find((l) => l.text === "20/20")!, badge = labels.find((l) => l.key === "counter/label")!;
      expect(hp.y + hp.height / 2).toBe(position === "TOP" ? 0 : 100);
      expect(position === "TOP" ? badge.y > hp.y + hp.height : badge.y + badge.height < hp.y).toBe(true);
      expect(badge.width).toBe(badge.height);
      expect(badge.radius).toBe(badge.height / 2);
      expect(badge.text).toBe("0");
    }
  });
  it("alinha o conjunto na borda esquerda, centro ou borda direita", () => {
    const c = combatant();
    const left = markerLayout(c, viewer, bounds, layout({ horizontal: "LEFT" })).find((l) => l.key === "hp/bg")!;
    const center = markerLayout(c, viewer, bounds, layout()).find((l) => l.key === "hp/bg")!;
    const right = markerLayout(c, viewer, bounds, layout({ horizontal: "RIGHT" })).find((l) => l.key === "hp/bg")!;
    expect(left).toMatchObject({ x: -50, width: 100 });
    expect(center).toMatchObject({ x: 0, width: 100 });
    expect(right).toMatchObject({ x: 50, width: 100 });
  });
  it("dimensiona barras, texto, círculos e espaçamento em 0,75×, 1× e 1,35×", () => {
    const c = combatant();
    const values = (["SMALL", "MEDIUM", "LARGE"] as const).map((size) => markerLayout(c, viewer, bounds, layout({ size })));
    const hp = values.map((labels) => labels.find((l) => l.key === "hp/bg")!);
    const badge = values.map((labels) => labels.find((l) => l.key === "counter/label")!);
    expect(hp.map((v) => v.width)).toEqual([75, 100, 135]);
    expect(hp.map((v) => v.height)).toEqual([9.75, 13, 17.55]);
    expect(hp.map((v) => v.y + v.height / 2)).toEqual([100, 100, 100]);
    [14.625, 19.5, 26.325].forEach((expected, index) => expect(badge[index]!.height).toBeCloseTo(expected));
    expect(hp[0]!.fontSize / hp[1]!.fontSize).toBeCloseTo(.75);
    expect(hp[2]!.fontSize / hp[1]!.fontSize).toBeCloseTo(1.35);
  });
  it("expande valores longos e quebra os contadores em linhas dentro da largura do conjunto", () => {
    const c = combatant(); c.markers[1]!.value = -12345;
    for (let i = 2; i < 12; i++) c.markers.push({ ...c.markers[1]!, id: String(i), value: i });
    for (const size of ["SMALL", "MEDIUM", "LARGE"] as const) {
      const selected = layout({ size }), width = size === "SMALL" ? 75 : size === "LARGE" ? 135 : 100;
      const left = 50 - width / 2;
      const badges = markerLayout(c, viewer, bounds, selected).filter((l) => !l.key.startsWith(c.markers[0]!.id + "/"));
      expect(badges[0]!.text).toBe("-12345"); expect(badges[0]!.width).toBeGreaterThan(badges[0]!.height);
      expect(new Set(badges.map((b) => b.y)).size).toBeGreaterThan(1);
      expect(badges.every((b) => b.x >= left && b.x + b.width <= left + width)).toBe(true);
    }
  });
  it("mantém várias barras dentro do mesmo conjunto e prioriza HP", () => {
    const c = combatant(); c.markers.unshift({ ...c.markers[0]!, hp: false, id: "mana", value: 30, maximum: 10 });
    const labels = markerLayout(c, viewer, bounds, layout({ position: "TOP", horizontal: "RIGHT", size: "LARGE" }));
    expect(labels[0]!.key).toBe(c.markers[1]!.id + "/bg");
    expect(labels.find((l) => l.key === "mana/fill")!.width).toBe(135);
    expect(labels.find((l) => l.key === "mana/label")!.text).toBe("30/10");
    expect(labels.find((l) => l.key === "hp/bg")!.x).toBe(32.5);
    expect(labels.find((l) => l.key === "hp/bg")!.y).toBe(-8.775);
    expect(labels.find((l) => l.key === "mana/bg")!.y).toBeLessThan(labels.find((l) => l.key === "hp/bg")!.y);
    c.markers[0]!.value = -5;
    expect(markerLayout(c, viewer, bounds, layout()).some((l) => l.key === "mana/fill")).toBe(false);
  });
  it("mantém o texto dentro da barra e representa sobrevida em azul em cada tamanho", () => {
    const c = combatant(); c.currentHp = 25;
    for (const size of ["SMALL", "MEDIUM", "LARGE"] as const) {
      const labels = markerLayout(c, viewer, bounds, layout({ size }));
      const text = labels.find((l) => l.key === "hp/label")!;
      const over = labels.find((l) => l.key === "hp/over")!;
      const width = size === "SMALL" ? 75 : size === "LARGE" ? 135 : 100;
      expect(text).toMatchObject({ text: "25/20", opacity: 0, zIndex: 3 });
      expect(text.y + text.height / 2).toBe(100);
      expect(over).toMatchObject({ color: "#3b82f6", width: width * .25, x: 50 + width / 2 - width * .25 });
    }
    c.currentHp = -5;
    const negative = markerLayout(c, viewer, bounds, layout({ horizontal: "LEFT", size: "LARGE" }));
    expect(negative.find((l) => l.key === "hp/label")?.text).toBe("-5/20");
    expect(negative.some((l) => l.key === "hp/fill" || l.key === "hp/over")).toBe(false);
  });
});
