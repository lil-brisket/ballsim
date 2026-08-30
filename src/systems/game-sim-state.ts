/**
 * Canonical mutable in-game simulation representation.
 * Domain/persistence Game is produced once via finalizeGameSimState → createGame.
 */

import {
  createEmptyGamePlayerStats,
  createGame,
  type Game,
  type GameCompetitionType,
  type GameEvent,
  type GamePlayerStats,
  type GameRotationMeta,
  type GameScore,
} from "@/domain/entities/game";
import type { Player } from "@/domain/entities/player";
import type { RotationEntry } from "@/domain/entities/team-roster-management";
import type { GameId, PlayerId, SeasonId, TeamId } from "@/domain/ids";
import type { PlayerStatsDelta } from "@/systems/possession-stats";
import type { RotationPlan } from "@/systems/rotation/rotation-planner";
import type { RotationTraceEntry } from "@/systems/rotation/rotation-trace";
import type { FoulTroubleLevel } from "@/systems/rotation/rotation-foul-trouble";
import type { GameSituation } from "@/systems/rotation/rotation-game-context";

export type GameSimState = {
  id: GameId;
  seasonId: SeasonId;
  date: string;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  competitionType: GameCompetitionType;
  homeScore: number;
  awayScore: number;
  periodScores: GameScore[];
  events: GameEvent[];
  /** Indexed player stats for O(1) possession updates. */
  playerStatsById: Map<string, GamePlayerStats>;
  /** Stable finalize order (home roster then away roster). */
  playerStatsOrder: PlayerId[];
  possessionIndex: number;
  eventSequenceStart: number;
  possessionCounts: { home: number; away: number };
  secondsOnCourt: Map<string, number>;
  homeOnCourt: Player[];
  awayOnCourt: Player[];
  /** Continuous stretch since last sub-in. */
  continuousSecondsOnCourt: Map<string, number>;
  fatigueByPlayerId: Map<string, number>;
  lastSubElapsedSeconds: Map<string, number>;
  fouledOutPlayerIds: Set<string>;
  /** Mid-game injuries / other unavailability during this sim. */
  unavailablePlayerIds: Set<string>;
  rotationTrace: RotationTraceEntry[];
  rotationExplanations: Map<string, string[]>;
  /** Frozen at tip-off from TeamRosterManagement. */
  homeRotationSnapshot: RotationEntry[];
  awayRotationSnapshot: RotationEntry[];
  homeRotationPlan: RotationPlan | null;
  awayRotationPlan: RotationPlan | null;
  /** Peak foul trouble seen (for explanations). */
  peakFoulTroubleByPlayerId: Map<string, FoulTroubleLevel>;
  peakFatigueByPlayerId: Map<string, number>;
  situationsSeen: Set<GameSituation>;
  /** Elapsed regulation+OT game clock seconds. */
  elapsedGameSeconds: number;
  /** Windows already evaluated this period (avoid double-firing). */
  windowsFiredThisPeriod: Set<string>;
  overtimePeriodCount: number;
};

export type CreateGameSimStateInput = {
  game: Game;
  homePlayers: readonly Player[];
  awayPlayers: readonly Player[];
  homeOnCourt: readonly Player[];
  awayOnCourt: readonly Player[];
};

/**
 * Builds a fresh GameSimState from a scheduled/in-progress Game and lineups.
 * Does not validate the full Game entity (that happens at finalize).
 */
