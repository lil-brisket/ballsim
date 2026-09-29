/**
 * Loose basketball-domain plausibility bands — not NBA targets.
 *
 * Adult 5-on-5 games typically cluster near ~90–110 possessions/team and
 * ~100 points/team. Means outside FAIL would not look like basketball to a
 * casual viewer. WARNING is unusual-but-investigate. Variance FAIL catches
 * near-clone deterministic games. PPP is reported but not banded.
 */

import type {
  CheckResult,
  ValidationAggregates,
  ValidationVerdict,
} from "@/simulation/validation/types";

export type PlausibilityBand = {
  passMin: number;
  passMax: number;
  warnMin: number;
  warnMax: number;
};

/** Definition table hashed into Lab engineIdentity.plausibilityChecksum. Numbers unchanged. */
export const PLAUSIBILITY_BANDS = {
  team_points: { passMin: 75, passMax: 125, warnMin: 55, warnMax: 150 },
  game_total: { passMin: 150, passMax: 250, warnMin: 110, warnMax: 300 },
  abs_differential: { passMin: 4, passMax: 18, warnMin: 2, warnMax: 28 },
  possessions_per_team: {
    passMin: 80,
    passMax: 115,
    warnMin: 65,
    warnMax: 130,
  },
  fg_pct: { passMin: 0.38, passMax: 0.55, warnMin: 0.32, warnMax: 0.62 },
  three_pt_pct: { passMin: 0.28, passMax: 0.42, warnMin: 0.22, warnMax: 0.5 },
  ft_pct: { passMin: 0.65, passMax: 0.85, warnMin: 0.55, warnMax: 0.92 },
  turnovers: { passMin: 8, passMax: 22, warnMin: 4, warnMax: 30 },
  fouls: { passMin: 10, passMax: 30, warnMin: 5, warnMax: 40 },
  fta: { passMin: 8, passMax: 35, warnMin: 3, warnMax: 50 },
  total_rebounds: { passMin: 28, passMax: 55, warnMin: 20, warnMax: 65 },
  assists: { passMin: 12, passMax: 32, warnMin: 6, warnMax: 40 },
  assist_fgm_ratio: {
    passMin: 0.4,
    passMax: 0.75,
    warnMin: 0.25,
    warnMax: 0.9,
  },
} as const satisfies Record<string, PlausibilityBand>;

type Band = PlausibilityBand;

function bandVerdict(value: number, band: Band): ValidationVerdict {
  if (value >= band.passMin && value <= band.passMax) {
    return "PASS";
  }
  if (value >= band.warnMin && value <= band.warnMax) {
    return "WARNING";
  }
  return "FAIL";
}

function checkMean(
  name: string,
  value: number,
  band: Band,
  format: (n: number) => string = (n) => n.toFixed(2),
): CheckResult {
  const verdict = bandVerdict(value, band);
  return {
    name,
    verdict,
    value,
    message: `${name}=${format(value)} [${verdict}; pass ${band.passMin}–${band.passMax}]`,
  };
}

/**
 * Home win rate under fair coin (no home-court advantage).
 * sigma = sqrt(0.25 / n); compare |p - 0.5| / sigma.
 */
function homeWinRateCheck(homeWins: number, games: number): CheckResult {
  if (games === 0) {
    return {
      name: "home_win_rate",
      verdict: "FAIL",
      value: null,
      message: "home_win_rate: no games",
    };
  }
  const rate = homeWins / games;
  if (rate === 0 || rate === 1) {
    return {
      name: "home_win_rate",
      verdict: "FAIL",
      value: rate,
      message: `home_win_rate=${(rate * 100).toFixed(1)}% (0% or 100%)`,
    };
  }
  const sigma = Math.sqrt(0.25 / games);
  const z = Math.abs(rate - 0.5) / sigma;
  let verdict: ValidationVerdict = "PASS";
  if (z > 6) {
    verdict = "FAIL";
  } else if (z > 3) {
    verdict = "WARNING";
  }
  return {
    name: "home_win_rate",
    verdict,
    value: rate,
    message: `home_win_rate=${(rate * 100).toFixed(1)}% (z=${z.toFixed(2)} vs 50%)`,
  };
}

