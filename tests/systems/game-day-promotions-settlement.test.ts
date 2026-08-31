import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { asGameId, asSeasonId, asTeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { addCalendarDays } from "@/domain/calendar-date";
import { scheduleGameDayPromotion } from "@/systems/game-day-promotions/schedule-game-day-promotion";
import { processHomeGameTicketRevenue } from "@/systems/ticket-revenue";
import { applyPromotionDownstreamEffects } from "@/systems/game-day-promotions/apply-promotion-downstream-effects";
import { applyMediaFromDomainEvents } from "@/systems/media";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createDomainEvent } from "@/domain/events";

function setupScheduledThenFinal(
  promotionId: string,
  daysAhead = 30,
) {
  let state = createInitialGameState({
    saveId: "gdp_settle",
    rngSeed: 42,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  const teamId = state.user.activeOwnerTeamId;
  const otherTeamId = (Object.keys(state.world.teams) as string[]).find(
    (id) => id !== teamId,
  )!;
  const date = addCalendarDays(state.world.calendar.currentDate, daysAhead);
  const gameId = asGameId("game_gdp_settle");
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
  state = scheduleGameDayPromotion(state, teamId, gameId, promotionId).state;
  // Advance calendar to game date and finalize
  state = {
    ...state,
    world: {
      ...state.world,
      calendar: { ...state.world.calendar, currentDate: date },
    },
    competition: {
      ...state.competition,
      games: {
        ...state.competition.games,
        [gameId]: {
          ...state.competition.games[gameId]!,
          status: "final",
          score: { home: 110, away: 98 },
        },
      },
    },
  };
  return { state, teamId, gameId, date, rng };
}

describe("game-day promotions settlement", () => {
  it("stores counterfactual attribution and emits GameDayPromotionSettled", () => {
    const { state, teamId, gameId, rng } = setupScheduledThenFinal(
      "bobblehead_giveaway",
    );
    const settled = processHomeGameTicketRevenue(state, rng);
    const result =
      settled.state.business.gameDayPromotionsByTeamId[teamId]!.results[gameId];
    expect(result).toBeTruthy();
    expect(result.actualAttendance).toBeGreaterThan(0);
    expect(result.baselineAttendance).toBeGreaterThan(0);
    expect(result.attendanceDifference).toBe(
      result.actualAttendance - result.baselineAttendance,
    );
    expect(result.ticketRevenueDifference).toBe(
      result.actualTicketRevenue - result.baselineTicketRevenue,
    );
    const promoEvents = settled.events.filter(
      (e) => e.type === "GameDayPromotionSettled",
    );
    expect(promoEvents).toHaveLength(1);
    const homeSettled = settled.events.find(
      (e) => e.type === "HomeGameDaySettled",
    );
    expect(homeSettled?.payload.promotion).toMatchObject({
      promotionId: "bobblehead_giveaway",
    });
    expect(
      (homeSettled?.payload.promotion as { attendanceDifference?: number })
        ?.attendanceDifference,
    ).toBe(result.attendanceDifference);
  });

  it("ticket promo can raise attendance while lowering ticket revenue", () => {
    const { state, teamId, gameId, rng } = setupScheduledThenFinal(
      "discount_night",
    );
    const settled = processHomeGameTicketRevenue(state, rng);
    const result =
      settled.state.business.gameDayPromotionsByTeamId[teamId]!.results[gameId];
    expect(result.attendanceDifference).toBeGreaterThan(0);
    // Discount nights often reduce per-ticket revenue; net can still be positive via ancillaries.
    expect(result.ticketRevenueDifference).toBeLessThanOrEqual(
      result.attendanceDifference * 45,
    );
    const ancillary =
      result.merchRevenueDifference + result.concessionsRevenueDifference;
    expect(ancillary).toBeGreaterThan(0);
  });

  it("does not double-apply media and fan bumps", () => {
    const { state, teamId, rng } = setupScheduledThenFinal("charity_night");
    const sentimentBefore =
      state.business.franchiseOps[teamId]!.fanSentiment;
    const mediaBefore = state.business.franchiseOps[teamId]!.mediaAttention;

    const settled = processHomeGameTicketRevenue(state, rng);
    const media = applyMediaFromDomainEvents(settled.state, settled.events);
    const downstream = applyPromotionDownstreamEffects(
      media.state,
      settled.events,
    );

    const sentimentAfter =
      downstream.state.business.franchiseOps[teamId]!.fanSentiment;
    const mediaAfter =
      downstream.state.business.franchiseOps[teamId]!.mediaAttention;

    // Single application path: media from MEDIA_EVENT_BUMPS, sentiment from downstream.
    expect(mediaAfter).toBeGreaterThanOrEqual(mediaBefore);
    expect(sentimentAfter).toBeGreaterThanOrEqual(sentimentBefore);

    // Applying downstream again should not stack if no new events.
    const again = applyPromotionDownstreamEffects(downstream.state, []);
    expect(again.state.business.franchiseOps[teamId]!.fanSentiment).toBe(
      sentimentAfter,
    );
  });

  it("giveaway quantity caps distribution", () => {
    const { state, teamId, gameId, rng } = setupScheduledThenFinal(
      "jersey_giveaway",
    );
    const settled = processHomeGameTicketRevenue(state, rng);
    const result =
      settled.state.business.gameDayPromotionsByTeamId[teamId]!.results[gameId];
    expect(result.giveawaysDistributed).toBeDefined();
    expect(result.giveawaysDistributed!).toBeLessThanOrEqual(8_000);
  });
});

describe("game-day promotions basketball isolation", () => {
  it("scheduling a promotion does not change game scores or player stats", () => {
    const { state, teamId, gameId } = (() => {
      let s = createInitialGameState({
        saveId: "gdp_bball",
        rngSeed: 9,
        settings: CBL_GAME_SETTINGS,
      });
      s = bootstrapWorld(s, createSeededRng(s.meta.rngState)).state;
      const tid = s.user.activeOwnerTeamId;
      const oid = (Object.keys(s.world.teams) as string[]).find(
        (id) => id !== tid,
      )!;
      const gid = asGameId("game_iso");
      const date = addCalendarDays(s.world.calendar.currentDate, 30);
      s = {
        ...s,
        competition: {
          ...s.competition,
          games: {
            ...s.competition.games,
            [gid]: createGame({
              competitionType: "regular_season",
              homeTeamSnapshot: null,
              awayTeamSnapshot: null,
              id: gid,
              seasonId: asSeasonId(s.competition.season.id),
              date,
              homeTeamId: tid,
              awayTeamId: asTeamId(oid),
              status: "scheduled",
              score: { home: 0, away: 0 },
              periodScores: [],
              playerStats: [],
              events: [],
            }),
          },
        },
      };
      return { state: s, teamId: tid, gameId: gid };
    })();

    const before = state.competition.games[gameId]!;
    const after = scheduleGameDayPromotion(
      state,
      teamId,
      gameId,
      "kids_night",
    ).state.competition.games[gameId]!;
    expect(after.score).toEqual(before.score);
    expect(after.playerStats).toEqual(before.playerStats);
    expect(after.status).toBe("scheduled");
  });
});

describe("promotion downstream event shape", () => {
  it("applies sentiment from GameDayPromotionSettled payload", () => {
    let state = createInitialGameState({
      saveId: "gdp_down",
      rngSeed: 3,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamId = state.user.activeOwnerTeamId;
    const before = state.business.franchiseOps[teamId]!.fanSentiment;
    const event = createDomainEvent({
      type: "GameDayPromotionSettled",
      occurredOn: state.world.calendar.currentDate,
      payload: {
        teamId,
        gameId: "g1",
        promotionId: "charity_night",
        fanResponse: "very_positive",
        effects: {
          awareness: 2,
          sentiment: 3,
          reputation: 2,
          media: 2,
        },
      },
    });
    const result = applyPromotionDownstreamEffects(state, [event]);
    expect(
      result.state.business.franchiseOps[teamId]!.fanSentiment,
    ).toBeGreaterThan(before);
  });
});
