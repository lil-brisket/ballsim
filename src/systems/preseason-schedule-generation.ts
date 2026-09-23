import { addCalendarDays, calendarDaysBetween } from "@/domain/calendar-date";
import { createGame, type Game } from "@/domain/entities/game";
import { asGameId, type TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { PRESEASON_GAMES_PER_TEAM } from "@/systems/preseason-schedule-config";
import { buildGameIdsByDate } from "@/systems/schedule-date-index";
import { generateSeasonSchedule } from "@/systems/schedule-generation";
import { resolveRegularSeasonScheduleAnchor } from "@/systems/schedule-calendar-dates";
import {
  derivePlannedPreseasonStartDate,
  derivePlannedRegularSeasonStartDate,
} from "@/systems/simulation/planned-season-dates";

function hasPreseasonSchedule(state: GameState): boolean {
  for (const gameId of state.competition.schedule.gameIds) {
    const game = state.competition.games[gameId];
    if (game?.competitionType === "preseason") {
      return true;
    }
  }
  return false;
}

function preseasonRoundDates(
  preseasonStart: string,
  regularSeasonStart: string,
  roundCount: number,
): string[] {
  const lastPreseasonDay = addCalendarDays(regularSeasonStart, -1);
  if (lastPreseasonDay < preseasonStart) {
    throw new Error(
      "Preseason schedule requires at least one day before the regular-season opener.",
    );
  }
  const spanDays = calendarDaysBetween(preseasonStart, lastPreseasonDay);
  if (roundCount === 1) {
    return [preseasonStart];
  }
  const dates: string[] = [];
  for (let round = 0; round < roundCount; round += 1) {
    const offset =
      round === roundCount - 1
        ? spanDays
        : Math.round((round * spanDays) / (roundCount - 1));
    dates.push(addCalendarDays(preseasonStart, offset));
  }
  return dates;
}

/**
 * Adds exhibition games for every team ({@link PRESEASON_GAMES_PER_TEAM} each)
 * into the main competition schedule. Idempotent when preseason games already exist.
 * Requires the regular-season schedule to be materialized first (bootstrap order).
 */
export function generatePreseasonSchedule(state: GameState): SystemResult {
  if (hasPreseasonSchedule(state)) {
    return systemResult(state);
  }
  if (state.competition.schedule.gameIds.length === 0) {
    throw new Error(
      "generatePreseasonSchedule requires a non-empty regular-season schedule.",
    );
  }

  const teamIds = Object.keys(state.world.teams).sort() as TeamId[];
  if (teamIds.length < 2) {
    throw new Error(
      "Preseason schedule generation requires at least 2 teams in world.teams.",
    );
  }

  const preseasonStart =
    derivePlannedPreseasonStartDate(state) ??
    state.competition.phase.enteredDate;
  const regularSeasonStart =
    resolveRegularSeasonScheduleAnchor(state) ??
    derivePlannedRegularSeasonStartDate(state);
  if (regularSeasonStart == null || regularSeasonStart.length === 0) {
    throw new Error(
      "Preseason schedule generation requires a regular-season opener date.",
    );
  }

  const roundDates = preseasonRoundDates(
    preseasonStart,
    regularSeasonStart,
    PRESEASON_GAMES_PER_TEAM,
  );
  const assignments = generateSeasonSchedule({
    teamIds,
    seasonLength: PRESEASON_GAMES_PER_TEAM,
  });

  const seasonId = state.competition.season.id;
  const newGames: Record<string, Game> = { ...state.competition.games };
  const preseasonGameIds: Game["id"][] = [];

  for (let index = 0; index < assignments.length; index += 1) {
    const assignment = assignments[index]!;
    const date = roundDates[assignment.round - 1];
    if (date == null) {
      throw new Error(
        `Preseason schedule missing date for round ${assignment.round}.`,
      );
    }
    const gameId = asGameId(`game_pre_${seasonId}_${index}`);
    newGames[gameId] = createGame({
      id: gameId,
      seasonId,
      date,
      homeTeamId: assignment.homeTeamId,
      awayTeamId: assignment.awayTeamId,
      competitionType: "preseason",
      status: "scheduled",
      score: { home: 0, away: 0 },
      periodScores: [],
      events: [],
      playerStats: [],
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
    });
    preseasonGameIds.push(gameId);
  }

  const gameIds = [...preseasonGameIds, ...state.competition.schedule.gameIds];

  return systemResult({
    ...state,
    competition: {
      ...state.competition,
      schedule: {
        ...state.competition.schedule,
        gameIds,
        gameIdsByDate: buildGameIdsByDate(newGames, gameIds),
      },
      games: newGames,
    },
  });
}
