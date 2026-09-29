/** Two-sided 95% normal critical value. */
export const Z_95 = 1.96;

export type MeanCi95 = {
  low: number;
  high: number;
};

/**
 * Wald 95% CI for a mean. `populationStdev` is sqrt(SS / n), matching
 * `summarizeMetric`. The standard error uses the sample conversion
 * se = s_pop / sqrt(n - 1). Returns null when n < 2.
 */
export function meanCi95(
  mean: number,
  populationStdev: number,
  n: number,
): MeanCi95 | null {
  if (
    !Number.isInteger(n) ||
    n < 2 ||
    !Number.isFinite(mean) ||
    !Number.isFinite(populationStdev)
  ) {
    return null;
  }
  const standardError = populationStdev / Math.sqrt(n - 1);
  const halfWidth = Z_95 * standardError;
  return { low: mean - halfWidth, high: mean + halfWidth };
}
