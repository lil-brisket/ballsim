import { describe, expect, it } from "vitest";
import { addCalendarDays, calendarDaysBetween } from "@/domain/calendar-date";
import { type TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  getCalendarContext,
  resolveTradeDeadlineDate,
  areTradesOpen,
} from "@/systems/simulation/calendar-context";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { transitionPhase } from "@/systems/simulation/phase-machine";
import { validateTrade } from "@/systems/trades/trade-validation";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import { TRADE_DEADLINE_SEASON_FRACTION } from "@/systems/league-rules/invariants";

describe("calendar context", () => {
  it("resolves trade deadline from league calendar span at 60% hard lock", () => {
    const start = "2026-10-01";
    const end = "2027-04-15";
    const byDays = resolveTradeDeadlineDate(
      { kind: "days_after_season_start", daysAfterSeasonStart: 100 },
      start,
      end,
    );
    expect(byDays).toBe(addCalendarDays(start, 100));

    const spanDays = calendarDaysBetween(start, end);
    const byFraction = resolveTradeDeadlineDate(
      { kind: "fraction_of_season_span", seasonSpanFraction: 0.5 },
      start,
      end,
    );
    // Hard lock always uses 0.6, ignoring the settings fraction.
    expect(byFraction).toBe(
      addCalendarDays(
        start,
        Math.round(spanDays * TRADE_DEADLINE_SEASON_FRACTION),
      ),
    );
  });

  it("marks trades closed after the snapshotted deadline during regular season", () => {
    let state = createInitialGameState({
      saveId: "cal_deadline",
      rngSeed: 7,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = beginRegularSeasonFromPreseason(state).state;
    expect(state.competition.season.phase).toBe("regular");
    expect(state.competition.season.tradeDeadlineDate).toBeTruthy();

    const deadline = state.competition.season.tradeDeadlineDate!;
    const openCtx = getCalendarContext(state);
    expect(openCtx.tradesOpen).toBe(true);

    state = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          currentDate: deadline,
        },
      },
    };
    const late = getCalendarContext(state);
    expect(late.tradesOpen).toBe(false);
    expect(areTradesOpen("regular", deadline, late.tradeDeadlineDate)).toBe(
      false,
    );
    expect(
      areTradesOpen("regular", addCalendarDays(deadline, -1), deadline),
    ).toBe(true);
  });

  it("rejects in-season player trades after the deadline", () => {
    let state = createInitialGameState({
      saveId: "cal_trade_lock",
      rngSeed: 9,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = beginRegularSeasonFromPreseason(state).state;
    const deadline = state.competition.season.tradeDeadlineDate!;
    state = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          currentDate: addCalendarDays(deadline, 1),
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
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = beginRegularSeasonFromPreseason(state).state;
    const deadline = state.competition.season.tradeDeadlineDate!;
    // 3 days before deadline → deadline_window (config: 14 days)
    state = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          currentDate: addCalendarDays(deadline, -3),
        },
      },
    };
    const ctx = getCalendarContext(state);
    expect(ctx.seasonSegment).toBe("deadline_window");
    expect(ctx.deadlineWindow).toBe(true);
    expect(ctx.displayLabel).toBe("Trade Deadline");
  });
});
