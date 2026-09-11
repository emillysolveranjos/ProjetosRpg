import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("manifesto do Owlbear", () => {
  it("usa caminhos absolutos na origem durante o desenvolvimento", async () => {
    const manifest = JSON.parse(await readFile(resolve(process.cwd(), "public/manifest.json"), "utf8"));
    expect(manifest.icon).toBe("/icon.svg");
    expect(manifest.action).toMatchObject({ icon: "/action-icon.svg", popover: "/action.html" });
    expect(manifest.background_url).toBe("/background.html");
  });
});
