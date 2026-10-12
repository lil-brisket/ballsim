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
  team_points: { min: 88, max: 120 },
  game_totals: { min: 176, max: 240 },
  field_goal_pct: { min: 0.42, max: 0.5 },
  three_point_pct: { min: 0.34, max: 0.44 },
  free_throw_pct: { min: 0.72, max: 0.82 },
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
