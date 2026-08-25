import { addCalendarDays } from "@/domain/calendar-date";
import { createGame, type Game } from "@/domain/entities/game";
import type { PlayoffSeries } from "@/domain/entities/playoffs";
import {
  asGameId,
  asTeamId,
  type GameId,
  type SeasonId,
} from "@/domain/ids";
import { getHomeTeamForGame } from "@/systems/playoff-config";

/**
 * Creates the next scheduled playoff game for an active series.
 * Home court comes from {@link getHomeTeamForGame}; date is nextDate.
 */
export function createNextPlayoffGame(input: {
  series: PlayoffSeries;
  seasonId: SeasonId;
  nextDate: string;
  gameId?: GameId;
  seriesLength?: 1 | 3 | 5 | 7;
}): Game {
  const { series, seasonId, nextDate } = input;
  const seriesLength = input.seriesLength ?? 7;
  if (series.status !== "active") {
    throw new Error(
      `createNextPlayoffGame requires an active series; ${series.id} is "${series.status}".`,
    );
  }
  if (!series.higherSeedTeamId || !series.lowerSeedTeamId) {
    throw new Error(
      `createNextPlayoffGame: series ${series.id} is missing participants.`,
    );
  }

  const gameIndex = series.gameIds.length;
  const homeTeamId = asTeamId(
    getHomeTeamForGame(
      {
        higherSeedTeamId: series.higherSeedTeamId,
        lowerSeedTeamId: series.lowerSeedTeamId,
      },
      gameIndex,
      seriesLength,
    ),
  );
  const awayTeamId =
    homeTeamId === series.higherSeedTeamId
      ? series.lowerSeedTeamId
      : series.higherSeedTeamId;

  const gameId =
    input.gameId ??
    asGameId(`playoff_${series.id}_g${gameIndex}`);

  return createGame({
    id: gameId,
    seasonId,
    date: nextDate,
    homeTeamId,
    awayTeamId,
    competitionType: "playoffs",
    status: "scheduled",
    score: { home: 0, away: 0 },
    periodScores: [],
    events: [],
    playerStats: [],
    homeTeamSnapshot: null,
    awayTeamSnapshot: null,
  });
}

/**
 * Next playoff game date: day after the latest competition game date, or
 * the calendar current date when no games exist yet.
 */
export function nextPlayoffGameDate(input: {
  calendarCurrentDate: string;
  games: Record<string, Game>;
}): string {
  let latest: string | null = null;
  for (const game of Object.values(input.games)) {
    if (latest === null || game.date.localeCompare(latest) > 0) {
      latest = game.date;
    }
  }
  if (latest === null) {
    return input.calendarCurrentDate;
  }
  return addCalendarDays(latest, 1);
}
