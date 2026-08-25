import { describe, expect, it } from "vitest";
import { addCalendarDays } from "@/domain/calendar-date";
import { asGameId, asTeamId, type TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  getCalendarContext,
  resolveTradeDeadlineDate,
  areTradesOpen,
} from "@/systems/simulation/calendar-context";
import { processSeasonLifecycle } from "@/systems/simulation/season-lifecycle";
import { transitionPhase } from "@/systems/simulation/phase-machine";
import { validateTrade } from "@/systems/trades/trade-validation";
import { createGame } from "@/domain/entities/game";
import type { TradeProposal } from "@/domain/entities/trade-proposal";

describe("calendar context", () => {
  it("resolves trade deadline from league calendar span, not game index", () => {
    const start = "2026-10-01";
    const end = "2027-04-15";
    const byDays = resolveTradeDeadlineDate(
      { kind: "days_after_season_start", daysAfterSeasonStart: 100 },
      start,
      end,
    );
    expect(byDays).toBe(addCalendarDays(start, 100));

    const byFraction = resolveTradeDeadlineDate(
      { kind: "fraction_of_season_span", seasonSpanFraction: 0.5 },
      start,
      end,
    );
    expect(byFraction).toBe(addCalendarDays(start, 98));
  });

  it("marks trades closed after the deadline during regular season", () => {
    let state = createInitialGameState({
      saveId: "cal_deadline",
      rngSeed: 7,
      settings: {
        ...CBL_GAME_SETTINGS,
        regularSeason: {
          ...CBL_GAME_SETTINGS.regularSeason,
          tradeDeadlineRule: {
            kind: "days_after_season_start",
            daysAfterSeasonStart: 10,
          },
        },
      },
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = processSeasonLifecycle(state).state;
    expect(state.competition.season.phase).toBe("regular");
    expect(state.competition.season.regularSeasonStartDate).toBeTruthy();

    const start = state.competition.season.regularSeasonStartDate!;
    const openCtx = getCalendarContext(state);
    expect(openCtx.tradesOpen).toBe(true);

    state = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          currentDate: addCalendarDays(start, 11),
        },
      },
    };
    const late = getCalendarContext(state);
    expect(late.tradesOpen).toBe(false);
    expect(late.seasonSegment).toBe("late");
    expect(areTradesOpen("regular", addCalendarDays(start, 11), late.tradeDeadlineDate)).toBe(
      false,
    );
  });

  it("rejects in-season player trades after the deadline", () => {
    let state = createInitialGameState({
      saveId: "cal_trade_lock",
      rngSeed: 9,
      settings: {
        ...CBL_GAME_SETTINGS,
        regularSeason: {
          ...CBL_GAME_SETTINGS.regularSeason,
          tradeDeadlineRule: {
            kind: "days_after_season_start",
            daysAfterSeasonStart: 5,
          },
        },
      },
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = processSeasonLifecycle(state).state;
    const start = state.competition.season.regularSeasonStartDate!;
    state = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          currentDate: addCalendarDays(start, 6),
        },
      },
    };

    const teamIds = Object.keys(state.world.teams) as TeamId[];
    const teamA = teamIds[0]!;
    const teamB = teamIds[1]!;
    const playersA = Object.values(state.world.players).filter(
      (p) => p.teamId === teamA,
    );
    const playersB = Object.values(state.world.players).filter(
      (p) => p.teamId === teamB,
    );
    expect(playersA.length).toBeGreaterThan(0);
    expect(playersB.length).toBeGreaterThan(0);

    const proposal: TradeProposal = {
      sideA: {
        teamId: teamA,
        playerIds: [playersA[0]!.id],
        draftPickIds: [],
      },
      sideB: {
        teamId: teamB,
        playerIds: [playersB[0]!.id],
        draftPickIds: [],
      },
    };
    const result = validateTrade(state, proposal);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "TRADE_DEADLINE_PASSED")).toBe(
      true,
    );
  });

  it("surfaces Season Review display label on postseason", () => {
    let state = createInitialGameState({
      saveId: "cal_review",
      settings: CBL_GAME_SETTINGS,
    });
    state = transitionPhase(state, "regular").state;
    state = transitionPhase(state, "postseason").state;
    const ctx = getCalendarContext(state);
    expect(ctx.lifecyclePhase).toBe("postseason");
    expect(ctx.displayLabel).toBe("Season Review");
    expect(ctx.offseasonPriorities).toContain("season_review");
  });

  it("uses season segment deadline_window near the deadline", () => {
    let state = createInitialGameState({
      saveId: "cal_window",
      rngSeed: 11,
      settings: {
        ...CBL_GAME_SETTINGS,
        regularSeason: {
          ...CBL_GAME_SETTINGS.regularSeason,
          tradeDeadlineRule: {
            kind: "days_after_season_start",
            daysAfterSeasonStart: 30,
          },
        },
      },
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = processSeasonLifecycle(state).state;
    const start = state.competition.season.regularSeasonStartDate!;
    // Ensure schedule end exists after deadline for span-based helpers.
    const lateGameId = asGameId("game_cal_end");
    const teamIds = Object.keys(state.world.teams) as TeamId[];
    const lateGame = createGame({
      competitionType: "regular_season",
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
      id: lateGameId,
      seasonId: state.competition.season.id,
      date: addCalendarDays(start, 80),
      homeTeamId: asTeamId(teamIds[0]!),
      awayTeamId: asTeamId(teamIds[1]!),
      status: "scheduled",
      score: { home: 0, away: 0 },
      periodScores: [],
      events: [],
      playerStats: [],
    });
    state = {
      ...state,
      competition: {
        ...state.competition,
        schedule: {
          ...state.competition.schedule,
          gameIds: [...state.competition.schedule.gameIds, lateGameId],
        },
        games: {
          ...state.competition.games,
          [lateGameId]: lateGame,
        },
      },
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          currentDate: addCalendarDays(start, 25),
        },
      },
    };
    const ctx = getCalendarContext(state);
    expect(ctx.seasonSegment).toBe("deadline_window");
    expect(ctx.deadlineWindow).toBe(true);
    expect(ctx.displayLabel).toBe("Trade Deadline");
  });
});
