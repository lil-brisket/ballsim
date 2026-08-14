import type { Player } from "@/domain/entities/player";
import type { GameSnapshot } from "@/simulation/validation/types";
import type {
  CorrelationResult,
  ValidationVerdict,
} from "@/simulation/validation/types";

type PlayerGameAccum = {
  playerId: string;
  games: number;
  points: number;
  rebounds: number;
  assists: number;
  finishing: number;
  midRange: number;
  threePoint: number;
  offensiveIq: number;
  rebounding: number;
  passing: number;
  perimeterDefense: number;
  interiorDefense: number;
  defensiveIq: number;
};

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
 * Player-level attribute vs outcome correlations across the primary sample.
 *
 * Weak |r| alone never FAILs overall. Wrong-direction with large N → WARNING.
 * Magnitude is informational (usage/minutes/role make modest r expected).
 */
export function evaluatePlayerCorrelations(
  homePlayers: readonly Player[],
  awayPlayers: readonly Player[],
  snapshots: readonly GameSnapshot[],
  playerGameStats: ReadonlyMap<
    string,
    { points: number; rebounds: number; assists: number }
  >[],
): CorrelationResult[] {
  const roster = [...homePlayers, ...awayPlayers];
  const byId = new Map(roster.map((player) => [player.id as string, player]));

  const accum = new Map<string, PlayerGameAccum>();
  for (const player of roster) {
    const attrs = player.attributes;
    accum.set(player.id, {
      playerId: player.id,
      games: 0,
      points: 0,
      rebounds: 0,
      assists: 0,
      finishing: attrs.finishing,
      midRange: attrs.midRange,
      threePoint: attrs.threePoint,
      offensiveIq: attrs.offensiveIq,
      rebounding: attrs.rebinding,
      passing: attrs.passing,
      perimeterDefense: attrs.perimeterDefense,
      interiorDefense: attrs.interiorDefense,
      defensiveIq: attrs.defensiveIq,
    });
  }

  for (let gameIndex = 0; gameIndex < snapshots.length; gameIndex += 1) {
    const perGame = playerGameStats[gameIndex];
    if (!perGame) {
      continue;
    }
    for (const [playerId, stats] of perGame) {
      const row = accum.get(playerId);
      if (!row) {
        continue;
      }
      row.games += 1;
      row.points += stats.points;
      row.rebounds += stats.rebounds;
      row.assists += stats.assists;
    }
  }

  const rows = [...accum.values()].filter((row) => row.games > 0);
  const meanPts = rows.map((row) => row.points / row.games);
  const meanReb = rows.map((row) => row.rebounds / row.games);
  const meanAst = rows.map((row) => row.assists / row.games);

  // Team-level defense: opponent points vs mean defensive attrs of the team
  const teamDefensePairs = buildTeamDefensePairs(
    homePlayers,
    awayPlayers,
    snapshots,
  );

  const largeN = snapshots.length >= 200;
  const results: CorrelationResult[] = [
    correlate(
      "pts_vs_finishing",
      "finishing",
      "mean_points",
      1,
      rows.map((row) => row.finishing),
      meanPts,
      largeN,
    ),
    correlate(
      "pts_vs_midRange",
      "midRange",
      "mean_points",
      1,
      rows.map((row) => row.midRange),
      meanPts,
      largeN,
    ),
    correlate(
      "pts_vs_threePoint",
      "threePoint",
      "mean_points",
      1,
      rows.map((row) => row.threePoint),
      meanPts,
      largeN,
    ),
    correlate(
      "pts_vs_offensiveIq",
      "offensiveIq",
      "mean_points",
      1,
      rows.map((row) => row.offensiveIq),
      meanPts,
      largeN,
    ),
    correlate(
      "reb_vs_rebounding",
      "rebounding",
      "mean_rebounds",
      1,
      rows.map((row) => row.rebounding),
      meanReb,
      largeN,
    ),
    correlate(
      "ast_vs_passing",
      "passing",
      "mean_assists",
      1,
      rows.map((row) => row.passing),
      meanAst,
      largeN,
    ),
    correlate(
      "opp_pts_vs_perimeterDefense",
      "team_perimeterDefense",
      "opponent_points",
      -1,
      teamDefensePairs.perimeterDefense,
      teamDefensePairs.opponentPoints,
      largeN,
    ),
    correlate(
      "opp_pts_vs_interiorDefense",
      "team_interiorDefense",
      "opponent_points",
      -1,
      teamDefensePairs.interiorDefense,
      teamDefensePairs.opponentPoints,
      largeN,
    ),
    correlate(
      "opp_pts_vs_defensiveIq",
      "team_defensiveIq",
      "opponent_points",
      -1,
      teamDefensePairs.defensiveIq,
      teamDefensePairs.opponentPoints,
      largeN,
    ),
  ];

  // Silence unused — byId kept for future extension / clarity that players are source of attrs
  void byId;
  return results;
}

