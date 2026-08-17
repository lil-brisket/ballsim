import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { asGameId, asSeasonId, asTeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { appendEventLog } from "@/state/game-state";
import { toFranchiseBusinessView } from "@/state/franchise-selectors";
import {
  hasAppliedGameplayConsequence,
} from "@/systems/gameplay-financial-consequences";
import {
  processHomeGameTicketRevenue,
  ticketRevenueConsequenceKey,
} from "@/systems/ticket-revenue";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("ticket revenue", () => {
  it("posts ticket, merchandise, and concessions once per home game", () => {
    let state = createInitialGameState({
      saveId: "tix_test",
      rngSeed: 7,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.controlledTeamId;
    const otherTeamId = (Object.keys(state.world.teams) as string[]).find(
      (id) => id !== teamId,
    )!;
    const date = state.world.calendar.currentDate;
    const year = state.competition.season.year;
    const gameId = asGameId("game_tix_1");
    state = {
      ...state,
      competition: {
        ...state.competition,
        games: {
          ...state.competition.games,
          [gameId]: createGame({
            id: gameId,
            seasonId: asSeasonId(state.competition.season.id),
            date,
            homeTeamId: teamId,
            awayTeamId: asTeamId(otherTeamId),
            status: "final",
            score: { home: 105, away: 98 },
            periodScores: [],
            playerStats: [],
            events: [],
          }),
        },
      },
    };

    const cashBefore = state.business.finances[teamId]!.cash;
    const once = processHomeGameTicketRevenue(state);
    const cashAfter = once.state.business.finances[teamId]!.cash;
    expect(cashAfter).toBeGreaterThan(cashBefore);

    const key = ticketRevenueConsequenceKey(teamId, gameId);
    expect(hasAppliedGameplayConsequence(once.state, key)).toBe(true);

    const settled = once.events.filter((e) => e.type === "HomeGameDaySettled");
    expect(settled).toHaveLength(1);
    expect(settled[0]!.payload.attendance).toBeGreaterThan(0);
    expect(settled[0]!.payload.concessionsRevenue).toBeGreaterThan(0);

    const twice = processHomeGameTicketRevenue(once.state);
    expect(twice.state.business.finances[teamId]!.cash).toBe(cashAfter);

    const books = twice.state.business.finances[teamId]!.booksByYear[String(year)];
    expect(books?.revenue.tickets).toBeGreaterThan(0);
    expect(books?.revenue.merchandise).toBeGreaterThan(0);
    expect(books?.revenue.other).toBeGreaterThan(0);
  });

  it("forecast and lastGameDay stay separate after settling", () => {
    let state = createInitialGameState({
      saveId: "tix_forecast",
      rngSeed: 11,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.controlledTeamId;
    const otherTeamId = (Object.keys(state.world.teams) as string[]).find(
      (id) => id !== teamId,
    )!;
    const date = state.world.calendar.currentDate;
    const gameId = asGameId("game_tix_2");
    state = {
      ...state,
      competition: {
        ...state.competition,
        games: {
          ...state.competition.games,
          [gameId]: createGame({
            id: gameId,
            seasonId: asSeasonId(state.competition.season.id),
            date,
            homeTeamId: teamId,
            awayTeamId: asTeamId(otherTeamId),
            status: "final",
            score: { home: 100, away: 90 },
            periodScores: [],
            playerStats: [],
            events: [],
          }),
        },
      },
    };

    const before = toFranchiseBusinessView(state);
    expect(before.lastGameDay).toBeNull();
    expect(before.forecast.attendance).toBeGreaterThanOrEqual(0);

    const settled = processHomeGameTicketRevenue(state);
    state = appendEventLog(settled.state, settled.events);
    const after = toFranchiseBusinessView(state);
    expect(after.lastGameDay).not.toBeNull();
    expect(after.lastGameDay!.attendance).toBe(
      settled.events.find((e) => e.type === "HomeGameDaySettled")!.payload
        .attendance,
    );
    expect(after.forecast.ticketPrice).toBe(
      state.business.franchiseOps[teamId]!.ticketPrice,
    );
  });
});
