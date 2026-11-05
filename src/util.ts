export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value);
  }
  return Number.NaN;
}
