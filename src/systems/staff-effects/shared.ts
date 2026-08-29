/** Shared clamps and diminishing-return helpers for staff effects. */

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Map overall 1–99 centered at 50 into a bounded multiplier. */
export function overallToMultiplier(
  overall: number,
  perPoint: number,
  min: number,
  max: number,
  center = 50,
): number {
  return clamp(1 + (overall - center) * perPoint, min, max);
}

/** Attribute average for a subset of keys. */
export function averageAttrs(
  attrs: Record<string, number>,
  keys: readonly string[],
): number {
  if (keys.length === 0) return 50;
  let sum = 0;
  for (const key of keys) {
    sum += attrs[key] ?? 50;
  }
  return sum / keys.length;
}

/** Diminishing returns above a threshold. */
export function diminishAbove(
  value: number,
  threshold: number,
  rate = 0.5,
): number {
  if (value <= threshold) return value;
  return threshold + (value - threshold) * rate;
}
