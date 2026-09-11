export const MAX_DICE_COUNT = 10_000;
const MAX_INT = 2_147_483_647;
const DICE_PATTERN = /^([1-9]\d*)d([1-9]\d*)([+-]\d+)?$/i;

export interface RollResult {
  expression: string;
  diceCount: number;
  sides: number;
  rolls: number[];
  modifier: number;
  total: number;
  minimum: number;
  maximum: number;
  average: number;
}

export type DieRoller = (sides: number) => number;

function randomDie(sides: number): number {
  const maximum = 0x1_0000_0000;
  const limit = maximum - (maximum % sides);
  const buffer = new Uint32Array(1);
  let value = maximum;
  while (value >= limit) {
    crypto.getRandomValues(buffer);
    value = buffer[0] ?? maximum;
  }
  return (value % sides) + 1;
}

export function parseDice(expression: string): Omit<RollResult, "rolls" | "total"> {
  const trimmed = expression.trim();
  const match = DICE_PATTERN.exec(trimmed);
  if (!match) throw new Error("Use o formato NdM, com modificador opcional +K ou -K.");

  const diceCount = Number(match[1]);
  const sides = Number(match[2]);
  const modifier = match[3] ? Number(match[3]) : 0;
  if (!Number.isSafeInteger(diceCount) || !Number.isSafeInteger(sides) || !Number.isSafeInteger(modifier)) {
    throw new Error("A expressão contém números fora do intervalo permitido.");
  }
  if (diceCount > MAX_DICE_COUNT) throw new Error(`Uma rolagem aceita no máximo ${MAX_DICE_COUNT} dados.`);
  const minimum = diceCount + modifier;
  const maximum = diceCount * sides + modifier;
  if (minimum < -MAX_INT || maximum > MAX_INT) throw new Error("O resultado pode exceder o intervalo permitido.");
  const normalized = `${diceCount}d${sides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? modifier : ""}`;
  return { expression: normalized, diceCount, sides, modifier, minimum, maximum, average: diceCount * ((sides + 1) / 2) + modifier };
}

export function rollDice(expression: string, rollDie: DieRoller = randomDie): RollResult {
  const parsed = parseDice(expression);
  const rolls = Array.from({ length: parsed.diceCount }, () => {
    const value = rollDie(parsed.sides);
    if (!Number.isInteger(value) || value < 1 || value > parsed.sides) throw new Error("A fonte de dados retornou um valor inválido.");
    return value;
  });
  return { ...parsed, rolls, total: rolls.reduce((sum, roll) => sum + roll, parsed.modifier) };
}

export function evaluateExpression(expression: string, rollDie?: DieRoller): RollResult {
  const trimmed = expression.trim();
  if (/^[1-9]\d*$/.test(trimmed)) {
    const total = Number(trimmed);
    if (!Number.isSafeInteger(total) || total > MAX_INT) throw new Error("O valor está fora do intervalo permitido.");
    return { expression: trimmed, diceCount: 0, sides: 0, rolls: [], modifier: 0, total, minimum: total, maximum: total, average: total };
  }
  return rollDice(trimmed, rollDie);
}