function teamPointsStdevCheck(stdev: number): CheckResult {
  let verdict: ValidationVerdict = "PASS";
  if (stdev < 3) {
    verdict = "FAIL";
  } else if (stdev < 6) {
    verdict = "WARNING";
  }
  return {
    name: "team_points_stdev",
    verdict,
    value: stdev,
    message: `team_points_stdev=${stdev.toFixed(2)} [${verdict}; pass ≥6]`,
  };
}

function assistRatioCheck(agg: ValidationAggregates): CheckResult {
  // Also flag if any game had AST > FGM on average via mean ratio > 1
  const ratio = agg.assistToFgmRatio.mean;
  const band: Band = PLAUSIBILITY_BANDS.assist_fgm_ratio;
  // FAIL if mean AST/FGM > 0.90 or < 0.25, or if assists mean > FGM implied
  // (ratio > 1 is impossible under AST ≤ FGM if every game had FGM>0)
  if (ratio > 1) {
    return {
      name: "assist_fgm_ratio",
      verdict: "FAIL",
      value: ratio,
      message: `AST/FGM mean=${ratio.toFixed(3)} (>1 implies AST > FGM)`,
    };
  }
  return checkMean("assist_fgm_ratio", ratio, band, (n) => n.toFixed(3));
}

export function evaluatePlausibility(
  aggregates: ValidationAggregates,
): CheckResult[] {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const checks: CheckResult[] = [
    checkMean(
      "team_points",
      aggregates.teamPoints.mean,
      PLAUSIBILITY_BANDS.team_points,
    ),
    checkMean(
      "game_total",
      aggregates.gameTotals.mean,
      PLAUSIBILITY_BANDS.game_total,
    ),
    checkMean(
      "abs_differential",
      aggregates.absoluteDifferentials.mean,
      PLAUSIBILITY_BANDS.abs_differential,
    ),
    checkMean(
      "possessions_per_team",
      aggregates.possessionsPerTeam.mean,
      PLAUSIBILITY_BANDS.possessions_per_team,
    ),
    checkMean(
      "fg_pct",
      aggregates.fieldGoalPct.mean,
      PLAUSIBILITY_BANDS.fg_pct,
      pct,
    ),
    checkMean(
      "three_pt_pct",
      aggregates.threePointPct.mean,
      PLAUSIBILITY_BANDS.three_pt_pct,
      pct,
    ),
    checkMean(
      "ft_pct",
      aggregates.freeThrowPct.mean,
      PLAUSIBILITY_BANDS.ft_pct,
      pct,
    ),
    checkMean(
      "turnovers",
      aggregates.turnovers.mean,
      PLAUSIBILITY_BANDS.turnovers,
    ),
    checkMean("fouls", aggregates.fouls.mean, PLAUSIBILITY_BANDS.fouls),
    checkMean("fta", aggregates.freeThrowAttempts.mean, PLAUSIBILITY_BANDS.fta),
    checkMean(
      "total_rebounds",
      aggregates.totalRebounds.mean,
      PLAUSIBILITY_BANDS.total_rebounds,
    ),
    checkMean("assists", aggregates.assists.mean, PLAUSIBILITY_BANDS.assists),
    assistRatioCheck(aggregates),
    teamPointsStdevCheck(aggregates.teamPoints.stdev),
    homeWinRateCheck(aggregates.homeAway.homeWins, aggregates.gamesSimulated),
  ];
  return checks;
}

export function combineVerdicts(
  verdicts: readonly ValidationVerdict[],
): ValidationVerdict {
  if (verdicts.includes("FAIL")) {
    return "FAIL";
  }
  if (verdicts.includes("WARNING")) {
    return "WARNING";
  }
  return "PASS";
}
