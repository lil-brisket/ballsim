import type {
  CorrelationPair,
  RelationshipExpectation,
} from "@/simulation/analytics/types";

/**
 * Pearson correlation. Returns null if variance is zero or n < 3.
 */
export function pearsonCorrelation(
  xs: readonly number[],
  ys: readonly number[],
): number | null {
  if (xs.length !== ys.length || xs.length < 3) {
    return null;
  }
  const n = xs.length;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += xs[i]!;
    sumY += ys[i]!;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) {
    return null;
  }
  const r = num / Math.sqrt(denX * denY);
  if (!Number.isFinite(r)) {
    return null;
  }
  return r;
}

/**
 * Lagged Pearson: correlate x[t] with y[t+lag] for aligned series of equal length.
 * `xs` and `ys` must be same length and time-ordered.
 */
export function laggedPearson(
  xs: readonly number[],
  ys: readonly number[],
  lag: number,
): { r: number | null; n: number } {
  if (lag < 0) {
    throw new Error("laggedPearson: lag must be >= 0.");
  }
  if (xs.length !== ys.length || xs.length <= lag) {
    return { r: null, n: 0 };
  }
  const xLagged: number[] = [];
  const yLagged: number[] = [];
  for (let i = 0; i < xs.length - lag; i += 1) {
    xLagged.push(xs[i]!);
    yLagged.push(ys[i + lag]!);
  }
  return { r: pearsonCorrelation(xLagged, yLagged), n: xLagged.length };
}

export function makeCorrelationPair(
  name: string,
  xLabel: string,
  yLabel: string,
  xs: readonly number[],
  ys: readonly number[],
  lag = 0,
): CorrelationPair {
  if (lag === 0) {
    return {
      name,
      x: xLabel,
      y: yLabel,
      r: pearsonCorrelation(xs, ys),
      n: Math.min(xs.length, ys.length),
      lag: 0,
    };
  }
  const { r, n } = laggedPearson(xs, ys, lag);
  return { name, x: xLabel, y: yLabel, r, n, lag };
}

/**
 * Evaluate whether observed r violates the expected relationship.
 * Returns null when the relationship is context-dependent or r is unavailable.
 * Returns a short diagnostic string when implausibly absent / wrong direction.
 */
export function evaluateRelationship(
  r: number | null,
  expectation: RelationshipExpectation,
): string | null {
  if (expectation.kind === "context_dependent") {
    return null;
  }
  if (r === null) {
    return "correlation unavailable (insufficient variance or sample)";
  }
  if (expectation.kind === "directional_positive") {
    const floor = expectation.minR ?? 0.15;
    if (r < floor) {
      return `expected positive relationship (r >= ${floor}), observed r=${r.toFixed(3)}`;
    }
    return null;
  }
  if (expectation.kind === "directional_negative") {
    const ceiling = expectation.maxR ?? -0.1;
    if (r > ceiling) {
      return `expected negative relationship (r <= ${ceiling}), observed r=${r.toFixed(3)}`;
    }
    return null;
  }
  // weak_positive
  const minR = expectation.minR ?? 0.05;
  const maxR = expectation.maxR ?? 0.7;
  if (r < minR) {
    return `expected weak/moderate positive (r >= ${minR}), observed r=${r.toFixed(3)}`;
  }
  if (r > maxR) {
    return `payroll-style link unusually strong (r > ${maxR}), observed r=${r.toFixed(3)}`;
  }
  return null;
}
