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
import { PLAY_CODE, type PlayByPlayLog } from "@/domain/entities/play-by-play";
import type {
  PlayerStatsDelta,
  PossessionPlay,
} from "@/systems/possession-stats";
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
  /** Roster side of every player, fixed at tip-off. */
  playerSide: Map<string, "home" | "away">;
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
  /** Play-by-play buffer; null unless the game records a log (owner games). */
  playByPlay: PlayByPlayLog | null;
  /** Player id → index in playByPlay.players. */
  playByPlayIndex: Map<string, number>;
};

export type CreateGameSimStateInput = {
  game: Game;
  homePlayers: readonly Player[];
  awayPlayers: readonly Player[];
  homeOnCourt: readonly Player[];
  awayOnCourt: readonly Player[];
  recordPlayByPlay?: boolean;
};

/**
 * Builds a fresh GameSimState from a scheduled/in-progress Game and lineups.
 * Does not validate the full Game entity (that happens at finalize).
 */
export function createGameSimState(
  input: CreateGameSimStateInput,
): GameSimState {
  const playerStatsById = new Map<string, GamePlayerStats>();
  const playerStatsOrder: PlayerId[] = [];
  const playerSide = new Map<string, "home" | "away">();

  const starterIds = new Set<string>([
    ...input.homeOnCourt.map((player) => player.id),
    ...input.awayOnCourt.map((player) => player.id),
  ]);

  for (const player of input.homePlayers) {
    const row = createEmptyGamePlayerStats(player.id);
    row.started = starterIds.has(player.id);
    playerStatsById.set(player.id, row);
    playerStatsOrder.push(player.id);
    playerSide.set(player.id, "home");
  }
  for (const player of input.awayPlayers) {
    const row = createEmptyGamePlayerStats(player.id);
    row.started = starterIds.has(player.id);
    playerStatsById.set(player.id, row);
    playerStatsOrder.push(player.id);
    playerSide.set(player.id, "away");
  }

  const onCourtIds = starterIds;
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
    playerSide,
    possessionIndex: 0,
    eventSequenceStart: 0,
    possessionCounts: { home: 0, away: 0 },
    secondsOnCourt,
    homeOnCourt: [...input.homeOnCourt],
    awayOnCourt: [...input.awayOnCourt],
    continuousSecondsOnCourt: new Map([...onCourtIds].map((id) => [id, 0])),
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
    playByPlay:
      input.recordPlayByPlay === true
        ? {
            v: 1,
            players: [],
            period: [],
            clock: [],
            poss: [],
            code: [],
            side: [],
            player: [],
            player2: [],
          }
        : null,
    playByPlayIndex: new Map(),
  };
}

function playByPlayPlayerIndex(sim: GameSimState, playerId: PlayerId): number {
  const existing = sim.playByPlayIndex.get(playerId);
  if (existing !== undefined) {
    return existing;
  }
  const index = sim.playByPlay!.players.length;
  sim.playByPlay!.players.push(playerId);
  sim.playByPlayIndex.set(playerId, index);
  return index;
}

function appendPlayRow(
  sim: GameSimState,
  row: {
    period: number;
    clock: number;
    poss: number;
    code: number;
    teamId: TeamId;
    playerId: PlayerId;
    player2Id: PlayerId | null;
  },
): void {
  const log = sim.playByPlay!;
  log.period.push(row.period);
  log.clock.push(Math.max(0, Math.round(row.clock)));
  log.poss.push(row.poss);
  log.code.push(row.code);
  log.side.push(row.teamId === sim.homeTeamId ? 0 : 1);
  log.player.push(playByPlayPlayerIndex(sim, row.playerId));
  log.player2.push(
    row.player2Id == null ? -1 : playByPlayPlayerIndex(sim, row.player2Id),
  );
}

/**
 * Stamps one possession's plays with period, start-of-possession clock and
 * possession number. No-op when the game is not recording.
 */
export function appendPossessionPlays(
  sim: GameSimState,
  plays: readonly PossessionPlay[] | null,
  periodNumber: number,
  possessionStartSeconds: number,
): void {
  if (sim.playByPlay == null || plays == null) {
    return;
  }
  for (const play of plays) {
    appendPlayRow(sim, {
      period: periodNumber,
      clock: possessionStartSeconds,
      poss: sim.possessionIndex,
      code: play.code,
      teamId: play.teamId,
      playerId: play.playerId,
      player2Id: play.player2Id,
    });
  }
}

/** Records a substitution at a rotation checkpoint. No-op when not recording. */
export function appendSubstitutionPlay(
  sim: GameSimState,
  input: {
    periodNumber: number;
    secondsRemaining: number;
    teamId: TeamId;
    playerOutId: PlayerId;
    playerInId: PlayerId;
  },
): void {
  if (sim.playByPlay == null) {
    return;
  }
  appendPlayRow(sim, {
    period: input.periodNumber,
    clock: input.secondsRemaining,
    poss: sim.possessionIndex,
    code: PLAY_CODE.substitution,
    teamId: input.teamId,
    playerId: input.playerOutId,
    player2Id: input.playerInId,
  });
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
    row.steals += delta.steals;
    row.blocks += delta.blocks;
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

/**
 * Converts on-court seconds to whole minutes per player. Seconds are
 * authoritative; flooring each player independently loses up to a minute per
 * rotation player (a team summed to ~234 instead of 240), so each team's
 * remainder minutes go to the largest fractional parts and the team total
 * equals round(team seconds / 60).
 */
export function finalizeMinutesOnSimState(sim: GameSimState): void {
  const byTeam = new Map<string, { playerId: string; seconds: number }[]>();
  for (const playerId of sim.playerStatsOrder) {
    const row = sim.playerStatsById.get(playerId);
    if (row == null) {
      continue;
    }
    const key = sim.playerSide.get(playerId) ?? "";
    const group = byTeam.get(key) ?? [];
    group.push({ playerId, seconds: sim.secondsOnCourt.get(playerId) ?? 0 });
    byTeam.set(key, group);
  }
  for (const group of byTeam.values()) {
    const totalSeconds = group.reduce((sum, entry) => sum + entry.seconds, 0);
    const floors = group.map((entry) => Math.floor(entry.seconds / 60));
    let remainder =
      Math.round(totalSeconds / 60) -
      floors.reduce((sum, value) => sum + value, 0);
    const order = group
      .map((entry, index) => ({
        index,
        fraction: entry.seconds / 60 - floors[index]!,
      }))
      .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
    for (const { index } of order) {
      if (remainder <= 0) {
        break;
      }
      floors[index] = floors[index]! + 1;
      remainder -= 1;
    }
    group.forEach((entry, index) => {
      const row = sim.playerStatsById.get(entry.playerId);
      if (row != null) {
        row.minutes = floors[index]!;
      }
    });
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
