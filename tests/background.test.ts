import { afterEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@owlbear-rodeo/sdk", () => ({
  default: { isAvailable: true, isReady: true, contextMenu: { create } },
  isImage: vi.fn(),
}));
afterEach(() => vi.unstubAllGlobals());

describe("menu de contexto em GitHub Pages", () => {
  it("envia ao SDK um ícone HTTPS absoluto dentro do subdiretório publicado", async () => {
    vi.stubGlobal("window", { location: { href: "https://emillysolveranjos.github.io/ProjetosRpg/background.html?obrref=test" } });
    await import("../src/background/main");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      icons: [expect.objectContaining({
        icon: "https://emillysolveranjos.github.io/ProjetosRpg/icon.svg",
        filter: expect.objectContaining({ roles: ["GM"] }),
      })],
    }));
  });
});
