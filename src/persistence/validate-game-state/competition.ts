import {
  type Game,
  GAME_STATUSES,
  GAME_COMPETITION_TYPES,
  type GameCompetitionType,
  type GameTeamSnapshot,
} from "@/domain/entities/game";
import { parseCalendarDate } from "@/domain/calendar-date";
import type { PlayoffTournament } from "@/domain/entities/playoffs";
import { isDomainEventType, DOMAIN_EVENT_TYPES } from "@/domain/events";
import type { GameState } from "@/state/game-state";
import {
  assertPlayByPlayLog,
  playCodePoints,
} from "@/domain/entities/play-by-play";
import { GAME_SIMULATION_CONFIG } from "@/systems/game-simulation-config";
import {
  assertRecord,
  assertNonEmptyString,
  fail,
  assertNumber,
} from "@/persistence/validate-game-state/primitives";

const PLAYOFF_TOURNAMENT_STATUSES = [
  "not_started",
  "in_progress",
  "complete",
] as const;

const PLAYOFF_SERIES_STATUSES = ["pending", "active", "complete"] as const;

export function validateGame(
  gameKey: string,
  gameValue: unknown,
  seasonId: string,
  teamIds: Set<string>,
  playerIds: Set<string>,
): void {
  assertRecord(gameValue, `competition.games[${gameKey}]`);
  const game = gameValue as Partial<Game>;
  assertNonEmptyString(game.id, `competition.games[${gameKey}].id`);
  if (game.id !== gameKey) {
    fail(`competition.games key "${gameKey}" does not match game.id.`);
  }
  assertNonEmptyString(game.seasonId, `competition.games[${gameKey}].seasonId`);
  if (game.seasonId !== seasonId) {
    fail(
      `competition.games[${gameKey}].seasonId must match competition.season.id.`,
    );
  }
  assertNonEmptyString(game.date, `competition.games[${gameKey}].date`);
  try {
    parseCalendarDate(game.date);
  } catch (error) {
    fail(
      error instanceof Error
        ? `competition.games[${gameKey}].date: ${error.message}`
        : `competition.games[${gameKey}].date is invalid.`,
    );
  }
  assertNonEmptyString(
    game.homeTeamId,
    `competition.games[${gameKey}].homeTeamId`,
  );
  assertNonEmptyString(
    game.awayTeamId,
    `competition.games[${gameKey}].awayTeamId`,
  );
  if (!teamIds.has(game.homeTeamId)) {
    fail(
      `competition.games[${gameKey}].homeTeamId "${game.homeTeamId}" is missing from world.teams.`,
    );
  }
  if (!teamIds.has(game.awayTeamId)) {
    fail(
      `competition.games[${gameKey}].awayTeamId "${game.awayTeamId}" is missing from world.teams.`,
    );
  }
  if (
    typeof game.status !== "string" ||
    !GAME_STATUSES.includes(game.status as (typeof GAME_STATUSES)[number])
  ) {
    fail(
      `competition.games[${gameKey}].status must be one of ${GAME_STATUSES.join(", ")}.`,
    );
  }

  if (
    typeof game.competitionType !== "string" ||
    !GAME_COMPETITION_TYPES.includes(
      game.competitionType as GameCompetitionType,
    )
  ) {
    fail(
      `competition.games[${gameKey}].competitionType must be one of ${GAME_COMPETITION_TYPES.join(", ")}.`,
    );
  }

  validateTeamSnapshotField(
    game.homeTeamSnapshot,
    `competition.games[${gameKey}].homeTeamSnapshot`,
    game.homeTeamId,
    teamIds,
  );
  validateTeamSnapshotField(
    game.awayTeamSnapshot,
    `competition.games[${gameKey}].awayTeamSnapshot`,
    game.awayTeamId,
    teamIds,
  );

  if (!Array.isArray(game.playerStats)) {
    fail(`competition.games[${gameKey}].playerStats must be an array.`);
  }
  for (const [index, stats] of game.playerStats.entries()) {
    assertRecord(stats, `competition.games[${gameKey}].playerStats[${index}]`);
    assertNonEmptyString(
      stats.playerId,
      `competition.games[${gameKey}].playerStats[${index}].playerId`,
    );
    if (!playerIds.has(stats.playerId as string)) {
      fail(
        `competition.games[${gameKey}].playerStats[${index}].playerId "${stats.playerId}" is missing from world.players.`,
      );
    }
    if (stats.teamId != null) {
      assertNonEmptyString(
        stats.teamId,
        `competition.games[${gameKey}].playerStats[${index}].teamId`,
      );
      if (!teamIds.has(stats.teamId as string)) {
        fail(
          `competition.games[${gameKey}].playerStats[${index}].teamId "${stats.teamId}" is missing from world.teams.`,
        );
      }
      if (
        stats.teamId !== game.homeTeamId &&
        stats.teamId !== game.awayTeamId
      ) {
        fail(
          `competition.games[${gameKey}].playerStats[${index}].teamId must be home or away team.`,
        );
      }
    }
    if (stats.firstName != null && typeof stats.firstName !== "string") {
      fail(
        `competition.games[${gameKey}].playerStats[${index}].firstName must be a string or null.`,
      );
    }
    if (stats.lastName != null && typeof stats.lastName !== "string") {
      fail(
        `competition.games[${gameKey}].playerStats[${index}].lastName must be a string or null.`,
      );
    }
    if (typeof (stats as { started?: unknown }).started !== "boolean") {
      fail(
        `competition.games[${gameKey}].playerStats[${index}].started must be a boolean.`,
      );
    }
  }

  if (!Array.isArray(game.events)) {
    fail(`competition.games[${gameKey}].events must be an array.`);
  }
  for (const [index, event] of game.events.entries()) {
    assertRecord(event, `competition.games[${gameKey}].events[${index}]`);
    if (event.playerId != null) {
      assertNonEmptyString(
        event.playerId,
        `competition.games[${gameKey}].events[${index}].playerId`,
      );
      if (!playerIds.has(event.playerId as string)) {
        fail(
          `competition.games[${gameKey}].events[${index}].playerId "${event.playerId}" is missing from world.players.`,
        );
      }
    }
    if (event.teamId != null) {
      assertNonEmptyString(
        event.teamId,
        `competition.games[${gameKey}].events[${index}].teamId`,
      );
      if (!teamIds.has(event.teamId as string)) {
        fail(
          `competition.games[${gameKey}].events[${index}].teamId "${event.teamId}" is missing from world.teams.`,
        );
      }
    }
  }
}

