import { meanCi95, Z_95 } from "@/simulation/validation/mean-ci";

export { meanCi95, Z_95 };
export type { MeanCi95 } from "@/simulation/validation/mean-ci";

/** Φ^{-1}(0.80) for 80% power. */
export const Z_POWER_80 = 0.841621233572914;

export type EffectSizeSampleOptions = {
  /** Default 0.05. Only 0.05 is implemented. */
  alpha?: number;
  /** Default 0.80. Only 0.80 is implemented. */
  power?: number;
  /**
   * When true (default), returns n per group for a two-sample comparison.
   * When false, returns n for a one-sample / paired test.
   */
  twoSample?: boolean;
};

/**
 * Games (observations) needed to detect Cohen's d at 80% power, α=0.05,
 * two-sided. Default is two-sample (n per group), which matches comparing
 * two Lab configs. Does not change simulation output.
 */
export function gamesNeededForEffectSize(
  d: number,
  options: EffectSizeSampleOptions = {},
): number {
  if (!(d > 0) || !Number.isFinite(d)) {
    throw new Error(
      "gamesNeededForEffectSize: d must be a positive finite number.",
    );
  }
  const alpha = options.alpha ?? 0.05;
  const power = options.power ?? 0.8;
  if (alpha !== 0.05 || power !== 0.8) {
    throw new Error(
      "gamesNeededForEffectSize: only alpha=0.05 and power=0.80 are supported.",
    );
  }
  const twoSample = options.twoSample !== false;
  const zSum = Z_95 + Z_POWER_80;
  const nOneSample = (zSum * zSum) / (d * d);
  const n = twoSample ? 2 * nOneSample : nOneSample;
  return Math.ceil(n);
}

export const LAB_POWER_EFFECT_SIZES = [0.2, 0.5] as const;

export type LabPowerEstimate = {
  metric: string;
  d: number;
  games: number;
  design: "two-sample";
  observedN: number;
};

export type KeyMetricObservedN = {
  team_points: number;
  game_totals: number;
  points_per_possession: number;
  field_goal_pct: number;
  abs_differential: number;
};

export function powerEstimatesForKeyMetrics(
  observedN: KeyMetricObservedN,
): LabPowerEstimate[] {
  const metrics = Object.keys(observedN) as (keyof KeyMetricObservedN)[];
  const estimates: LabPowerEstimate[] = [];
  for (const metric of metrics) {
    for (const d of LAB_POWER_EFFECT_SIZES) {
      estimates.push({
        metric,
        d,
        games: gamesNeededForEffectSize(d, { twoSample: true }),
        design: "two-sample",
        observedN: observedN[metric],
      });
    }
  }
  return estimates;
}
