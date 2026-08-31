import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { asGameId, asSeasonId, asTeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { addCalendarDays } from "@/domain/calendar-date";
import { runAiGameDayPromotionDecisions } from "@/systems/game-day-promotions/ai-game-day-promotions";
import { isUserControlledTeam } from "@/systems/ai-team-decisions";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("AI game-day promotions", () => {
  it("never schedules promotions for the user-controlled team", () => {
    let state = createInitialGameState({
      saveId: "gdp_ai",
      rngSeed: 77,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const userTeamId = state.user.activeOwnerTeamId;

    // Seed upcoming home games for every team.
    let games = { ...state.competition.games };
    let i = 0;
    for (const teamId of Object.keys(state.world.teams)) {
      const opponent = (Object.keys(state.world.teams) as string[]).find(
        (id) => id !== teamId,
      )!;
      const gameId = asGameId(`ai_home_${i++}`);
      games[gameId] = createGame({
        competitionType: "regular_season",
        homeTeamSnapshot: null,
        awayTeamSnapshot: null,
        id: gameId,
        seasonId: asSeasonId(state.competition.season.id),
        date: addCalendarDays(state.world.calendar.currentDate, 20),
        homeTeamId: asTeamId(teamId),
        awayTeamId: asTeamId(opponent),
        status: "scheduled",
        score: { home: 0, away: 0 },
        periodScores: [],
        playerStats: [],
        events: [],
      });
    }
    state = {
      ...state,
      competition: { ...state.competition, games },
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          lastSimulatedWeekId: "2026-W40",
        },
      },
    };

    const result = runAiGameDayPromotionDecisions(state, rng);
    const userAssignments =
      result.state.business.gameDayPromotionsByTeamId[userTeamId]?.assignments ??
      {};
    expect(Object.keys(userAssignments)).toHaveLength(0);
    expect(isUserControlledTeam(result.state, userTeamId)).toBe(true);

    // At least some CPU activity may occur, but never for every home game.
    let cpuScheduled = 0;
    let cpuHomeGames = 0;
    for (const teamId of Object.keys(result.state.world.teams)) {
      if (isUserControlledTeam(result.state, asTeamId(teamId))) continue;
      const assignments =
        result.state.business.gameDayPromotionsByTeamId[teamId]?.assignments ??
        {};
      cpuScheduled += Object.keys(assignments).length;
      cpuHomeGames += Object.values(result.state.competition.games).filter(
        (g) => g.homeTeamId === teamId && g.status === "scheduled",
      ).length;
    }
    expect(cpuScheduled).toBeLessThan(cpuHomeGames);
  });
});