function validateTeamSnapshotField(
  snapshot: GameTeamSnapshot | null | undefined,
  fieldPath: string,
  expectedTeamId: string | undefined,
  teamIds: Set<string>,
): void {
  if (snapshot == null) {
    return;
  }
  assertRecord(snapshot, fieldPath);
  assertNonEmptyString(snapshot.teamId, `${fieldPath}.teamId`);
  assertNonEmptyString(snapshot.city, `${fieldPath}.city`);
  assertNonEmptyString(snapshot.name, `${fieldPath}.name`);
  assertNonEmptyString(snapshot.abbreviation, `${fieldPath}.abbreviation`);
  assertRecord(snapshot.branding, `${fieldPath}.branding`);
  assertNonEmptyString(
    snapshot.branding.primaryColor,
    `${fieldPath}.branding.primaryColor`,
  );
  assertNonEmptyString(
    snapshot.branding.secondaryColor,
    `${fieldPath}.branding.secondaryColor`,
  );
  assertNonEmptyString(
    snapshot.branding.accentColor,
    `${fieldPath}.branding.accentColor`,
  );
  assertNonEmptyString(
    snapshot.branding.logoId,
    `${fieldPath}.branding.logoId`,
  );
  if (!teamIds.has(snapshot.teamId)) {
    fail(
      `${fieldPath}.teamId "${snapshot.teamId}" is missing from world.teams.`,
    );
  }
  if (expectedTeamId != null && snapshot.teamId !== expectedTeamId) {
    fail(`${fieldPath}.teamId must match the game's team id.`);
  }
}