export function createGameSimState(input: CreateGameSimStateInput): GameSimState {
  const playerStatsById = new Map<string, GamePlayerStats>();
  const playerStatsOrder: PlayerId[] = [];

  for (const player of input.homePlayers) {
    playerStatsById.set(player.id, createEmptyGamePlayerStats(player.id));
    playerStatsOrder.push(player.id);
  }
  for (const player of input.awayPlayers) {
    playerStatsById.set(player.id, createEmptyGamePlayerStats(player.id));
    playerStatsOrder.push(player.id);
  }

  const onCourtIds = new Set<string>([
    ...input.homeOnCourt.map((player) => player.id),
    ...input.awayOnCourt.map((player) => player.id),
  ]);
  const secondsOnCourt = new Map<string, number>();
  for (const playerId of onCourtIds) {
    secondsOnCourt.set(playerId, 0);
  }

  return {
    id: input.game.id,
    seasonId: input.game.seasonId,
    date: input.game.date,
    homeTeamId: input.game.homeTeamId,
    awayTeamId: input.game.awayTeamId,
    competitionType: input.game.competitionType,
    homeScore: 0,
    awayScore: 0,
    periodScores: [],
    events: [],
    playerStatsById,
    playerStatsOrder,
    possessionIndex: 0,
    eventSequenceStart: 0,
    possessionCounts: { home: 0, away: 0 },
    secondsOnCourt,
    homeOnCourt: [...input.homeOnCourt],
    awayOnCourt: [...input.awayOnCourt],
    continuousSecondsOnCourt: new Map(
      [...onCourtIds].map((id) => [id, 0]),
    ),
    fatigueByPlayerId: new Map(),
    lastSubElapsedSeconds: new Map(),
    fouledOutPlayerIds: new Set(),
    unavailablePlayerIds: new Set(),
    rotationTrace: [],
    rotationExplanations: new Map(),
    homeRotationSnapshot: [],
    awayRotationSnapshot: [],
    homeRotationPlan: null,
    awayRotationPlan: null,
    peakFoulTroubleByPlayerId: new Map(),
    peakFatigueByPlayerId: new Map(),
    situationsSeen: new Set(),
    elapsedGameSeconds: 0,
    windowsFiredThisPeriod: new Set(),
    overtimePeriodCount: 0,
  };
}

/**
 * Lightweight structural check for a newly produced event (hot path).
 * Full event-array validation happens once in finalizeGameSimState.
 */
export function assertSimEventStructurallyValid(event: GameEvent): void {
  if (event === null || typeof event !== "object" || Array.isArray(event)) {
    throw new Error("GameSim event must be an object.");
  }
  if (!Number.isInteger(event.sequence) || event.sequence < 0) {
    throw new Error("GameSim event.sequence must be a non-negative integer.");
  }
  if (typeof event.type !== "string" || event.type.length === 0) {
    throw new Error("GameSim event.type must be a non-empty string.");
  }
}

/**
 * Applies one possession resolution into the mutable sim buffer.
 * Does not call createGame / assertEvents.
 */
export function applyPossessionToSimState(
  sim: GameSimState,
  result: {
    events: readonly GameEvent[];
    playerStats: readonly PlayerStatsDelta[];
    pointsScored: number;
    scoringTeamId: TeamId | null;
  },
): void {
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

  if (result.pointsScored > 0 && result.scoringTeamId !== null) {
    if (result.scoringTeamId === sim.homeTeamId) {
      sim.homeScore += result.pointsScored;
    } else if (result.scoringTeamId === sim.awayTeamId) {
      sim.awayScore += result.pointsScored;
    } else {
      throw new Error(
        "Possession apply scoringTeamId must be the home or away team.",
      );
    }
  }

  for (const event of result.events) {
    assertSimEventStructurallyValid(event);
    sim.events.push({
      sequence: event.sequence,
      type: event.type,
      playerId: event.playerId,
      teamId: event.teamId,
    });
  }

  for (const delta of result.playerStats) {
    const row = sim.playerStatsById.get(delta.playerId);
    if (row == null) {
      throw new Error(
        `Possession apply has no GamePlayerStats row for player ${delta.playerId}.`,
      );
    }
    row.points += delta.points;
    row.rebounds += delta.rebounds;
    row.offensiveRebounds += delta.offensiveRebounds;
    row.defensiveRebounds += delta.defensiveRebounds;
    row.assists += delta.assists;
    row.turnovers += delta.turnovers;
    row.fouls += delta.fouls;
    row.fieldGoalsMade += delta.fieldGoalsMade;
    row.fieldGoalsAttempted += delta.fieldGoalsAttempted;
    row.threePointersMade += delta.threePointersMade;
    row.threePointersAttempted += delta.threePointersAttempted;
    row.freeThrowsMade += delta.freeThrowsMade;
    row.freeThrowsAttempted += delta.freeThrowsAttempted;
    row.touches += delta.touches;
  }
}

export function appendPeriodScore(sim: GameSimState, delta: GameScore): void {
  sim.periodScores.push({ home: delta.home, away: delta.away });
}

