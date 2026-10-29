export type ShelfColors = { frame: string; wood: string; background: string };
export const DEFAULT_SHELF_COLORS: ShelfColors = { frame: '#eee6d5', wood: '#d3a15f', background: '#ded7c9' };
export function normalizeShelfColors(value: unknown): ShelfColors {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result = { ...DEFAULT_SHELF_COLORS };
  for (const key of Object.keys(result) as (keyof ShelfColors)[]) {
    if (typeof input[key] === 'string' && /^#[0-9a-f]{6}$/i.test(input[key] as string)) result[key] = input[key] as string;
  }
  return result;
}
