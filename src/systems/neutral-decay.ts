/**
 * Integer 0–100 metrics that decay toward a neutral attractor.
 * Forces a 1-point step when the true delta would otherwise round to zero.
 */
export function stepTowardNeutral(
  current: number,
  gain: number,
  decayRate: number,
  neutral = 50,
): number {
  const decay = (neutral - current) * decayRate;
  const delta = gain + decay;
  const rounded = Math.round(current + delta);
  const clamped = Math.max(0, Math.min(100, rounded));
  if (clamped !== current) {
    return clamped;
  }
  if (delta === 0) {
    return current;
  }
  if (Math.abs(current - neutral) <= 1) {
    return Math.max(0, Math.min(100, current + (delta > 0 ? 1 : -1)));
  }
  return current;
}
