import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS, DEFAULT_GAME_SETTINGS } from "@/domain/game-settings";
import { validateGameSettings } from "@/domain/game-settings-validation";
import { createInitialGameState } from "@/state/create-initial-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { DEFAULT_BUSINESS_FUNDS } from "@/systems/business-funds-config";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import {
  DEFAULT_SALARY_CAP,
  MAX_SALARY_CAP,
  MIN_SALARY_CAP,
} from "@/systems/salary-cap-config";
import { getTeamCapSpace, getTeamPayroll } from "@/systems/salary-cap";
import {
  getLeagueStaffBudget,
  getTeamStaffBudgetSpace,
  getTeamStaffPayroll,
} from "@/systems/staff-budget";
import {
  DEFAULT_STAFF_BUDGET,
  MAX_STAFF_BUDGET,
  MIN_STAFF_BUDGET,
} from "@/systems/staff-budget-config";
import { hireStaff, processWeeklyStaffPayroll } from "@/systems/staff";
import { processWeeklyPlayerPayroll } from "@/systems/player-payroll";
import { asStaffId, asTeamId } from "@/domain/ids";
import { createStaff } from "@/domain/entities/staff";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../helpers/determinism";

describe("league financial settings", () => {
  it("defaults salaryCap and staffBudget on DEFAULT_GAME_SETTINGS", () => {
    expect(DEFAULT_GAME_SETTINGS.financialRules.salaryCap).toBe(
      DEFAULT_SALARY_CAP,
    );
    expect(DEFAULT_GAME_SETTINGS.financialRules.staffBudget).toBe(
      DEFAULT_STAFF_BUDGET,
    );
  });

  it("accepts a custom salary cap and staff budget", () => {
    const result = validateGameSettings({
      ...CBL_GAME_SETTINGS,
      financialRules: {
        ...CBL_GAME_SETTINGS.financialRules,
        salaryCap: 150_000_000,
        staffBudget: 15_000_000,
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.settings.financialRules.salaryCap).toBe(150_000_000);
      expect(result.settings.financialRules.staffBudget).toBe(15_000_000);
    }
  });

  it("rejects salary cap below minimum", () => {
    const result = validateGameSettings({
      ...CBL_GAME_SETTINGS,
      financialRules: {
        ...CBL_GAME_SETTINGS.financialRules,
        salaryCap: MIN_SALARY_CAP - 1,
      },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects salary cap above maximum", () => {
    const result = validateGameSettings({
      ...CBL_GAME_SETTINGS,
      financialRules: {
        ...CBL_GAME_SETTINGS.financialRules,
        salaryCap: MAX_SALARY_CAP + 1,
      },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects staff budget out of range", () => {
    expect(
      validateGameSettings({
        ...CBL_GAME_SETTINGS,
        financialRules: {
          ...CBL_GAME_SETTINGS.financialRules,
          staffBudget: MIN_STAFF_BUDGET - 1,
        },
      }).ok,
    ).toBe(false);
    expect(
      validateGameSettings({
        ...CBL_GAME_SETTINGS,
        financialRules: {
          ...CBL_GAME_SETTINGS.financialRules,
          staffBudget: MAX_STAFF_BUDGET + 1,
        },
      }).ok,
    ).toBe(false);
  });

  it("persists configured salary cap and staff budget into initial state", () => {
    const settings = {
      ...CBL_GAME_SETTINGS,
      financialRules: {
        ...CBL_GAME_SETTINGS.financialRules,
        salaryCap: 125_000_000,
        staffBudget: 10_000_000,
      },
    };
    const state = createInitialGameState({
      saveId: "cap_custom",
      rngSeed: TEST_RNG_SEED,
      nowIso: TEST_NOW_ISO,
      settings,
    });
    expect(getLeagueSalaryCap(state)).toBe(125_000_000);
    expect(getLeagueStaffBudget(state)).toBe(10_000_000);
    for (const teamId of Object.keys(state.world.teams)) {
      expect(state.business.finances[teamId]!.businessFunds).toBe(
        DEFAULT_BUSINESS_FUNDS,
      );
    }
  });

  it("uses league salary cap for all teams' cap space", () => {
    const state = createInitialGameState({
      saveId: "cap_space",
      rngSeed: TEST_RNG_SEED,
      nowIso: TEST_NOW_ISO,
      settings: {
        ...CBL_GAME_SETTINGS,
        financialRules: {
          ...CBL_GAME_SETTINGS.financialRules,
          salaryCap: 80_000_000,
        },
      },
    });
    const year = state.competition.season.year;
    for (const teamId of Object.keys(state.world.teams)) {
      const payroll = getTeamPayroll(asTeamId(teamId), year, state);
      expect(getTeamCapSpace(asTeamId(teamId), year, state)).toBe(
        80_000_000 - payroll,
      );
    }
  });
});

describe("staff budget", () => {
  it("blocks hire when annual salary exceeds staff budget space", () => {
    let state = createInitialGameState({
      saveId: "staff_budget",
      rngSeed: TEST_RNG_SEED,
      nowIso: TEST_NOW_ISO,
      settings: {
        ...CBL_GAME_SETTINGS,
        financialRules: {
          ...CBL_GAME_SETTINGS.financialRules,
          staffBudget: 5_000_000,
        },
      },
    });
    const teamId = asTeamId(Object.keys(state.world.teams)[0]!);
    // Clear existing staff so role slot is free.
    state = {
      ...state,
      world: {
        ...state.world,
        staff: {},
        teams: {
          ...state.world.teams,
          [teamId]: { ...state.world.teams[teamId]!, staff: [] },
        },
      },
      business: {
        ...state.business,
        staffContracts: {},
      },
    };
    const staffId = asStaffId("staff_expensive_hc");
    const staff = createStaff({
      id: staffId,
      firstName: "Expensive",
      lastName: "Coach",
      role: "head_coach",
      quality: 99,
      experience: 10,
      teamId: null,
      strengths: ["leadership"],
      weaknesses: [],
    });
    state = {
      ...state,
      world: {
        ...state.world,
        staff: { ...state.world.staff, [staffId]: staff },
      },
    };
    expect(getTeamStaffBudgetSpace(teamId, state.competition.season.year, state)).toBe(
      5_000_000,
    );
    expect(() =>
      hireStaff(state, teamId, staffId, { annualSalary: 10_000_000 }),
    ).toThrow(/staff budget/i);
  });

  it("does not drain business funds on weekly staff or player payroll", () => {
    const state = createInitialGameState({
      saveId: "no_payroll_cash",
      rngSeed: TEST_RNG_SEED,
      nowIso: TEST_NOW_ISO,
      settings: CBL_GAME_SETTINGS,
    });
    const teamId = Object.keys(state.world.teams)[0]!;
    const before = state.business.finances[teamId]!.businessFunds;
    const afterStaff = processWeeklyStaffPayroll(state);
    const afterPlayer = processWeeklyPlayerPayroll(afterStaff.state);
    expect(afterPlayer.state.business.finances[teamId]!.businessFunds).toBe(
      before,
    );
  });
});

describe("triple-pool separation", () => {
  it("player payroll is separate from staff budget commitments", () => {
    const state = createInitialGameState({
      saveId: "pool_sep",
      rngSeed: TEST_RNG_SEED,
      nowIso: TEST_NOW_ISO,
      settings: CBL_GAME_SETTINGS,
    });
    const teamId = asTeamId(Object.keys(state.world.teams)[0]!);
    const year = state.competition.season.year;
    const playerPayroll = getTeamPayroll(teamId, year, state);
    const staffPayroll = getTeamStaffPayroll(teamId, year, state);
    expect(playerPayroll).toBeGreaterThanOrEqual(0);
    expect(staffPayroll).toBeGreaterThanOrEqual(0);
    // Staff budget space ignores player payroll.
    expect(getTeamStaffBudgetSpace(teamId, year, state)).toBe(
      DEFAULT_STAFF_BUDGET - staffPayroll,
    );
    expect(getTeamCapSpace(teamId, year, state)).toBe(
      DEFAULT_SALARY_CAP - playerPayroll,
    );
  });
});

describe("migration v46", () => {
  it("maps legacy cash to businessFunds and injects salaryCap/staffBudget", () => {
    const modern = createInitialGameState({
      saveId: "migrate_v46",
      rngSeed: TEST_RNG_SEED,
      nowIso: TEST_NOW_ISO,
      settings: CBL_GAME_SETTINGS,
    });
    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    const meta = parsed.meta as Record<string, unknown>;
    meta.schemaVersion = 45;

    const settings = parsed.settings as {
      financialRules: Record<string, unknown>;
    };
    delete settings.financialRules.salaryCap;
    delete settings.financialRules.staffBudget;

    const business = parsed.business as {
      finances: Record<string, Record<string, unknown>>;
    };
    const teamId = Object.keys(business.finances)[0]!;
    for (const [id, finance] of Object.entries(business.finances)) {
      const funds = id === teamId ? 12_000_000 : 18_000_000;
      delete finance.businessFunds;
      delete finance.businessFundsLedgerByMonth;
      finance.cash = funds;
      finance.cashLedgerByMonth = {
        "2026-10": {
          openCash: funds,
          playerPayrollOutflow: 100_000,
          netCashChange: -50_000,
        },
      };
    }

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded.business.finances[teamId]!.businessFunds).toBe(12_000_000);
    expect(
      loaded.business.finances[teamId]!.businessFundsLedgerByMonth["2026-10"]!
        .openBusinessFunds,
    ).toBe(12_000_000);
    expect(loaded.settings.financialRules.salaryCap).toBe(DEFAULT_SALARY_CAP);
    expect(loaded.settings.financialRules.staffBudget).toBe(DEFAULT_STAFF_BUDGET);
  });
});
