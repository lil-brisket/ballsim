import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS, type GameSettings } from "@/domain/game-settings";
import type { PlayerId, TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { validateGameState } from "@/persistence/validate-game-state";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import {
  assessPayrollRules,
  LUXURY_TAX_TIER_CAP_SHARE,
  luxuryTaxBill,
  luxuryTaxThreshold,
  salaryFloor,
} from "@/systems/payroll-rules";
import { getTeamPayroll } from "@/systems/salary-cap";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { bootstrapWorld } from "@/systems/world-pipeline";

function league(settings: GameSettings = CBL_GAME_SETTINGS): GameState {
  const initial = createInitialGameState({
    saveId: "payroll_rules",
    rngSeed: 61,
    settings,
  });
  const state = bootstrapWorld(
    initial,
    createSeededRng(initial.meta.rngState),
  ).state;
  return beginRegularSeasonFromPreseason(state).state;
}

/** Give a team a dead-money entry so its payroll lands where we want it. */
function withPayroll(
  state: GameState,
  teamId: TeamId,
  target: number,
): GameState {
  const year = state.competition.season.year;
  const delta = target - getTeamPayroll(teamId, year, state);
  const playerId = Object.keys(state.world.players)[0]! as PlayerId;
  if (delta <= 0) throw new Error("target below current payroll");
  return {
    ...state,
    business: {
      ...state.business,
      deadMoney: {
        ...state.business.deadMoney,
        [teamId]: [
          {
            playerId,
            teamId,
            seasonYear: year,
            amount: delta,
            reason: "waived",
            prepaid: true,
            createdOn: state.world.calendar.currentDate,
          },
        ],
      },
    },
  };
}

describe("luxuryTaxBill", () => {
  const cap = 100_000_000;
  const tier = cap * LUXURY_TAX_TIER_CAP_SHARE;
  it("is zero at or under the threshold", () => {
    expect(luxuryTaxBill(110_000_000, 110_000_000, cap, 1.5)).toBe(0);
    expect(luxuryTaxBill(90_000_000, 110_000_000, cap, 1.5)).toBe(0);
  });
  it("charges the base rate in the first tier and more in later tiers", () => {
    expect(luxuryTaxBill(110_000_000 + 1_000_000, 110_000_000, cap, 1.5)).toBe(
      1_500_000,
    );
    // A full first tier plus 2M into the second.
    expect(
      luxuryTaxBill(110_000_000 + tier + 2_000_000, 110_000_000, cap, 1.5),
    ).toBe(tier * 1.5 + 2_000_000 * 2);
  });
});

describe("assessPayrollRules", () => {
  it("taxes payroll over the line (dead money included) and shares it out", () => {
    let state = league();
    const cap = getLeagueSalaryCap(state);
    const line = luxuryTaxThreshold(state.settings, cap);
    const teams = Object.keys(state.world.teams).sort() as TeamId[];
    const taxed = teams[0]!;
    state = withPayroll(state, taxed, line + 2_000_000);
    const before = state.business.finances[taxed]!.businessFunds;

    const result = assessPayrollRules(state);
    const rows =
      result.state.business.payrollAssessments[
        String(state.competition.season.year)
      ]!;
    expect(rows[taxed]!.taxBill).toBe(3_000_000);
    expect(result.state.business.finances[taxed]!.businessFunds).toBe(
      before - 3_000_000 - rows[taxed]!.floorShortfall,
    );
    const shares = teams
      .filter((id) => id !== taxed)
      .reduce((sum, id) => sum + rows[id]!.taxShare, 0);
    expect(shares).toBe(3_000_000);
    expect(rows[taxed]!.taxShare).toBe(0);
    expect(result.events.some((e) => e.type === "PayrollRulesAssessed")).toBe(
      true,
    );
    expect(() => validateGameState(result.state)).not.toThrow();
  });

  it("charges teams under the floor the shortfall", () => {
    const state = league();
    const cap = getLeagueSalaryCap(state);
    const floor = salaryFloor(state.settings, cap);
    const year = state.competition.season.year;
    const rows =
      assessPayrollRules(state).state.business.payrollAssessments[
        String(year)
      ]!;
    for (const [teamId, row] of Object.entries(rows)) {
      const payroll = getTeamPayroll(teamId as TeamId, year, state);
      expect(row.floorShortfall).toBe(Math.max(0, floor - payroll));
    }
  });

  it("runs once per season", () => {
    const state = league();
    const once = assessPayrollRules(state).state;
    expect(assessPayrollRules(once).state).toBe(once);
  });

  it("does nothing when both rules are off", () => {
    const state = league({
      ...CBL_GAME_SETTINGS,
      financialRules: {
        ...CBL_GAME_SETTINGS.financialRules,
        luxuryTaxEnabled: false,
        salaryFloorEnabled: false,
      },
    });
    expect(assessPayrollRules(state).state).toBe(state);
  });
});
