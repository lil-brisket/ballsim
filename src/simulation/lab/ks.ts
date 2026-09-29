/**
 * Two-sample Kolmogorov–Smirnov statistic and asymptotic p-value.
 * Does not change simulation output.
 */
export type KsTwoSampleResult = {
  d: number;
  pValue: number;
  n1: number;
  n2: number;
};

function kolmogorovPValue(z: number): number {
  if (!(z > 0) || !Number.isFinite(z)) {
    return 1;
  }
  if (z > 8) {
    return 0;
  }
  let sum = 0;
  for (let k = 1; k <= 200; k += 1) {
    const sign = k % 2 === 1 ? 1 : -1;
    sum += sign * Math.exp(-2 * k * k * z * z);
  }
  return Math.min(1, Math.max(0, 2 * sum));
}

export function ksTwoSample(
  sampleA: readonly number[],
  sampleB: readonly number[],
): KsTwoSampleResult {
  if (sampleA.length < 1 || sampleB.length < 1) {
    throw new Error("ksTwoSample: both samples must be non-empty.");
  }
  const a = [...sampleA].sort((left, right) => left - right);
  const b = [...sampleB].sort((left, right) => left - right);
  let i = 0;
  let j = 0;
  let d = 0;
  while (i < a.length || j < b.length) {
    const va = i < a.length ? a[i]! : Number.POSITIVE_INFINITY;
    const vb = j < b.length ? b[j]! : Number.POSITIVE_INFINITY;
    if (va <= vb) {
      i += 1;
    }
    if (vb <= va) {
      j += 1;
    }
    d = Math.max(d, Math.abs(i / a.length - j / b.length));
  }
  const n = (a.length * b.length) / (a.length + b.length);
  return {
    d,
    pValue: kolmogorovPValue(d * Math.sqrt(n)),
    n1: a.length,
    n2: b.length,
  };
}

export const LAB_DEFAULT_KS_ALPHA = 0.01;

export function ksVerdict(
  result: KsTwoSampleResult,
  alpha: number = LAB_DEFAULT_KS_ALPHA,
): "PASS" | "FAIL" {
  if (!(alpha > 0) || alpha >= 1) {
    throw new Error("ksVerdict: alpha must be in (0, 1).");
  }
  return result.pValue < alpha ? "FAIL" : "PASS";
}
