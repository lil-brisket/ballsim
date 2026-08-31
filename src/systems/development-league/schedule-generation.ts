/**
 * Development League schedule generation — regular season only, ~50% frequency.
 * Uses same team IDs as world.teams; no duplicate Team entities.
 */

import { addCalendarDays } from "@/domain/calendar-date";
import { createGame, type Game } from "@/domain/entities/game";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import { asGameId, type TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { DL_SCHEDULE_FREQUENCY } from "@/systems/development-league/config";
import { generateSeasonSchedule } from "@/systems/schedule-generation";
import { buildGameIdsByDate } from "@/systems/schedule-date-index";
import { SEASON_LIFECYCLE_CONFIG } from "@/systems/simulation/season-lifecycle-config";

/**
 * Builds a Development League schedule into competition.developmentLeague.
 * Idempotent when DL schedule already has games.
 */
export function generateDevelopmentLeagueSchedule(
  state: GameState,
): SystemResult {
  const existing = state.competition.developmentLeague;
  if (existing != null && existing.schedule.gameIds.length > 0) {
    return systemResult(state);
  }

  const teamIds = Object.keys(state.world.teams).sort() as TeamId[];
  if (teamIds.length < 2) {
    return systemResult(state);
  }

  const topGamesPerTeam = state.settings.regularSeason.gamesPerTeam;
  const dlGamesPerTeam = Math.max(
    10,
    Math.round(topGamesPerTeam * DL_SCHEDULE_FREQUENCY),
  );
  // Ensure even for round-robin pairing
  const seasonLength =
    dlGamesPerTeam % 2 === 0 ? dlGamesPerTeam : dlGamesPerTeam + 1;

  const assignments = generateSeasonSchedule({ teamIds, seasonLength });
  const games: Record<string, Game> = {};
  const gameIds: Game["id"][] = [];
  const seasonId = state.competition.season.id;
  const currentDate = state.world.calendar.currentDate;
  const startOffset = SEASON_LIFECYCLE_CONFIG.scheduleStartOffsetDays;

  for (let index = 0; index < assignments.length; index += 1) {
    const assignment = assignments[index]!;
    const gameId = asGameId(`dl_game_${seasonId}_${index}`);
    const date = addCalendarDays(
      currentDate,
      assignment.round - 1 + startOffset,
    );
    games[gameId] = createGame({
      id: gameId,
      seasonId,
      date,
      homeTeamId: assignment.homeTeamId,
      awayTeamId: assignment.awayTeamId,
      competitionType: "development_league",
      status: "scheduled",
      score: { home: 0, away: 0 },
      periodScores: [],
      events: [],
      playerStats: [],
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
    });
    gameIds.push(gameId);
  }

  const standingsByTeamId: Record<string, ReturnType<typeof createEmptyTeamStanding>> =
    {};
  for (const teamId of teamIds) {
    standingsByTeamId[teamId] = createEmptyTeamStanding(teamId);
  }

  return systemResult({
    ...state,
    competition: {
      ...state.competition,
      developmentLeague: {
        schedule: {
          seasonId,
          gameIds,
          gameIdsByDate: buildGameIdsByDate(games, gameIds),
        },
        games,
        standings: { byTeamId: standingsByTeamId },
      },
    },
  });
}
