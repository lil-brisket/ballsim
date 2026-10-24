import {
  addCalendarDays,
  getCalendarMonthId,
  getIsoWeekId,
  parseCalendarDate,
} from "@/domain/calendar-date";
import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { projectCashHorizon } from "@/systems/cash-projection";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("projectCashHorizon", () => {
  it("includes monthly broadcast in the horizon and stays non-mutating", () => {
    let state = createInitialGameState({
      saveId: "horizon_broadcast",
      rngSeed: 11,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamId = state.user.activeOwnerTeamId;
    const cashBefore = state.business.finances[teamId]!.businessFunds;
    const projection = projectCashHorizon(state, teamId);
    expect(projection.inflowBreakdown.broadcast).toBeGreaterThan(0);
    expect(state.business.finances[teamId]!.businessFunds).toBe(cashBefore);
    expect(projection.outflowBreakdown.playerPayroll).toBeGreaterThan(0);
    expect(projection.outflowBreakdown.staff).toBeGreaterThanOrEqual(0);
    expect(projection.horizonEndDate.length).toBe(10);
  });

  it("records zero gate inflow when no remaining home games exist", () => {
    let state = createInitialGameState({
      saveId: "horizon_nogames",
      rngSeed: 12,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamId = state.user.activeOwnerTeamId;
    state = {
      ...state,
      competition: { ...state.competition, games: {} },
    };
    const projection = projectCashHorizon(state, teamId);
    expect(projection.inflowBreakdown.gate).toBe(0);
    expect(projection.horizonKind).toBe("near_term");
  });
});

describe("projection calendar stepping", () => {
  // projectBusinessFundsHorizon steps a UTC date and relies on these two
  // facts for consecutive days, checked here over ten years (2025-2034,
  // including the 53-week ISO years 2026 and 2032).
  it("a new ISO week starts exactly on Mondays and a new month on the 1st", () => {
    let date = "2025-01-01";
    while (date < "2035-01-01") {
      const next = addCalendarDays(date, 1);
      const { year, month, day } = parseCalendarDate(next);
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      expect(getIsoWeekId(next) !== getIsoWeekId(date), next).toBe(
        weekday === 1,
      );
      expect(getCalendarMonthId(next) !== getCalendarMonthId(date), next).toBe(
        day === 1,
      );
      date = next;
    }
  });
});
