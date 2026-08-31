import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { asGameId, asSeasonId, asTeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { addCalendarDays } from "@/domain/calendar-date";
import {
  listGameDayPromotionDefinitions,
  getGameDayPromotionDefinition,
} from "@/systems/game-day-promotions/game-day-promotion-catalog";
import {
  scheduleGameDayPromotion,
  cancelGameDayPromotion,
  changeGameDayPromotion,
  refundFractionForCancel,
} from "@/systems/game-day-promotions/schedule-game-day-promotion";
import { PROMOTION_FINAL_CANCEL_WINDOW_DAYS } from "@/systems/game-day-promotions/game-day-promotion-config";
import { bootstrapWorld } from "@/systems/world-pipeline";

function setupWithHomeGame(daysAhead: number) {
  let state = createInitialGameState({
    saveId: "gdp_sched",
    rngSeed: 21,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  const teamId = state.user.activeOwnerTeamId;
  const otherTeamId = (Object.keys(state.world.teams) as string[]).find(
    (id) => id !== teamId,
  )!;
  const date = addCalendarDays(state.world.calendar.currentDate, daysAhead);
  const gameId = asGameId("game_gdp_home_1");
  state = {
    ...state,
    competition: {
      ...state.competition,
      games: {
        ...state.competition.games,
        [gameId]: createGame({
          competitionType: "regular_season",
          homeTeamSnapshot: null,
          awayTeamSnapshot: null,
          id: gameId,
          seasonId: asSeasonId(state.competition.season.id),
          date,
          homeTeamId: teamId,
          awayTeamId: asTeamId(otherTeamId),
          status: "scheduled",
          score: { home: 0, away: 0 },
          periodScores: [],
          playerStats: [],
          events: [],
        }),
      },
    },
  };
  return { state, teamId, otherTeamId, gameId, date };
}

describe("game-day promotions scheduling", () => {
  it("has a complete catalog with unique ids", () => {
    const defs = listGameDayPromotionDefinitions();
    expect(defs.length).toBeGreaterThanOrEqual(30);
    const ids = new Set(defs.map((d) => d.id));
    expect(ids.size).toBe(defs.length);
    expect(getGameDayPromotionDefinition("bobblehead_giveaway")).toBeTruthy();
  });

  it("schedules a home-game promotion and charges cost", () => {
    const { state, teamId, gameId } = setupWithHomeGame(30);
    const cashBefore = state.business.finances[teamId]!.businessFunds;
    const result = scheduleGameDayPromotion(
      state,
      teamId,
      gameId,
      "team_poster_giveaway",
    );
    const assignment =
      result.state.business.gameDayPromotionsByTeamId[teamId]!.assignments[
        gameId
      ];
    expect(assignment.promotionId).toBe("team_poster_giveaway");
    expect(assignment.costPaid).toBe(28_000);
    expect(
      result.state.business.finances[teamId]!.businessFunds,
    ).toBe(cashBefore - 28_000);
    expect(
      result.state.business.gameDayPromotionsByTeamId[teamId]!.committedSpend,
    ).toBe(28_000);
  });

  it("rejects away games and lead-time violations", () => {
    const { state, teamId, otherTeamId } = setupWithHomeGame(30);
    const awayId = asGameId("game_away");
    const date = addCalendarDays(state.world.calendar.currentDate, 30);
    let next = {
      ...state,
      competition: {
        ...state.competition,
        games: {
          ...state.competition.games,
          [awayId]: createGame({
            competitionType: "regular_season",
            homeTeamSnapshot: null,
            awayTeamSnapshot: null,
            id: awayId,
            seasonId: asSeasonId(state.competition.season.id),
            date,
            homeTeamId: asTeamId(otherTeamId),
            awayTeamId: teamId,
            status: "scheduled",
            score: { home: 0, away: 0 },
            periodScores: [],
            playerStats: [],
            events: [],
          }),
        },
      },
    };
    expect(() =>
      scheduleGameDayPromotion(next, teamId, awayId, "kids_night"),
    ).toThrow(/not a home game/);

    const soon = setupWithHomeGame(2);
    expect(() =>
      scheduleGameDayPromotion(
        soon.state,
        soon.teamId,
        soon.gameId,
        "bobblehead_giveaway",
      ),
    ).toThrow(/lead time/);
  });

  it("enforces one promotion per home game", () => {
    const { state, teamId, gameId } = setupWithHomeGame(30);
    const once = scheduleGameDayPromotion(
      state,
      teamId,
      gameId,
      "kids_night",
    );
    expect(() =>
      scheduleGameDayPromotion(
        once.state,
        teamId,
        gameId,
        "family_night",
      ),
    ).toThrow(/already has a promotion/);
  });

  it("applies tiered cancellation refunds", () => {
    expect(refundFractionForCancel("2026-10-01", "2026-11-01", 14)).toBe(1);
    expect(refundFractionForCancel("2026-10-20", "2026-10-28", 14)).toBe(0.5);
    expect(
      refundFractionForCancel(
        "2026-10-26",
        "2026-10-28",
        14,
      ),
    ).toBe(0);
    expect(PROMOTION_FINAL_CANCEL_WINDOW_DAYS).toBe(3);

    const { state, teamId, gameId } = setupWithHomeGame(30);
    const scheduled = scheduleGameDayPromotion(
      state,
      teamId,
      gameId,
      "kids_night",
    );
    const cashAfterSchedule =
      scheduled.state.business.finances[teamId]!.businessFunds;
    const cancelled = cancelGameDayPromotion(
      scheduled.state,
      teamId,
      gameId,
    );
    expect(
      cancelled.state.business.finances[teamId]!.businessFunds,
    ).toBe(cashAfterSchedule + 18_000);
    expect(
      cancelled.state.business.gameDayPromotionsByTeamId[teamId]!.assignments[
        gameId
      ],
    ).toBeUndefined();
  });

  it("supports change via cancel+schedule", () => {
    const { state, teamId, gameId } = setupWithHomeGame(30);
    const scheduled = scheduleGameDayPromotion(
      state,
      teamId,
      gameId,
      "kids_night",
    );
    const changed = changeGameDayPromotion(
      scheduled.state,
      teamId,
      gameId,
      "family_night",
    );
    expect(
      changed.state.business.gameDayPromotionsByTeamId[teamId]!.assignments[
        gameId
      ]!.promotionId,
    ).toBe("family_night");
  });
});
