const UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

export function parseDurationMs(input: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(input.trim());
  if (!match) throw new Error(`Unrecognized duration format: ${input}`);
  const [, value, unit] = match;
  return Number(value) * UNIT_MS[unit];
}

export function addDuration(date: Date, input: string): Date {
  return new Date(date.getTime() + parseDurationMs(input));
}
