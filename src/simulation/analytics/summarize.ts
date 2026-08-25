import type {
  HistogramBin,
  MetricSummary,
  MetricSummaryWithPercentiles,
} from "@/simulation/analytics/types";

function sortedCopy(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

/**
 * Linear interpolation percentile. p in [0, 100].
 * Empty input returns 0.
 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  if (p <= 0) {
    return Math.min(...values);
  }
  if (p >= 100) {
    return Math.max(...values);
  }
  const sorted = sortedCopy(values);
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) {
    return sorted[low]!;
  }
  const weight = rank - low;
  return sorted[low]! * (1 - weight) + sorted[high]! * weight;
}

export function summarizeMetric(values: readonly number[]): MetricSummary {
  if (values.length === 0) {
    return { n: 0, mean: 0, median: 0, min: 0, max: 0, stdev: 0 };
  }
  const n = values.length;
  let sum = 0;
  let min = values[0]!;
  let max = values[0]!;
  for (const value of values) {
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const mean = sum / n;
  let varianceSum = 0;
  for (const value of values) {
    const delta = value - mean;
    varianceSum += delta * delta;
  }
  const stdev = Math.sqrt(varianceSum / n);
  const sorted = sortedCopy(values);
  const mid = Math.floor(n / 2);
  const median =
    n % 2 === 1
      ? sorted[mid]!
      : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return { n, mean, median, min, max, stdev };
}

export function summarizeWithPercentiles(
  values: readonly number[],
): MetricSummaryWithPercentiles {
  const base = summarizeMetric(values);
  if (values.length === 0) {
    return { ...base, p10: 0, p25: 0, p75: 0, p90: 0 };
  }
  return {
    ...base,
    p10: percentile(values, 10),
    p25: percentile(values, 25),
    p75: percentile(values, 75),
    p90: percentile(values, 90),
  };
}

/**
 * Equal-width histogram. If binCount omitted, uses Sturges-ish default.
 */
export function distributionHistogram(
  values: readonly number[],
  binCount?: number,
): HistogramBin[] {
  if (values.length === 0) {
    return [];
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const bins =
    binCount ??
    Math.max(1, Math.ceil(Math.log2(values.length) + 1));
  if (min === max) {
    return [{ low: min, high: max, count: values.length, share: 1 }];
  }
  const width = (max - min) / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const value of values) {
    let index = Math.floor((value - min) / width);
    if (index >= bins) {
      index = bins - 1;
    }
    if (index < 0) {
      index = 0;
    }
    counts[index] = (counts[index] ?? 0) + 1;
  }
  const n = values.length;
  return counts.map((count, index) => {
    const low = min + index * width;
    const high = index === bins - 1 ? max : min + (index + 1) * width;
    return { low, high, count, share: count / n };
  });
}

/** Herfindahl–Hirschman Index of share vector (0–1 scale when shares sum to 1). */
export function herfindahlHirschmanIndex(shares: readonly number[]): number {
  if (shares.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const share of shares) {
    sum += share * share;
  }
  return sum;
}

/**
 * Championship concentration: HHI of title shares across franchises that won ≥1.
 * If no titles, returns 0.
 */
export function championshipConcentration(
  titleCounts: readonly number[],
): number {
  const total = titleCounts.reduce((acc, n) => acc + n, 0);
  if (total === 0) {
    return 0;
  }
  return herfindahlHirschmanIndex(titleCounts.map((n) => n / total));
}

/** YoY inflation: mean of (y[t+1]/y[t] - 1) for consecutive pairs. */
export function meanYoYInflation(series: readonly number[]): number | null {
  if (series.length < 2) {
    return null;
  }
  const rates: number[] = [];
  for (let i = 0; i < series.length - 1; i += 1) {
    const prev = series[i]!;
    const next = series[i + 1]!;
    if (prev === 0) {
      continue;
    }
    rates.push(next / prev - 1);
  }
  if (rates.length === 0) {
    return null;
  }
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}
