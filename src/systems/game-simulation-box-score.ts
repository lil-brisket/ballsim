/**
 * Fast statistical box-score simulation for CPU vs CPU games.
 * Projects the same attributes as possession sim (shot/FT make rates, usage,
 * passing, rebounding, steal, block) without a possession loop or play-by-play.
 * Deterministic when supplied with a deterministic Rng.
 */

import {
  createEmptyGamePlayerStats,
  type Game,
  type GamePlayerStats,
  type GameScore,
} from "@/domain/entities/game";
import type { Player, PlayerPosition } from "@/domain/entities/player";
import { RATING_MAX } from "@/domain/entities/player";
import {
  aggregateTeamStats,
  createGameResult,
  type GameResult,
} from "@/domain/entities/game-result";
import type { TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { Rng } from "@/domain/rng";
import type { SimulationProfiler } from "@/systems/simulation/simulation-profiler";
import {
  GAME_SIMULATION_CONFIG,
  mergeGameSimulationConfig,
  type GameSimulationConfig,
} from "@/systems/game-simulation-config";
import { calculateFreeThrowProbability } from "@/systems/free-throw-resolution";
import { POSITION_REBOUND_MODIFIERS } from "@/systems/rebound-resolution-config";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";
import { SHOT_RESOLUTION_CONFIG } from "@/systems/shot-resolution-config";
import {
  calculateUsageScore,
  creationAbility,
  scoringAbility,
} from "@/systems/player-usage";
import { PLAYER_USAGE_CONFIG } from "@/systems/player-usage-config";

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
/** Minutes multiplier for players who are not fully available. */
const BOX_SCORE_MINUTES_BY_AVAILABILITY: Readonly<
  Partial<Record<Player["availability"], number>>
> = {
  limited: 0.45,
  questionable: 0.7,
  minor: 0.8,
  recovery: 0.75,
};

const ASSIST_TO_FGM_RATE = 0.58;
const POSITION_STEAL_MODIFIERS: Readonly<Record<PlayerPosition, number>> = {
  PG: 6,
  SG: 4,
  SF: 1,
  PF: -2,
  C: -4,
};
const POSITION_BLOCK_MODIFIERS: Readonly<Record<PlayerPosition, number>> = {
  PG: -6,
  SG: -4,
  SF: 0,
  PF: 5,
  C: 10,
};

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

  const possessionsHome = rng.nextInt(92, 108);
  const possessionsAway = rng.nextInt(92, 108);

  const homeRows = buildTeamBoxScore({
    players: context.homePlayers,
    available: homeAvailable,
    starters: context.homeStartingLineup,
    opponent: awayAvailable,
    teamId: game.homeTeamId,
    points: homePoints,
    possessions: possessionsHome,
    rng,
  });
  const awayRows = buildTeamBoxScore({
    players: context.awayPlayers,
    available: awayAvailable,
    starters: context.awayStartingLineup,
    opponent: homeAvailable,
    teamId: game.awayTeamId,
    points: awayPoints,
    possessions: possessionsAway,
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
      playersInvolved: context.homePlayers.length + context.awayPlayers.length,
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
  let home = clampScore(Math.round(homeBase) + rng.nextInt(-10, 10));
  let away = clampScore(Math.round(awayBase) + rng.nextInt(-10, 10));
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
  opponent: readonly Player[];
  teamId: TeamId;
  points: number;
  possessions: number;
  rng: Rng;
}): GamePlayerStats[] {
  const { players, available, teamId, points, possessions, rng } = input;
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
    (
      input.starters ??
      rotation.slice(0, GAME_SIMULATION_CONFIG.startingLineupSize)
    )
      .slice(0, GAME_SIMULATION_CONFIG.startingLineupSize)
      .map((player) => player.id),
  );

  const minutes = allocateMinutes(rotation, rng);
  const oppInterior = Math.max(
    58,
    meanAttribute(input.opponent, "interiorDefense"),
  );
  const oppPerimeter = Math.max(
    62,
    meanAttribute(input.opponent, "perimeterDefense"),
  );

  const scoringExponent = PLAYER_USAGE_CONFIG.boxScoreScoringExponent;
  const scoringWeights = rotation.map((player, index) => {
    const usage = calculateUsageScore(player);
    const talent = Math.max(1, usage * scoringAbility(player));
    return Math.max(
      1,
      Math.pow(talent, scoringExponent) * Math.max(1, minutes[index] ?? 0),
    );
  });
  const playerPoints = allocateByWeight(scoringWeights, points);

  const shooting = rotation.map((player, index) =>
    shootingFromPoints(
      player,
      playerPoints[index] ?? 0,
      oppInterior,
      oppPerimeter,
    ),
  );
  const teamFgm = shooting.reduce((sum, line) => sum + line.fgm, 0);

  const assistTotal = Math.min(
    teamFgm,
    Math.max(0, Math.round(teamFgm * ASSIST_TO_FGM_RATE) + rng.nextInt(-2, 2)),
  );
  const orebTotal = Math.round(possessions * 0.11) + rng.nextInt(-2, 2);
  const drebTotal = Math.round(possessions * 0.32) + rng.nextInt(-3, 3);
  const tovTotal = Math.round(possessions * 0.14) + rng.nextInt(-2, 2);
  const stlTotal = Math.round(possessions * 0.075) + rng.nextInt(-2, 1);
  const blkTotal = Math.round(possessions * 0.05) + rng.nextInt(-1, 1);
  const foulTotal = rng.nextInt(16, 26);

  const ast = allocateByWeight(
    rotation.map((player, index) =>
      skillWeight(
        creationAbility(player) + player.attributes.passing,
        minutes[index] ?? 0,
      ),
    ),
    Math.max(0, assistTotal),
  );
  const oreb = allocateByWeight(
    rotation.map((player, index) =>
      skillWeight(
        player.attributes.rebounding +
          POSITION_REBOUND_MODIFIERS[player.position],
        minutes[index] ?? 0,
      ),
    ),
    Math.max(0, orebTotal),
  );
  const dreb = allocateByWeight(
    rotation.map((player, index) =>
      skillWeight(
        player.attributes.rebounding +
          POSITION_REBOUND_MODIFIERS[player.position] +
          4,
        minutes[index] ?? 0,
      ),
    ),
    Math.max(0, drebTotal),
  );
  const tov = allocateByWeight(
    rotation.map((player, index) => {
      const handle =
        (player.attributes.ballHandling + player.attributes.basketballIq) / 2;
      return skillWeight(Math.max(8, RATING_MAX - handle), minutes[index] ?? 0);
    }),
    Math.max(0, tovTotal),
  );
  const fouls = allocateByWeight(
    rotation.map((player, index) =>
      skillWeight(player.attributes.interiorDefense, minutes[index] ?? 0),
    ),
    foulTotal,
  );
  const stl = allocateByWeight(
    rotation.map((player, index) =>
      skillWeight(
        player.attributes.steal + POSITION_STEAL_MODIFIERS[player.position],
        minutes[index] ?? 0,
      ),
    ),
    Math.max(0, stlTotal),
  );
  const blk = allocateByWeight(
    rotation.map((player, index) =>
      skillWeight(
        player.attributes.block + POSITION_BLOCK_MODIFIERS[player.position],
        minutes[index] ?? 0,
      ),
    ),
    Math.max(0, blkTotal),
  );

  const byId = new Map<string, GamePlayerStats>();
  for (let index = 0; index < rotation.length; index += 1) {
    const player = rotation[index]!;
    const line = shooting[index]!;
    const fga = line.fga;
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
      fieldGoalsMade: line.fgm,
      fieldGoalsAttempted: fga,
      threePointersMade: line.threePm,
      threePointersAttempted: line.threePa,
      freeThrowsMade: line.ftm,
      freeThrowsAttempted: line.fta,
      touches: fga + (ast[index] ?? 0) + (tov[index] ?? 0) + line.ftm,
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
  const curve = rotation.map((player, index) => {
    const availabilityFactor =
      BOX_SCORE_MINUTES_BY_AVAILABILITY[player.availability] ?? 1;
    const base =
      index < 5
        ? rng.nextInt(26, 36)
        : index < 8
          ? rng.nextInt(12, 22)
          : rng.nextInt(4, 14);
    return Math.max(1, Math.round(base * availabilityFactor));
  });
  const allocated = allocateByWeight(curve, REGULATION_TEAM_MINUTES);
  return allocated.map((value) =>
    Math.min(ROTATION_CONFIG.regulationMinutes, Math.max(0, value)),
  );
}

function shootingFromPoints(
  player: Player,
  points: number,
  oppInterior: number,
  oppPerimeter: number,
): {
  fgm: number;
  fga: number;
  threePm: number;
  threePa: number;
  ftm: number;
  fta: number;
} {
  if (points <= 0) {
    return { fgm: 0, fga: 0, threePm: 0, threePa: 0, ftm: 0, fta: 0 };
  }

  const twoPct = twoPointMakeRate(player, oppInterior);
  const threePct = threePointMakeRate(player, oppPerimeter);
  const ftPct = freeThrowMakeRate(player);
  const threeShare = threePointScoringShare(player);
  const ftShare = clamp(
    0.1,
    0.22,
    0.12 + (player.attributes.finishing - 50) / 400,
  );

  let threePm = Math.round((points * threeShare) / 3);
  let ftm = Math.round(points * ftShare);
  let remaining = points - 3 * threePm - ftm;
  if (remaining < 0) {
    ftm = Math.max(0, ftm + remaining);
    remaining = points - 3 * threePm - ftm;
  }
  if (remaining < 0) {
    const cut = Math.ceil(-remaining / 3);
    threePm = Math.max(0, threePm - cut);
    remaining = points - 3 * threePm - ftm;
  }
  let twoPm = Math.floor(Math.max(0, remaining) / 2);
  ftm += remaining - 2 * twoPm;
  if (ftm < 0) {
    twoPm = Math.max(0, twoPm + Math.floor(ftm / 2));
    ftm = points - 2 * twoPm - 3 * threePm;
  }
  while (2 * twoPm + 3 * threePm + ftm > points && twoPm > 0) {
    twoPm -= 1;
    ftm += 2;
  }
  while (2 * twoPm + 3 * threePm + ftm < points) {
    ftm += 1;
  }
  if (ftm < 0) {
    ftm = 0;
    twoPm = Math.floor(points / 2);
    threePm = 0;
    ftm = points - 2 * twoPm;
  }

  const twoPa =
    twoPm === 0
      ? 0
      : Math.max(twoPm, Math.round(twoPm / Math.max(0.12, twoPct)));
  const threePa =
    threePm === 0
      ? 0
      : Math.max(threePm, Math.round(threePm / Math.max(0.12, threePct)));
  const fta =
    ftm === 0 ? 0 : Math.max(ftm, Math.round(ftm / Math.max(0.4, ftPct)));

  return {
    fgm: twoPm + threePm,
    fga: twoPa + threePa,
    threePm,
    threePa,
    ftm,
    fta,
  };
}

function threePointScoringShare(player: Player): number {
  const threePoint = player.attributes.threePoint;
  const tendency = Math.pow(Math.max(0, threePoint - 52) / 47, 1.15);
  return clamp(0.08, 0.46, 0.1 + 0.36 * tendency);
}

function twoPointMakeRate(player: Player, oppInterior: number): number {
  const ability =
    (player.attributes.finishing + player.attributes.midRange) / 2;
  return clampShotProbability(
    ability / RATING_MAX +
      SHOT_RESOLUTION_CONFIG.baselineProbability +
      SHOT_RESOLUTION_CONFIG.twoPointAdjustment -
      (oppInterior / RATING_MAX) * SHOT_RESOLUTION_CONFIG.defensiveImpact,
  );
}

function threePointMakeRate(player: Player, oppPerimeter: number): number {
  return clampShotProbability(
    player.attributes.threePoint / RATING_MAX +
      SHOT_RESOLUTION_CONFIG.baselineProbability +
      SHOT_RESOLUTION_CONFIG.threePointAdjustment -
      (oppPerimeter / RATING_MAX) * SHOT_RESOLUTION_CONFIG.defensiveImpact -
      0.015,
  );
}

function freeThrowMakeRate(player: Player): number {
  return calculateFreeThrowProbability({ shooter: player });
}

function clampShotProbability(value: number): number {
  return Math.min(
    SHOT_RESOLUTION_CONFIG.maxProbability,
    Math.max(SHOT_RESOLUTION_CONFIG.minProbability, value),
  );
}

function skillWeight(skill: number, minutes: number): number {
  return Math.max(1, Math.max(1, skill) * Math.max(1, minutes));
}

function meanAttribute(
  players: readonly Player[],
  key: "interiorDefense" | "perimeterDefense",
): number {
  if (players.length === 0) {
    return 70;
  }
  const sum = players.reduce(
    (total, player) => total + player.attributes[key],
    0,
  );
  return sum / players.length;
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
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
