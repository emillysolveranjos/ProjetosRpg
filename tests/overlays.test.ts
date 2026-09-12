import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addCombatant } from "../src/domain/engine";
import { createEmptyState } from "../src/state/schema";
import { STATE_KEY } from "../src/config";
import { savePreferences } from "../src/state/preferences";
import { Network } from "./network";
const api = vi.hoisted(() => ({
  ready: true, metadata: {} as Record<string, unknown>, tokens: [] as Record<string, unknown>[], locals: [] as Record<string, unknown>[],
  bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 }, center: { x: 50, y: 50 }, width: 100, height: 100 },
}));
vi.mock("@owlbear-rodeo/sdk", () => {
  function builder() {
    const item: Record<string, unknown> = {};
    const proxy: Record<string, unknown> = new Proxy({}, { get: (_, key) => key === "build" ? () => ({ ...item }) : (value: unknown) => { item[String(key)] = value; return proxy; } });
    return proxy;
  }
  return {
    buildLabel: builder, buildShape: builder, isImage: (t: { type: string }) => t.type === "IMAGE",
    default: { scene: {
      isReady: async () => api.ready, getMetadata: async () => api.metadata,
      items: { getItems: async () => api.tokens, getItemBounds: async () => api.bounds },
      local: {
        getItems: async (filter: (item: Record<string, unknown>) => boolean) => api.locals.filter(filter),
        deleteItems: async (ids: string[]) => { api.locals = api.locals.filter((item) => !ids.includes(String(item.id))); },
        addItems: async (items: Record<string, unknown>[]) => { api.locals.push(...items); },
      },
    } },
  };
});
import { startOverlays } from "../src/background/overlays";
let stop: (() => void) | undefined;
beforeEach(() => { api.ready = true; api.locals = []; api.tokens = [{ id: "a", type: "IMAGE", layer: "CHARACTER", visible: true }]; api.bounds = { min: { x: 0, y: 0 }, max: { x: 100, y: 100 }, center: { x: 50, y: 50 }, width: 100, height: 100 }; localStorage.clear(); });
afterEach(() => { stop?.(); stop = undefined; });
async function settle() { for (let i = 0; i < 50; i++) await Promise.resolve(); }
describe("marcadores locais", () => {
  it("usa HP do combate e só elementos locais anexados ao token", async () => {
    const n = new Network(), gm = n.join("gm", "GM"), s = addCombatant(createEmptyState(), "a", 5, 10);
    api.metadata = { [STATE_KEY]: s }; stop = startOverlays(gm); await settle();
    expect(api.locals).toHaveLength(3);
    expect(api.locals.find((i) => "plainText" in i)?.plainText).toBe("HP 5/10");
    expect(api.locals.every((i) => i.attachedTo === "a" && i.disableHit === true)).toBe(true);
    expect(api.locals.find((i) => String(i.id).endsWith("/fill"))?.width).toBe(50);
    expect(n.writes).toBe(0);
  });
  it("respeita porcentagem, preferência pessoal e token oculto", async () => {
    const n = new Network(), p = n.join("p", "PLAYER"), s = addCombatant(createEmptyState(), "a", 5, 10), c = s.combatants.a!;
    c.settings.visibility.identity.mode = "ALL"; c.markers[0]!.audience.mode = "ALL"; c.markers[0]!.display = "PERCENT";
    savePreferences("room", "p", { position: "TOP", overrides: {} });
    api.metadata = { [STATE_KEY]: s }; stop = startOverlays(p); await settle();
    expect(api.locals.find((i) => "plainText" in i)?.plainText).toBe("HP 50%");
    expect((api.locals[0]!.position as { y: number }).y).toBeLessThan(0);
    api.tokens[0]!.visible = false; p.states.forEach((cb) => cb(s)); await settle();
    expect(api.locals).toHaveLength(0);
  });
  it("reconstrói após movimento/escala e remove ao revogar acesso", async () => {
    const n = new Network(), p = n.join("p", "PLAYER"), s = addCombatant(createEmptyState(), "a", 5, 10);
    s.combatants.a!.settings.visibility.identity.mode = "ALL"; s.combatants.a!.markers[0]!.audience.mode = "ALL";
    api.metadata = { [STATE_KEY]: s }; stop = startOverlays(p); await settle();
    api.bounds = { min: { x: 200, y: 200 }, max: { x: 400, y: 400 }, center: { x: 300, y: 300 }, width: 200, height: 200 };
    p.states.forEach((cb) => cb(s)); await settle();
    expect(api.locals.find((i) => String(i.id).endsWith("/bg"))?.width).toBe(200);
    expect((api.locals[0]!.position as { y: number }).y).toBeGreaterThan(400);
    s.combatants.a!.settings.visibility.identity.mode = "GM"; p.states.forEach((cb) => cb(s)); await settle();
    expect(api.locals).toHaveLength(0);
  });
  it("não remove elementos locais pertencentes a outras extensões", async () => {
    const n = new Network(), gm = n.join("gm", "GM");
    api.locals = [{ id: "other-extension", metadata: {} }];
    api.metadata = { [STATE_KEY]: createEmptyState() };
    stop = startOverlays(gm); await settle();
    expect(api.locals).toEqual([{ id: "other-extension", metadata: {} }]);
  });
});
