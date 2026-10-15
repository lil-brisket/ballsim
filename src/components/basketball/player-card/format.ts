export const EMPTY_VALUE = "—";

/** makes / attempts × 100 to one decimal, or "—" with no attempts. */
export function percent(made: number, attempted: number): string {
  if (attempted <= 0) return EMPTY_VALUE;
  return ((made / attempted) * 100).toFixed(1);
}

/** Null-safe one-decimal average (view-model averages are already rounded). */
export function formatAverage(value: number | null): string {
  return value == null ? EMPTY_VALUE : value.toFixed(1);
}
