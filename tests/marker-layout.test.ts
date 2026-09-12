import { describe, expect, it } from "vitest";
import { addCombatant } from "../src/domain/engine";
import { createEmptyState } from "../src/state/schema";
import { markerLayout } from "../src/background/marker-layout";
const viewer = { id: "gm", role: "GM" as const };
const bounds = { min: { x: 0, y: 0 }, max: { x: 100, y: 100 }, center: { x: 50, y: 50 }, width: 100 };
function combatant() {
  const c = addCombatant(createEmptyState(), "a", 20, 20).combatants.a!;
  c.markers.push({ ...c.markers[0]!, hp: false, id: "counter", kind: "counter", name: "Pontos", value: 0 });
  return c;
}
describe("layout compacto no mapa", () => {
  it("coloca HP na borda e contador circular voltado para a imagem em ambas as posições", () => {
    const c = combatant();
    for (const top of [false, true]) {
      const labels = markerLayout(c, viewer, bounds, top);
      const hp = labels.find((l) => l.text === "20/20")!, badge = labels.find((l) => l.key === "counter/label")!;
      expect(hp.y + hp.height / 2).toBe(top ? 0 : 100);
      expect(top ? badge.y > hp.y + hp.height : badge.y + badge.height < hp.y).toBe(true);
      expect(badge.width).toBe(badge.height);
      expect(badge.radius).toBe(badge.height / 2);
      expect(badge.text).toBe("0");
    }
  });
  it("expande valores longos e quebra os contadores em linhas dentro da largura do token", () => {
    const c = combatant(); c.markers[1]!.value = -12345;
    for (let i = 2; i < 12; i++) c.markers.push({ ...c.markers[1]!, id: String(i), value: i });
    const badges = markerLayout(c, viewer, bounds, false).filter((l) => !l.key.startsWith(c.markers[0]!.id + "/"));
    expect(badges[0]!.text).toBe("-12345"); expect(badges[0]!.width).toBeGreaterThan(badges[0]!.height);
    expect(new Set(badges.map((b) => b.y)).size).toBeGreaterThan(1);
    expect(badges.every((b) => b.x >= 0 && b.x + b.width <= 100)).toBe(true);
  });
  it("limita preenchimento visual sem alterar os valores e prioriza HP", () => {
    const c = combatant(); c.markers.unshift({ ...c.markers[0]!, hp: false, id: "mana", value: 30, maximum: 10 });
    const labels = markerLayout(c, viewer, bounds, false);
    expect(labels[0]!.key).toBe(c.markers[1]!.id + "/bg");
    expect(labels.find((l) => l.key === "mana/fill")!.width).toBe(100);
    expect(labels.find((l) => l.key === "mana/label")!.text).toBe("30/10");
    c.markers[0]!.value = -5;
    expect(markerLayout(c, viewer, bounds, false).some((l) => l.key === "mana/fill")).toBe(false);
  });
});