function correlate(
  name: string,
  predictor: string,
  outcome: string,
  expectedSign: 1 | -1,
  xs: readonly number[],
  ys: readonly number[],
  largeSample: boolean,
): CorrelationResult {
  const pearsonR = pearsonCorrelation(xs, ys);
  const sampleSize = xs.length;
  let verdict: ValidationVerdict = "PASS";
  let message: string;

  if (pearsonR === null) {
    message = `${name}: insufficient variance or n=${sampleSize}`;
    return {
      name,
      predictor,
      outcome,
      expectedSign,
      sampleSize,
      pearsonR,
      verdict: "PASS",
      message,
    };
  }

  const wrongDirection =
    (expectedSign > 0 && pearsonR < 0) ||
    (expectedSign < 0 && pearsonR > 0);

  // Weak |r| alone never FAILs. Wrong-direction with large N → WARNING.
  if (wrongDirection && largeSample && Math.abs(pearsonR) >= 0.05) {
    verdict = "WARNING";
    message = `${name}: r=${pearsonR.toFixed(3)} wrong direction (expected ${expectedSign > 0 ? "+" : "-"})`;
  } else if (wrongDirection && largeSample) {
    verdict = "PASS";
    message = `${name}: r=${pearsonR.toFixed(3)} weakly wrong direction (noisy; not FAIL)`;
  } else {
    verdict = "PASS";
    message = `${name}: r=${pearsonR.toFixed(3)} (expected ${expectedSign > 0 ? "+" : "-"}; magnitude informational)`;
  }

  return {
    name,
    predictor,
    outcome,
    expectedSign,
    sampleSize,
    pearsonR,
    verdict,
    message,
  };
}

function meanAttr(
  players: readonly Player[],
  key:
    | "perimeterDefense"
    | "interiorDefense"
    | "defensiveIq",
): number {
  if (players.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const player of players) {
    sum += player.attributes[key];
  }
  return sum / players.length;
}

function buildTeamDefensePairs(
  homePlayers: readonly Player[],
  awayPlayers: readonly Player[],
  snapshots: readonly GameSnapshot[],
): {
  perimeterDefense: number[];
  interiorDefense: number[];
  defensiveIq: number[];
  opponentPoints: number[];
} {
  const perimeterDefense: number[] = [];
  const interiorDefense: number[] = [];
  const defensiveIq: number[] = [];
  const opponentPoints: number[] = [];

  const homePerim = meanAttr(homePlayers, "perimeterDefense");
  const homeInt = meanAttr(homePlayers, "interiorDefense");
  const homeIq = meanAttr(homePlayers, "defensiveIq");
  const awayPerim = meanAttr(awayPlayers, "perimeterDefense");
  const awayInt = meanAttr(awayPlayers, "interiorDefense");
  const awayIq = meanAttr(awayPlayers, "defensiveIq");

  for (const game of snapshots) {
    // Home defense → away points
    perimeterDefense.push(homePerim);
    interiorDefense.push(homeInt);
    defensiveIq.push(homeIq);
    opponentPoints.push(game.awayScore);
    // Away defense → home points
    perimeterDefense.push(awayPerim);
    interiorDefense.push(awayInt);
    defensiveIq.push(awayIq);
    opponentPoints.push(game.homeScore);
  }

  return { perimeterDefense, interiorDefense, defensiveIq, opponentPoints };
}