export function validatePlayoffs(playoffs: Record<string, unknown>): void {
  if (
    typeof playoffs.status !== "string" ||
    !PLAYOFF_TOURNAMENT_STATUSES.includes(
      playoffs.status as (typeof PLAYOFF_TOURNAMENT_STATUSES)[number],
    )
  ) {
    fail(
      `competition.playoffs.status must be one of ${PLAYOFF_TOURNAMENT_STATUSES.join(", ")}.`,
    );
  }
  assertNumber(playoffs.fieldSize, "competition.playoffs.fieldSize");
  if (!Array.isArray(playoffs.qualifiedTeams)) {
    fail("competition.playoffs.qualifiedTeams must be an array.");
  }
  if (!Array.isArray(playoffs.series)) {
    fail("competition.playoffs.series must be an array.");
  }
  for (const [index, series] of playoffs.series.entries()) {
    assertRecord(series, `competition.playoffs.series[${index}]`);
    assertNonEmptyString(series.id, `competition.playoffs.series[${index}].id`);
    if (
      typeof series.status !== "string" ||
      !PLAYOFF_SERIES_STATUSES.includes(
        series.status as (typeof PLAYOFF_SERIES_STATUSES)[number],
      )
    ) {
      fail(
        `competition.playoffs.series[${index}].status must be one of ${PLAYOFF_SERIES_STATUSES.join(", ")}.`,
      );
    }
  }
}

export function validatePlayoffReferences(
  playoffs: PlayoffTournament,
  teamIds: Set<string>,
  gameIds: Set<string>,
): void {
  for (const [index, seed] of playoffs.qualifiedTeams.entries()) {
    if (!teamIds.has(seed.teamId)) {
      fail(
        `competition.playoffs.qualifiedTeams[${index}].teamId "${seed.teamId}" is missing from world.teams.`,
      );
    }
  }

  if (
    playoffs.championTeamId != null &&
    !teamIds.has(playoffs.championTeamId)
  ) {
    fail(
      `competition.playoffs.championTeamId "${playoffs.championTeamId}" is missing from world.teams.`,
    );
  }

  const seriesIds = new Set(playoffs.series.map((series) => series.id));

  for (const series of playoffs.series) {
    if (
      series.higherSeedTeamId != null &&
      !teamIds.has(series.higherSeedTeamId)
    ) {
      fail(
        `competition.playoffs.series "${series.id}" higherSeedTeamId is missing from world.teams.`,
      );
    }
    if (
      series.lowerSeedTeamId != null &&
      !teamIds.has(series.lowerSeedTeamId)
    ) {
      fail(
        `competition.playoffs.series "${series.id}" lowerSeedTeamId is missing from world.teams.`,
      );
    }
    if (series.winnerTeamId != null && !teamIds.has(series.winnerTeamId)) {
      fail(
        `competition.playoffs.series "${series.id}" winnerTeamId is missing from world.teams.`,
      );
    }
    for (const gameId of series.gameIds) {
      if (!gameIds.has(gameId)) {
        fail(
          `competition.playoffs.series "${series.id}" gameId "${gameId}" is missing from competition.games.`,
        );
      }
    }
    if (series.feederSeriesIds) {
      for (const feederId of series.feederSeriesIds) {
        if (!seriesIds.has(feederId)) {
          fail(
            `competition.playoffs.series "${series.id}" feederSeriesId "${feederId}" is missing from series.`,
          );
        }
      }
    }
    for (const teamId of Object.keys(series.wins)) {
      if (!teamIds.has(teamId)) {
        fail(
          `competition.playoffs.series "${series.id}" wins key "${teamId}" is missing from world.teams.`,
        );
      }
    }
  }
}

export function validateEventLog(
  events: unknown[],
  pathPrefix = "user.eventLog",
): void {
  const seenIds = new Set<string>();
  for (const [index, eventValue] of events.entries()) {
    const path = `${pathPrefix}[${index}]`;
    assertRecord(eventValue, path);
    assertNonEmptyString(eventValue.id, `${path}.id`);
    if (seenIds.has(eventValue.id)) {
      fail(`${pathPrefix} contains duplicate id "${eventValue.id}".`);
    }
    seenIds.add(eventValue.id);

    if (
      typeof eventValue.type !== "string" ||
      !isDomainEventType(eventValue.type)
    ) {
      fail(`${path}.type must be one of ${DOMAIN_EVENT_TYPES.join(", ")}.`);
    }

    assertNonEmptyString(eventValue.occurredOn, `${path}.occurredOn`);
    parseCalendarDate(eventValue.occurredOn);

    if (
      eventValue.payload == null ||
      typeof eventValue.payload !== "object" ||
      Array.isArray(eventValue.payload)
    ) {
      fail(`${path}.payload must be a record.`);
    }
  }
}

