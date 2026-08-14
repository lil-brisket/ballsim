import {
  createGame,
  type Game,
  type GameEvent,
  type GameEventType,
} from "@/domain/entities/game";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { ShotType } from "@/systems/shot-resolution-config";

export type PlayerStatsDelta = {
  playerId: PlayerId;
  points: number;
  rebounds: number;
  assists: number;
  turnovers: number;
  fouls: number;
};

export type PossessionStatsAccumulator = {
  events: GameEvent[];
  deltas: Map<string, PlayerStatsDelta>;
  pointsScored: number;
  nextSequence: number;
};

export function createPossessionStatsAccumulator(
  eventSequenceStart: number,
): PossessionStatsAccumulator {
  if (
    !Number.isInteger(eventSequenceStart) ||
    eventSequenceStart < 0
  ) {
    throw new Error(
      "Possession eventSequenceStart must be a non-negative integer.",
    );
  }
  return {
    events: [],
    deltas: new Map(),
    pointsScored: 0,
    nextSequence: eventSequenceStart,
  };
}

export function fieldGoalPoints(shotType: ShotType): number {
  return shotType === "three_point" ? 3 : 2;
}

export function pushEvent(
  accumulator: PossessionStatsAccumulator,
  type: GameEventType,
  playerId: PlayerId | null,
  teamId: TeamId | null,
): void {
  accumulator.events.push({
    sequence: accumulator.nextSequence,
    type,
    playerId,
    teamId,
  });
  accumulator.nextSequence += 1;
}

export function addPoints(
  accumulator: PossessionStatsAccumulator,
  playerId: PlayerId,
  points: number,
): void {
  if (points === 0) {
    return;
  }
  const delta = ensureDelta(accumulator, playerId);
  delta.points += points;
  accumulator.pointsScored += points;
}

export function addRebound(
  accumulator: PossessionStatsAccumulator,
  playerId: PlayerId,
): void {
  ensureDelta(accumulator, playerId).rebounds += 1;
}

export function addAssist(
  accumulator: PossessionStatsAccumulator,
  playerId: PlayerId,
): void {
  ensureDelta(accumulator, playerId).assists += 1;
}

export function addTurnover(
  accumulator: PossessionStatsAccumulator,
  playerId: PlayerId,
): void {
  ensureDelta(accumulator, playerId).turnovers += 1;
}

export function addFoul(
  accumulator: PossessionStatsAccumulator,
  playerId: PlayerId,
): void {
  ensureDelta(accumulator, playerId).fouls += 1;
}

export function finalizePlayerStatsDeltas(
  accumulator: PossessionStatsAccumulator,
): PlayerStatsDelta[] {
  const result: PlayerStatsDelta[] = [];
  for (const delta of accumulator.deltas.values()) {
    if (
      delta.points !== 0 ||
      delta.rebounds !== 0 ||
      delta.assists !== 0 ||
      delta.turnovers !== 0 ||
      delta.fouls !== 0
    ) {
      result.push({ ...delta });
    }
  }
  return result;
}

/**
 * Returns a new Game with score, events, and playerStats updated from the
 * possession result. Does not mutate the supplied game.
 */
export function applyPossessionResolution(
  game: Game,
  result: {
    events: readonly GameEvent[];
    playerStats: readonly PlayerStatsDelta[];
    pointsScored: number;
    scoringTeamId: TeamId | null;
  },
): Game {
  if (result.pointsScored === 0 && result.scoringTeamId !== null) {
    throw new Error(
      "Possession apply requires scoringTeamId null when pointsScored is 0.",
    );
  }
  if (result.pointsScored > 0 && result.scoringTeamId === null) {
    throw new Error(
      "Possession apply requires scoringTeamId when pointsScored is greater than 0.",
    );
  }

  const score = { ...game.score };
  if (result.pointsScored > 0 && result.scoringTeamId !== null) {
    if (result.scoringTeamId === game.homeTeamId) {
      score.home += result.pointsScored;
    } else if (result.scoringTeamId === game.awayTeamId) {
      score.away += result.pointsScored;
    } else {
      throw new Error(
        "Possession apply scoringTeamId must be the home or away team.",
      );
    }
  }

  const playerStats = game.playerStats.map((row) => ({ ...row }));
  for (const delta of result.playerStats) {
    const index = playerStats.findIndex(
      (row) => row.playerId === delta.playerId,
    );
    if (index < 0) {
      throw new Error(
        `Possession apply has no GamePlayerStats row for player ${delta.playerId}.`,
      );
    }
    const row = playerStats[index]!;
    playerStats[index] = {
      ...row,
      points: row.points + delta.points,
      rebounds: row.rebounds + delta.rebounds,
      assists: row.assists + delta.assists,
      turnovers: row.turnovers + delta.turnovers,
      fouls: row.fouls + delta.fouls,
    };
  }

  return createGame({
    id: game.id,
    seasonId: game.seasonId,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    date: game.date,
    status: game.status,
    score,
    events: [...game.events, ...result.events.map((event) => ({ ...event }))],
    playerStats,
  });
}

function ensureDelta(
  accumulator: PossessionStatsAccumulator,
  playerId: PlayerId,
): PlayerStatsDelta {
  const existing = accumulator.deltas.get(playerId);
  if (existing != null) {
    return existing;
  }
  const created: PlayerStatsDelta = {
    playerId,
    points: 0,
    rebounds: 0,
    assists: 0,
    turnovers: 0,
    fouls: 0,
  };
  accumulator.deltas.set(playerId, created);
  return created;
}
