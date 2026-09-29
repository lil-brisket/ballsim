/**
 * NBA-inspired calibration ranges (2020s team-game rates: ~110–115 PPG,
 * FG% ~.46–.48, 3P% ~.36, FT% ~.78). Widened so a healthy fictional engine
 * can pass; a broken run (near-zero or 200+ PPG) fails. Distinct from
 * PLAUSIBILITY_BANDS, which stay hashed into engine identity.
 */
import type { CheckResult } from "@/simulation/validation/types";

export type CalibrationBand = {
  min: number;
  max: number;
};

export const CALIBRATION_BANDS = {
  team_points: { min: 70, max: 140 },
  game_totals: { min: 140, max: 280 },
  field_goal_pct: { min: 0.35, max: 0.58 },
  three_point_pct: { min: 0.25, max: 0.45 },
  free_throw_pct: { min: 0.6, max: 0.9 },
} as const satisfies Record<string, CalibrationBand>;

export type CalibrationAggregates = {
  teamPointsMean: number;
  gameTotalsMean: number;
  fieldGoalPctMean: number;
  threePointPctMean: number;
  freeThrowPctMean: number;
};

function bandCheck(
  name: string,
  value: number,
  band: CalibrationBand,
): CheckResult {
  const inside = value >= band.min && value <= band.max;
  return {
    name,
    verdict: inside ? "PASS" : "FAIL",
    value,
    message: inside
      ? `${name}=${value.toFixed(3)} inside [${band.min}, ${band.max}]`
      : `${name}=${value.toFixed(3)} outside calibration [${band.min}, ${band.max}]`,
  };
}

export function evaluateCalibration(
  aggregates: CalibrationAggregates,
): CheckResult[] {
  return [
    bandCheck(
      "team_points",
      aggregates.teamPointsMean,
      CALIBRATION_BANDS.team_points,
    ),
    bandCheck(
      "game_totals",
      aggregates.gameTotalsMean,
      CALIBRATION_BANDS.game_totals,
    ),
    bandCheck(
      "field_goal_pct",
      aggregates.fieldGoalPctMean,
      CALIBRATION_BANDS.field_goal_pct,
    ),
    bandCheck(
      "three_point_pct",
      aggregates.threePointPctMean,
      CALIBRATION_BANDS.three_point_pct,
    ),
    bandCheck(
      "free_throw_pct",
      aggregates.freeThrowPctMean,
      CALIBRATION_BANDS.free_throw_pct,
    ),
  ];
}