/**
 * competition.playByPlay (v66+): every key references a final current-season
 * game in competition.games (this is the retention bound), the log is
 * structurally valid, its players took part in the game on the recorded side,
 * and replaying it reproduces the final score, period scores and each
 * player's points.
 *
 * Owner-team involvement is not enforced: a franchise can be sold mid-season,
 * and its already-recorded logs must not make the save unloadable.
 */
export function validatePlayByPlayLogs(state: GameState): void {
  const competition = state.competition;
  assertRecord(competition.playByPlay, "competition.playByPlay");
  const games = competition.games as Record<string, Game | undefined>;
  const seasonId = competition.season.id;

  for (const [gameId, log] of Object.entries(competition.playByPlay)) {
    const path = `competition.playByPlay[${gameId}]`;
    const game = games[gameId];
    if (game == null) {
      fail(`${path} references a game missing from competition.games.`);
    }
    if (game.status !== "final") {
      fail(`${path} references game ${gameId} that is not final.`);
    }
    if (game.seasonId !== seasonId) {
      fail(`${path} references game ${gameId} outside the current season.`);
    }

    try {
      assertPlayByPlayLog(log, path, {
        periodCount: game.periodScores.length,
        regulationPeriodCount: GAME_SIMULATION_CONFIG.regulationPeriodCount,
        regulationPeriodSeconds: GAME_SIMULATION_CONFIG.regulationPeriodSeconds,
        overtimePeriodSeconds: GAME_SIMULATION_CONFIG.overtimePeriodSeconds,
      });
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }

    const sideByPlayerId = new Map<string, number>();
    const pointsByPlayerId = new Map<string, number>();
    for (const row of game.playerStats) {
      if (row.teamId === game.homeTeamId) {
        sideByPlayerId.set(row.playerId, 0);
      } else if (row.teamId === game.awayTeamId) {
        sideByPlayerId.set(row.playerId, 1);
      }
      pointsByPlayerId.set(row.playerId, row.points);
    }
    for (const [index, playerId] of log.players.entries()) {
      if (!sideByPlayerId.has(playerId)) {
        fail(
          `${path}.players[${index}] "${playerId}" has no box-score row in game ${gameId}.`,
        );
      }
    }

    const score = [0, 0];
    const periodPoints = game.periodScores.map(() => [0, 0]);
    const replayedPoints = new Map<string, number>();
    for (let index = 0; index < log.code.length; index += 1) {
      const playerId = log.players[log.player[index]!]!;
      const side = log.side[index]!;
      if (sideByPlayerId.get(playerId) !== side) {
        fail(`${path}[${index}].side does not match ${playerId}'s team.`);
      }
      const points = playCodePoints(log.code[index]!);
      if (points === 0) {
        continue;
      }
      score[side]! += points;
      periodPoints[log.period[index]! - 1]![side]! += points;
      replayedPoints.set(
        playerId,
        (replayedPoints.get(playerId) ?? 0) + points,
      );
    }

    if (score[0] !== game.score.home || score[1] !== game.score.away) {
      fail(
        `${path} replays to ${score[0]}-${score[1]} but game ${gameId} final is ${game.score.home}-${game.score.away}.`,
      );
    }
    for (const [periodIndex, period] of game.periodScores.entries()) {
      const replayed = periodPoints[periodIndex]!;
      if (replayed[0] !== period.home || replayed[1] !== period.away) {
        fail(
          `${path} period ${periodIndex + 1} replays to ${replayed[0]}-${replayed[1]} but game ${gameId} recorded ${period.home}-${period.away}.`,
        );
      }
    }
    for (const [playerId, points] of pointsByPlayerId) {
      if ((replayedPoints.get(playerId) ?? 0) !== points) {
        fail(
          `${path} replays ${replayedPoints.get(playerId) ?? 0} points for ${playerId} but the box score has ${points}.`,
        );
      }
    }
  }
}
