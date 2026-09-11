import { describe, expect, it } from "vitest";
import { evaluateExpression, parseDice } from "../src/domain/dice";

describe("expressões de dados", () => {
  it.each([
    ["2d6+3", { diceCount: 2, sides: 6, modifier: 3 }],
    ["1D20-2", { diceCount: 1, sides: 20, modifier: -2 }],
    ["4d8", { diceCount: 4, sides: 8, modifier: 0 }],
  ])("interpreta %s", (expression, expected) => {
    expect(parseDice(expression)).toMatchObject(expected);
  });

  it.each(["", "d6", "2d", "2d0", "0d6", "10001d6", "2d6++1", "1.5d6"])("rejeita %s", (expression) => {
    expect(() => parseDice(expression)).toThrow();
  });

  it("avalia valor fixo", () => {
    expect(evaluateExpression("17")).toMatchObject({ expression: "17", rolls: [], modifier: 0, total: 17 });
  });

  it("rola uma vez por dado e preserva os detalhes", () => {
    const results = [4, 2];
    const roll = evaluateExpression("2d6+3", () => results.shift()!);
    expect(roll).toMatchObject({ expression: "2d6+3", rolls: [4, 2], modifier: 3, total: 9 });
  });
});