export function finalizeMinutesOnSimState(sim: GameSimState): void {
  for (const playerId of sim.playerStatsOrder) {
    const row = sim.playerStatsById.get(playerId);
    if (row == null) {
      continue;
    }
    row.minutes = Math.floor((sim.secondsOnCourt.get(playerId) ?? 0) / 60);
  }
}

/**
 * Stats conservation: team score must equal sum of player points for that team.
 * Players are attributed by which roster they appear on via teamId if set,
 * otherwise by membership in home/away on-court + roster order lists passed in.
 */
export function assertGameSimStatsConservation(
  sim: GameSimState,
  homePlayerIds: ReadonlySet<string>,
  awayPlayerIds: ReadonlySet<string>,
): void {
  let homePoints = 0;
  let awayPoints = 0;
  for (const playerId of sim.playerStatsOrder) {
    const row = sim.playerStatsById.get(playerId);
    if (row == null) {
      continue;
    }
    if (row.points < 0 || row.rebounds < 0 || row.fouls < 0) {
      throw new Error(
        `GameSim player ${playerId} has impossible negative stats.`,
      );
    }
    if (homePlayerIds.has(playerId)) {
      homePoints += row.points;
    } else if (awayPlayerIds.has(playerId)) {
      awayPoints += row.points;
    }
  }
  if (homePoints !== sim.homeScore || awayPoints !== sim.awayScore) {
    throw new Error(
      `GameSim stats conservation failed: score ${sim.homeScore}-${sim.awayScore} vs player sums ${homePoints}-${awayPoints}.`,
    );
  }
}

/**
 * Converts GameSimState → validated domain Game (single createGame call).
 */
export function finalizeGameSimState(
  sim: GameSimState,
  status: "in_progress" | "final" = "final",
): Game {
  const playerStats = sim.playerStatsOrder.map((playerId) => {
    const row = sim.playerStatsById.get(playerId);
    if (row == null) {
      throw new Error(`GameSim missing stats for player ${playerId}.`);
    }
    return { ...row };
  });

  const explanations: Record<string, string[]> = {};
  for (const [playerId, reasons] of sim.rotationExplanations) {
    explanations[playerId] = [...reasons];
  }

  const rotationMeta: GameRotationMeta | null =
    sim.homeRotationSnapshot.length > 0 || sim.awayRotationSnapshot.length > 0
      ? {
          home: sim.homeRotationSnapshot.map((entry) => ({
            playerId: entry.playerId,
            targetMinutes: entry.targetMinutes,
            minimumMinutes: entry.minimumMinutes,
            normalMaximumMinutes: entry.normalMaximumMinutes,
            absoluteMaximumMinutes: entry.absoluteMaximumMinutes,
            role: entry.role,
          })),
          away: sim.awayRotationSnapshot.map((entry) => ({
            playerId: entry.playerId,
            targetMinutes: entry.targetMinutes,
            minimumMinutes: entry.minimumMinutes,
            normalMaximumMinutes: entry.normalMaximumMinutes,
            absoluteMaximumMinutes: entry.absoluteMaximumMinutes,
            role: entry.role,
          })),
          trace: sim.rotationTrace.map((entry) => ({ ...entry })),
          explanations,
        }
      : null;

  return createGame({
    id: sim.id,
    seasonId: sim.seasonId,
    date: sim.date,
    homeTeamId: sim.homeTeamId,
    awayTeamId: sim.awayTeamId,
    competitionType: sim.competitionType,
    status,
    score: { home: sim.homeScore, away: sim.awayScore },
    periodScores: sim.periodScores.map((period) => ({ ...period })),
    events: sim.events.map((event) => ({ ...event })),
    playerStats,
    homeTeamSnapshot: null,
    awayTeamSnapshot: null,
    rotationMeta,
  });
}

/** Stable lineup key for coach/usage cache invalidation. */
export function lineupCacheKey(
  offensivePlayers: readonly Player[],
  defensivePlayers: readonly Player[],
): string {
  let key = "o:";
  for (const player of offensivePlayers) {
    key += player.id;
    key += ",";
  }
  key += "|d:";
  for (const player of defensivePlayers) {
    key += player.id;
    key += ",";
  }
  return key;
}
