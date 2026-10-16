import { describe, expect, it } from "vitest";
import { addCalendarDays } from "@/domain/calendar-date";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import { createInitialGameState } from "@/state/create-initial-state";
import { getFinancialStatement } from "@/systems/team-finances";
import {
  nationalMediaPerTeamPerSeason,
  processWeeklyNationalMedia,
} from "@/systems/league-economy";
import { processWeeklyPlayerPayroll } from "@/systems/player-payroll";
import {
  regularSeasonDateSpan,
  regularSeasonShareOfWeek,
} from "@/systems/regular-season-pay";
import { getTeamPayroll } from "@/systems/salary-cap";
import { bootstrapWorld } from "@/systems/world-pipeline";

function bootstrapped(saveId: string, rngSeed: number): GameState {
  const state = createInitialGameState({
    saveId,
    rngSeed,
    settings: CBL_GAME_SETTINGS,
  });
  return bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
}

/** Last day of a full week inside the regular season. */
function midSeasonWeekEnd(state: GameState): string {
  const span = regularSeasonDateSpan(state);
  if (span === null) {
    throw new Error("expected a scheduled regular season");
  }
  return addCalendarDays(span.start, 13);
}

/** Every week end from just before the season through just after it. */
function seasonWeekEnds(state: GameState): string[] {
  const span = regularSeasonDateSpan(state)!;
  const ends: string[] = [];
  for (
    let end = addCalendarDays(span.start, -3);
    end <= addCalendarDays(span.end, 7);
    end = addCalendarDays(end, 7)
  ) {
    ends.push(end);
  }
  return ends;
}

describe("player payroll", () => {
  it("drains the week's regular-season share without posting playerSalaries", () => {
    const state = bootstrapped("payroll_cash", 44);
    const teamId = state.user.activeOwnerTeamId;
    const year = state.competition.season.year;
    const annual = getTeamPayroll(teamId, year, state);
    expect(annual).toBeGreaterThan(0);
    const weekEnd = midSeasonWeekEnd(state);
    const weekly = Math.round(
      annual * regularSeasonShareOfWeek(state, weekEnd),
    );
    expect(weekly).toBeGreaterThan(0);

    const fundsBefore = state.business.finances[teamId]!.businessFunds;
    const booksBefore =
      state.business.finances[teamId]!.booksByYear[String(year)]?.expenses;
    const result = processWeeklyPlayerPayroll(state, weekEnd);
    const fundsAfter = result.state.business.finances[teamId]!.businessFunds;
    expect(fundsAfter).toBe(fundsBefore - weekly);

    const booksAfter =
      result.state.business.finances[teamId]!.booksByYear[String(year)]
        ?.expenses;
    expect(booksAfter?.operations ?? 0).toBe(booksBefore?.operations ?? 0);
    expect(booksAfter?.staff ?? 0).toBe(booksBefore?.staff ?? 0);
    expect(
      result.events.filter((e) => e.type === "PlayerPayrollPaid"),
    ).toHaveLength(Object.keys(state.world.teams).length);

    const statement = getFinancialStatement(result.state, teamId, year);
    expect(statement.expenses.playerSalaries).toBe(annual);
  });

  it("pays nothing in a week outside the regular season", () => {
    const state = bootstrapped("payroll_offseason", 45);
    const span = regularSeasonDateSpan(state)!;
    const result = processWeeklyPlayerPayroll(
      state,
      addCalendarDays(span.start, -1),
    );
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it("pays exactly the annual payroll over the regular season (#93)", () => {
    const state = bootstrapped("payroll_season_total", 46);
    const teamId = state.user.activeOwnerTeamId;
    const annual = getTeamPayroll(teamId, state.competition.season.year, state);
    let current = state;
    for (const weekEnd of seasonWeekEnds(state)) {
      current = processWeeklyPlayerPayroll(current, weekEnd).state;
    }
    const paid =
      state.business.finances[teamId]!.businessFunds -
      current.business.finances[teamId]!.businessFunds;
    // Per-week rounding only.
    expect(Math.abs(paid - annual)).toBeLessThanOrEqual(30);
  });

  it("higher payroll creates more business-funds pressure", () => {
    const state = bootstrapped("payroll_e", 50);
    const teamIds = Object.keys(state.world.teams);
    const year = state.competition.season.year;
    const payrolls = teamIds.map((id) => ({
      id,
      payroll: getTeamPayroll(id as never, year, state),
    }));
    payrolls.sort((a, b) => a.payroll - b.payroll);
    const low = payrolls[0]!;
    const high = payrolls[payrolls.length - 1]!;
    expect(high.payroll).toBeGreaterThanOrEqual(low.payroll);

    const fundsLowBefore = state.business.finances[low.id]!.businessFunds;
    const fundsHighBefore = state.business.finances[high.id]!.businessFunds;
    const result = processWeeklyPlayerPayroll(state, midSeasonWeekEnd(state));
    const lowDrain =
      fundsLowBefore - result.state.business.finances[low.id]!.businessFunds;
    const highDrain =
      fundsHighBefore - result.state.business.finances[high.id]!.businessFunds;
    expect(highDrain).toBeGreaterThanOrEqual(lowDrain);
  });
});

describe("national media", () => {
  it("pays every team the same share of the cap-linked season amount", () => {
    const state = bootstrapped("national_media", 47);
    const year = state.competition.season.year;
    const weekEnd = midSeasonWeekEnd(state);
    const expected = Math.round(
      nationalMediaPerTeamPerSeason(state) *
        regularSeasonShareOfWeek(state, weekEnd),
    );
    expect(expected).toBeGreaterThan(0);
    const result = processWeeklyNationalMedia(state, weekEnd).state;
    for (const teamId of Object.keys(state.world.teams)) {
      const before = state.business.finances[teamId]!;
      const after = result.business.finances[teamId]!;
      expect(after.businessFunds - before.businessFunds).toBe(expected);
      expect(
        (after.booksByYear[String(year)]?.revenue.broadcast ?? 0) -
          (before.booksByYear[String(year)]?.revenue.broadcast ?? 0),
      ).toBe(expected);
    }
  });

  it("adds up to the full season amount over the regular season", () => {
    const state = bootstrapped("national_media_total", 48);
    const teamId = state.user.activeOwnerTeamId;
    let current = state;
    for (const weekEnd of seasonWeekEnds(state)) {
      current = processWeeklyNationalMedia(current, weekEnd).state;
    }
    const received =
      current.business.finances[teamId]!.businessFunds -
      state.business.finances[teamId]!.businessFunds;
    expect(
      Math.abs(received - nationalMediaPerTeamPerSeason(state)),
    ).toBeLessThanOrEqual(30);
  });
});
