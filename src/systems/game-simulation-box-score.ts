/**
 * Fast statistical box-score simulation for CPU vs CPU games.
 * Produces a valid GameResult without a possession loop or play-by-play.
 * Deterministic when supplied with a deterministic Rng.
 */

import {
  createEmptyGamePlayerStats,
  type Game,
  type GamePlayerStats,
  type GameScore,
} from "@/domain/entities/game";
import {
  aggregateTeamStats,
  createGameResult,
  type GameResult,
} from "@/domain/entities/game-result";
import type { Player } from "@/domain/entities/player";
import type { TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { Rng } from "@/domain/rng";
import type { SimulationProfiler } from "@/systems/simulation/simulation-profiler";
import {
  GAME_SIMULATION_CONFIG,
  mergeGameSimulationConfig,
  type GameSimulationConfig,
} from "@/systems/game-simulation-config";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";

export type SimulateBoxScoreContext = {
  homePlayers: readonly Player[];
  awayPlayers: readonly Player[];
  homeStartingLineup?: readonly Player[];
  awayStartingLineup?: readonly Player[];
  config?: Partial<GameSimulationConfig>;
  profiler?: SimulationProfiler;
};

const BASE_TEAM_POINTS = 108;
const HOME_COURT_OVERALL_EDGE = 2;
const POINTS_PER_OVERALL = 0.45;
const SCORE_FLOOR = 78;
const SCORE_CEILING = 142;
const REGULATION_TEAM_MINUTES = ROTATION_CONFIG.regulationPlayerMinutes;
const PLAYING_ROTATION_SIZE = 10;

export function simulateGameBoxScore(
  game: Game,
  context: SimulateBoxScoreContext,
  rng: Rng,
): GameResult {
  if (rng == null || typeof rng.next !== "function") {
    throw new Error("simulateGameBoxScore requires an Rng.");
  }
  if (context.homePlayers.length === 0 || context.awayPlayers.length === 0) {
    throw new Error("simulateGameBoxScore requires home and away players.");
  }

  const totalStart = performance.now();
  const config = mergeGameSimulationConfig(context.config);
  const periodCount = config.regulationPeriodCount;

  const homeAvailable = availablePlayers(context.homePlayers);
  const awayAvailable = availablePlayers(context.awayPlayers);
  if (homeAvailable.length === 0 || awayAvailable.length === 0) {
    throw new Error(
      "simulateGameBoxScore requires at least one available player per team.",
    );
  }

  const homeRating = teamRating(homeAvailable);
  const awayRating = teamRating(awayAvailable);
  const { home: homePoints, away: awayPoints } = rollFinalScore(
    homeRating + HOME_COURT_OVERALL_EDGE,
    awayRating,
    rng,
  );

  const homeRows = buildTeamBoxScore({
    players: context.homePlayers,
    available: homeAvailable,
    starters: context.homeStartingLineup,
    teamId: game.homeTeamId,
    points: homePoints,
    rng,
  });
  const awayRows = buildTeamBoxScore({
    players: context.awayPlayers,
    available: awayAvailable,
    starters: context.awayStartingLineup,
    teamId: game.awayTeamId,
    points: awayPoints,
    rng,
  });

  const playerStats = [...homeRows, ...awayRows];
  const homePlayerStats = playerStats.filter(
    (row) => row.teamId === game.homeTeamId,
  );
  const awayPlayerStats = playerStats.filter(
    (row) => row.teamId === game.awayTeamId,
  );

  const periodScores = splitPeriodScores(
    { home: homePoints, away: awayPoints },
    periodCount,
    rng,
  );

  const possessionsHome = rng.nextInt(92, 108);
  const possessionsAway = rng.nextInt(92, 108);

  const result = createGameResult({
    gameId: game.id,
    seasonId: game.seasonId,
    date: game.date,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    status: "final",
    score: { home: homePoints, away: awayPoints },
    periodScores,
    overtimePeriodCount: 0,
    possessionCounts: { home: possessionsHome, away: possessionsAway },
    playerStats,
    teamStats: {
      home: aggregateTeamStats(game.homeTeamId, homePlayerStats),
      away: aggregateTeamStats(game.awayTeamId, awayPlayerStats),
    },
    events: [],
    rotationMeta: null,
  });

  if (context.profiler) {
    const totalMs = performance.now() - totalStart;
    const possessions = possessionsHome + possessionsAway;
    context.profiler.recordGame({
      possessions,
      events: 0,
      playersInvolved:
        context.homePlayers.length + context.awayPlayers.length,
      totalMs,
      validationMs: 0,
      decisionSelectionMs: 0,
      statsMs: totalMs,
      resolutionMs: 0,
      otherMs: 0,
      msPerPossession: possessions > 0 ? totalMs / possessions : 0,
      msPerEvent: 0,
    });
  }

  return result;
}

function availablePlayers(roster: readonly Player[]): Player[] {
  return roster.filter(
    (player) =>
      player.availability !== "out" &&
      player.availability !== "suspended" &&
      player.retired !== true,
  );
}

function teamRating(players: readonly Player[]): number {
  const ranked = [...players].sort(
    (a, b) =>
      calculatePlayerOverall(b.position, b.attributes) -
      calculatePlayerOverall(a.position, a.attributes),
  );
  const sample = ranked.slice(0, Math.min(8, ranked.length));
  const sum = sample.reduce(
    (total, player) =>
      total + calculatePlayerOverall(player.position, player.attributes),
    0,
  );
  return sum / sample.length;
}

function rollFinalScore(
  homeRating: number,
  awayRating: number,
  rng: Rng,
): GameScore {
  const homeBase =
    BASE_TEAM_POINTS + (homeRating - awayRating) * POINTS_PER_OVERALL;
  const awayBase =
    BASE_TEAM_POINTS + (awayRating - homeRating) * POINTS_PER_OVERALL;
  let home = clampScore(
    Math.round(homeBase) + rng.nextInt(-10, 10),
  );
  let away = clampScore(
    Math.round(awayBase) + rng.nextInt(-10, 10),
  );
  if (home === away) {
    if (rng.chance(0.5)) {
      home = Math.min(SCORE_CEILING, home + 1);
    } else {
      away = Math.min(SCORE_CEILING, away + 1);
    }
    if (home === away) {
      home = Math.max(SCORE_FLOOR, home - 1);
    }
  }
  return { home, away };
}

function clampScore(value: number): number {
  return Math.min(SCORE_CEILING, Math.max(SCORE_FLOOR, value));
}

function splitPeriodScores(
  score: GameScore,
  periodCount: number,
  rng: Rng,
): GameScore[] {
  const periods = Math.max(1, periodCount);
  const homeParts = allocateByWeight(
    Array.from({ length: periods }, () => rng.nextInt(8, 14)),
    score.home,
  );
  const awayParts = allocateByWeight(
    Array.from({ length: periods }, () => rng.nextInt(8, 14)),
    score.away,
  );
  return homeParts.map((home, index) => ({
    home,
    away: awayParts[index] ?? 0,
  }));
}

function buildTeamBoxScore(input: {
  players: readonly Player[];
  available: readonly Player[];
  starters: readonly Player[] | undefined;
  teamId: TeamId;
  points: number;
  rng: Rng;
}): GamePlayerStats[] {
  const { players, available, teamId, points, rng } = input;
  const ranked = [...available].sort(
    (a, b) =>
      calculatePlayerOverall(b.position, b.attributes) -
      calculatePlayerOverall(a.position, a.attributes),
  );
  const rotation = ranked.slice(
    0,
    Math.min(PLAYING_ROTATION_SIZE, ranked.length),
  );
  const starterIds = new Set(
    (input.starters ?? rotation.slice(0, GAME_SIMULATION_CONFIG.startingLineupSize))
      .slice(0, GAME_SIMULATION_CONFIG.startingLineupSize)
      .map((player) => player.id),
  );

  const minutes = allocateMinutes(rotation, rng);
  const weights = rotation.map((player, index) => {
    const overall = calculatePlayerOverall(player.position, player.attributes);
    return Math.max(1, overall * Math.max(1, minutes[index] ?? 0));
  });
  const playerPoints = allocateByWeight(weights, points);
  const oreb = allocateByWeight(weights, rng.nextInt(8, 16));
  const dreb = allocateByWeight(weights, rng.nextInt(28, 42));
  const ast = allocateByWeight(weights, rng.nextInt(14, 28));
  const tov = allocateByWeight(weights, rng.nextInt(10, 18));
  const fouls = allocateByWeight(weights, rng.nextInt(16, 26));
  const stl = allocateByWeight(weights, rng.nextInt(5, 12));
  const blk = allocateByWeight(weights, rng.nextInt(3, 8));

  const byId = new Map<string, GamePlayerStats>();
  for (let index = 0; index < rotation.length; index += 1) {
    const player = rotation[index]!;
    const shooting = decomposePoints(playerPoints[index] ?? 0, rng);
    const missFg = rng.nextInt(
      0,
      Math.max(0, Math.floor(shooting.fgm * 1.1)) + 2,
    );
    const missThree = Math.min(
      missFg,
      rng.nextInt(0, Math.max(0, shooting.threePm) + 2),
    );
    const missFt = rng.nextInt(
      0,
      Math.max(0, Math.floor(shooting.ftm * 0.5)) + 1,
    );
    const fga = shooting.fgm + missFg;
    const threePa = shooting.threePm + missThree;
    const row: GamePlayerStats = {
      playerId: player.id,
      teamId,
      firstName: player.firstName,
      lastName: player.lastName,
      minutes: minutes[index] ?? 0,
      points: playerPoints[index] ?? 0,
      rebounds: (oreb[index] ?? 0) + (dreb[index] ?? 0),
      offensiveRebounds: oreb[index] ?? 0,
      defensiveRebounds: dreb[index] ?? 0,
      assists: ast[index] ?? 0,
      steals: stl[index] ?? 0,
      blocks: blk[index] ?? 0,
      turnovers: tov[index] ?? 0,
      fouls: fouls[index] ?? 0,
      fieldGoalsMade: shooting.fgm,
      fieldGoalsAttempted: fga,
      threePointersMade: shooting.threePm,
      threePointersAttempted: threePa,
      freeThrowsMade: shooting.ftm,
      freeThrowsAttempted: shooting.ftm + missFt,
      touches: fga + (ast[index] ?? 0) + (tov[index] ?? 0) + shooting.ftm,
      started: starterIds.has(player.id) && (minutes[index] ?? 0) > 0,
    };
    byId.set(player.id, row);
  }

  return players.map((player) => {
    const existing = byId.get(player.id);
    if (existing) {
      return existing;
    }
    const empty = createEmptyGamePlayerStats(player.id);
    return {
      ...empty,
      teamId,
      firstName: player.firstName,
      lastName: player.lastName,
      started: false,
      minutes: 0,
    };
  });
}

function allocateMinutes(rotation: readonly Player[], rng: Rng): number[] {
  if (rotation.length === 0) {
    return [];
  }
  if (rotation.length <= 5) {
    return rotation.map(() => ROTATION_CONFIG.regulationMinutes);
  }
  const curve = rotation.map((_, index) => {
    if (index < 5) {
      return rng.nextInt(26, 36);
    }
    if (index < 8) {
      return rng.nextInt(12, 22);
    }
    return rng.nextInt(4, 14);
  });
  const allocated = allocateByWeight(curve, REGULATION_TEAM_MINUTES);
  return allocated.map((value) =>
    Math.min(ROTATION_CONFIG.regulationMinutes, Math.max(0, value)),
  );
}

function decomposePoints(
  points: number,
  rng: Rng,
): { fgm: number; threePm: number; ftm: number } {
  if (points <= 0) {
    return { fgm: 0, threePm: 0, ftm: 0 };
  }
  const maxThrees = Math.floor(points / 3);
  const threePm =
    maxThrees === 0
      ? 0
      : rng.nextInt(
          Math.min(maxThrees, Math.max(0, Math.floor(points * 0.08))),
          Math.min(maxThrees, Math.max(0, Math.floor(points * 0.2))),
        );
  const remaining = points - 3 * threePm;
  let twoPm = Math.floor(remaining / 2);
  let ftm = remaining - 2 * twoPm;
  if (ftm > 12) {
    const extraTwos = Math.floor((ftm - 4) / 2);
    twoPm += extraTwos;
    ftm -= extraTwos * 2;
  }
  return { fgm: twoPm + threePm, threePm, ftm };
}

function allocateByWeight(weights: readonly number[], total: number): number[] {
  const count = weights.length;
  if (count === 0) {
    return [];
  }
  if (total <= 0) {
    return Array.from({ length: count }, () => 0);
  }
  const safe = weights.map((weight) => (weight > 0 ? weight : 0));
  const sum = safe.reduce((acc, weight) => acc + weight, 0);
  if (sum <= 0) {
    const next = Array.from({ length: count }, () => 0);
    next[0] = total;
    return next;
  }
  const raw = safe.map((weight) => (weight / sum) * total);
  const floors = raw.map((value) => Math.floor(value));
  const remainder = total - floors.reduce((acc, value) => acc + value, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);
  for (let step = 0; step < remainder; step += 1) {
    const slot = order[step % order.length];
    if (slot) {
      floors[slot.index] = (floors[slot.index] ?? 0) + 1;
    }
  }
  return floors;
}
