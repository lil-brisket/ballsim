import { addCalendarDays } from "@/domain/calendar-date";
import { asGameId } from "@/domain/ids";
import { createGame, type Game } from "@/domain/entities/game";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";

/**
 * Builds a double round-robin regular-season schedule (home and away).
 * Idempotent: no-op when schedule.gameIds is already non-empty.
 * Games begin the day after the current calendar date (one game per day).
 */
export function generateSchedule(state: GameState): SystemResult {
  if (state.competition.schedule.gameIds.length > 0) {
    return systemResult(state);
  }

  const teamIds = Object.keys(state.world.teams).sort() as TeamId[];
  if (teamIds.length < 2) {
    return systemResult(state);
  }

  const pairs: Array<{ home: TeamId; away: TeamId }> = [];
  for (let i = 0; i < teamIds.length; i += 1) {
    for (let j = 0; j < teamIds.length; j += 1) {
      if (i === j) {
        continue;
      }
      pairs.push({ home: teamIds[i]!, away: teamIds[j]! });
    }
  }

  const games: Record<string, Game> = {};
  const gameIds: Game["id"][] = [];
  let date = addCalendarDays(state.world.calendar.currentDate, 1);

  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index]!;
    const gameId = asGameId(`game_${state.competition.season.id}_${index}`);
    games[gameId] = createGame({
      id: gameId,
      seasonId: state.competition.season.id,
      date,
      homeTeamId: pair.home,
      awayTeamId: pair.away,
      status: "scheduled",
      score: { home: 0, away: 0 },
      events: [],
      playerStats: [],
    });
    gameIds.push(gameId);
    date = addCalendarDays(date, 1);
  }

  return systemResult({
    ...state,
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        phase: "regular",
      },
      schedule: {
        seasonId: state.competition.season.id,
        gameIds,
      },
      games,
    },
  });
}
