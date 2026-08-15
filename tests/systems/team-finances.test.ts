import { describe, expect, it } from "vitest";
import { createContract, type Contract } from "@/domain/entities/contract";
import { createEmptyTeamFinanceBooks } from "@/domain/entities/finances";
import {
  asContractId,
  asPlayerId,
  asTeamId,
  type TeamId,
} from "@/domain/ids";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { GameState } from "@/state/game-state";
import { getTeamPayroll } from "@/systems/salary-cap";
import {
  getFinancialStatement,
  getNetIncome,
  getTotalExpenses,
  getTotalRevenue,
  recordExpense,
  recordRevenue,
} from "@/systems/team-finances";
import { createPlayer } from "../factories/player";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../helpers/determinism";

function baseState(): GameState {
  return createInitialGameState({
    saveId: "save_team_finances",
    rngSeed: TEST_RNG_SEED,
    nowIso: TEST_NOW_ISO,
    settings: CBL_GAME_SETTINGS,
  });
}

function withContracts(state: GameState, contracts: Contract[]): GameState {
  const players = { ...state.world.players };
  const contractMap: Record<string, Contract> = {
    ...state.business.contracts,
  };
  for (const contract of contracts) {
    contractMap[contract.id] = contract;
    if (!players[contract.playerId]) {
      players[contract.playerId] = createPlayer({
        id: contract.playerId,
        teamId: contract.teamId,
        contractId: contract.id,
      });
    }
  }
  return {
    ...state,
    world: { ...state.world, players },
    business: { ...state.business, contracts: contractMap },
  };
}

describe("team-finances revenue", () => {
  it("records ticket revenue", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const result = recordRevenue(state, teamId, "tickets", 100_000, year);
    expect(
      result.state.business.finances[teamId]!.booksByYear[String(year)]!.revenue
        .tickets,
    ).toBe(100_000);
    expect(getTotalRevenue(result.state, teamId, year)).toBe(100_000);
  });

  it("records sponsorship revenue", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const result = recordRevenue(state, teamId, "sponsorships", 50_000, year);
    expect(
      result.state.business.finances[teamId]!.booksByYear[String(year)]!.revenue
        .sponsorships,
    ).toBe(50_000);
  });

  it("records merchandise revenue", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const result = recordRevenue(state, teamId, "merchandise", 25_000, year);
    expect(
      result.state.business.finances[teamId]!.booksByYear[String(year)]!.revenue
        .merchandise,
    ).toBe(25_000);
  });

  it("records other revenue", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const result = recordRevenue(state, teamId, "other", 10_000, year);
    expect(
      result.state.business.finances[teamId]!.booksByYear[String(year)]!.revenue
        .other,
    ).toBe(10_000);
  });

  it("sums revenue categories into total revenue", () => {
    let state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    state = recordRevenue(state, teamId, "tickets", 100, year).state;
    state = recordRevenue(state, teamId, "sponsorships", 200, year).state;
    state = recordRevenue(state, teamId, "merchandise", 300, year).state;
    state = recordRevenue(state, teamId, "other", 400, year).state;
    expect(getTotalRevenue(state, teamId, year)).toBe(1000);
    expect(getFinancialStatement(state, teamId, year).revenue.total).toBe(1000);
  });

  it("uses additive posting for duplicate revenue writes", () => {
    let state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    state = recordRevenue(state, teamId, "tickets", 100, year).state;
    state = recordRevenue(state, teamId, "tickets", 100, year).state;
    expect(
      state.business.finances[teamId]!.booksByYear[String(year)]!.revenue
        .tickets,
    ).toBe(200);
  });
});

describe("team-finances expenses", () => {
  it("records staff expense", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const result = recordExpense(state, teamId, "staff", 40_000, year);
    expect(
      result.state.business.finances[teamId]!.booksByYear[String(year)]!.expenses
        .staff,
    ).toBe(40_000);
  });

  it("records facilities expense", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const result = recordExpense(state, teamId, "facilities", 30_000, year);
    expect(
      result.state.business.finances[teamId]!.booksByYear[String(year)]!.expenses
        .facilities,
    ).toBe(30_000);
  });

  it("records operations expense", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const result = recordExpense(state, teamId, "operations", 20_000, year);
    expect(
      result.state.business.finances[teamId]!.booksByYear[String(year)]!.expenses
        .operations,
    ).toBe(20_000);
  });

  it("records marketing expense", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const result = recordExpense(state, teamId, "marketing", 15_000, year);
    expect(
      result.state.business.finances[teamId]!.booksByYear[String(year)]!.expenses
        .marketing,
    ).toBe(15_000);
  });

  it("sums posted expenses and contract-derived player salaries", () => {
    let state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    state = withContracts(state, [
      createContract({
        id: asContractId("c_sal"),
        playerId: asPlayerId("p_sal"),
        teamId,
        startYear: year,
        endYear: year,
        salaryByYear: { [String(year)]: 1_000_000 },
      }),
    ]);
    state = recordExpense(state, teamId, "staff", 100, year).state;
    state = recordExpense(state, teamId, "facilities", 200, year).state;
    state = recordExpense(state, teamId, "operations", 300, year).state;
    state = recordExpense(state, teamId, "marketing", 400, year).state;
    expect(getTotalExpenses(state, teamId, year)).toBe(1_001_000);
  });

  it("uses additive posting for duplicate expense writes", () => {
    let state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    state = recordExpense(state, teamId, "staff", 50, year).state;
    state = recordExpense(state, teamId, "staff", 50, year).state;
    expect(
      state.business.finances[teamId]!.booksByYear[String(year)]!.expenses
        .staff,
    ).toBe(100);
  });

  it("rejects posting playerSalaries as an expense category", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    expect(() =>
      recordExpense(
        state,
        teamId,
        "playerSalaries" as never,
        100,
        year,
      ),
    ).toThrow(/playerSalaries/);
  });
});

describe("team-finances financial statement", () => {
  it("builds correct revenue, expense, and net income totals", () => {
    let state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    state = withContracts(state, [
      createContract({
        id: asContractId("c1"),
        playerId: asPlayerId("p1"),
        teamId,
        startYear: year,
        endYear: year,
        salaryByYear: { [String(year)]: 500_000 },
      }),
    ]);
    state = recordRevenue(state, teamId, "tickets", 800_000, year).state;
    state = recordExpense(state, teamId, "operations", 100_000, year).state;

    const statement = getFinancialStatement(state, teamId, year);
    expect(statement.revenue.total).toBe(800_000);
    expect(statement.expenses.playerSalaries).toBe(500_000);
    expect(statement.expenses.operations).toBe(100_000);
    expect(statement.expenses.total).toBe(600_000);
    expect(statement.netIncome).toBe(200_000);
    expect(getNetIncome(state, teamId, year)).toBe(200_000);
  });

  it("reports a profitable team", () => {
    let state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    state = recordRevenue(state, teamId, "sponsorships", 1_000, year).state;
    state = recordExpense(state, teamId, "marketing", 200, year).state;
    expect(getNetIncome(state, teamId, year)).toBeGreaterThan(0);
  });

  it("reports a team operating at a loss", () => {
    let state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    state = recordRevenue(state, teamId, "other", 100, year).state;
    state = recordExpense(state, teamId, "facilities", 500, year).state;
    expect(getNetIncome(state, teamId, year)).toBeLessThan(0);
  });

  it("isolates multiple financial periods", () => {
    let state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    state = recordRevenue(state, teamId, "tickets", 100, year).state;
    state = recordRevenue(state, teamId, "tickets", 999, year + 1).state;
    expect(getTotalRevenue(state, teamId, year)).toBe(100);
    expect(getTotalRevenue(state, teamId, year + 1)).toBe(999);
  });

  it("isolates multiple teams", () => {
    let state = baseState();
    const teamIds = Object.keys(state.world.teams) as TeamId[];
    const teamA = teamIds[0]!;
    const teamB = teamIds[1]!;
    const year = state.competition.season.year;
    state = recordRevenue(state, teamA, "merchandise", 111, year).state;
    state = recordRevenue(state, teamB, "merchandise", 222, year).state;
    expect(getTotalRevenue(state, teamA, year)).toBe(111);
    expect(getTotalRevenue(state, teamB, year)).toBe(222);
  });

  it("derives player salary expense from contracts", () => {
    let state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    state = withContracts(state, [
      createContract({
        id: asContractId("c_pay"),
        playerId: asPlayerId("p_pay"),
        teamId,
        startYear: year,
        endYear: year,
        salaryByYear: { [String(year)]: 2_500_000 },
      }),
    ]);
    const statement = getFinancialStatement(state, teamId, year);
    expect(statement.expenses.playerSalaries).toBe(
      getTeamPayroll(teamId, year, state),
    );
    expect(statement.expenses.playerSalaries).toBe(2_500_000);
    expect(
      state.business.finances[teamId]!.booksByYear[String(year)],
    ).toBeUndefined();
  });
});

describe("team-finances immutability and validation", () => {
  it("does not mutate input GameState on recordRevenue", () => {
    const state = baseState();
    const snapshot = structuredClone(state);
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const otherTeamId = Object.keys(state.world.teams).find(
      (id) => id !== teamId,
    ) as TeamId;
    const otherBefore = state.business.finances[otherTeamId];

    const result = recordRevenue(state, teamId, "tickets", 10, year);
    expect(state).toEqual(snapshot);
    expect(result.state).not.toBe(state);
    expect(result.state.business.finances[otherTeamId]).toBe(otherBefore);
    expect(result.state.business.finances[teamId]!.cash).toBe(
      state.business.finances[teamId]!.cash,
    );
    expect(result.state.business.finances[teamId]!.payroll).toBe(
      state.business.finances[teamId]!.payroll,
    );
  });

  it("does not mutate input GameState on recordExpense", () => {
    const state = baseState();
    const snapshot = structuredClone(state);
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const result = recordExpense(state, teamId, "staff", 10, year);
    expect(state).toEqual(snapshot);
    expect(result.state).not.toBe(state);
  });

  it("throws when finance record is missing and does not auto-create", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const { [teamId]: _removed, ...financesWithoutTeam } = state.business.finances;
    const broken: GameState = {
      ...state,
      business: { ...state.business, finances: financesWithoutTeam },
    };
    expect(() => recordRevenue(broken, teamId, "tickets", 1, year)).toThrow(
      /missing from business.finances/,
    );
    expect(broken.business.finances[teamId]).toBeUndefined();
  });

  it("throws for unknown team id", () => {
    const state = baseState();
    expect(() =>
      recordRevenue(state, asTeamId("team_missing"), "tickets", 1, 2026),
    ).toThrow(/missing from world.teams/);
  });

  it("throws for invalid revenue category", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    expect(() =>
      recordRevenue(state, teamId, "broadcast" as never, 1, 2026),
    ).toThrow(/Invalid revenue category/);
  });

  it("throws for invalid expense category", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    expect(() =>
      recordExpense(state, teamId, "travel" as never, 1, 2026),
    ).toThrow(/Invalid expense category/);
  });

  it("throws for negative amounts", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    expect(() =>
      recordRevenue(state, teamId, "tickets", -1, 2026),
    ).toThrow(/must be >= 0/);
  });

  it("throws for non-integer year", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    expect(() =>
      recordRevenue(state, teamId, "tickets", 1, 2026.5),
    ).toThrow(/year must be an integer/);
  });

  it("rejects malformed booksByYear keys on load", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const json = JSON.stringify({
      ...state,
      business: {
        ...state.business,
        finances: {
          ...state.business.finances,
          [teamId]: {
            ...state.business.finances[teamId],
            booksByYear: {
              foo: createEmptyTeamFinanceBooks(),
            },
          },
        },
      },
    });
    expect(() => deserializeGameState(json)).toThrow(/booksByYear key/);
  });
});

describe("team-finances persistence", () => {
  it("survives save/load round-trip", () => {
    let state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    state = recordRevenue(state, teamId, "tickets", 12_000, year).state;
    state = recordExpense(state, teamId, "marketing", 3_000, year).state;

    const restored = deserializeGameState(serializeGameState(state));
    expect(() => validateGameState(restored)).not.toThrow();
    expect(restored.business.finances[teamId]!.booksByYear[String(year)]).toEqual(
      state.business.finances[teamId]!.booksByYear[String(year)],
    );
    expect(getFinancialStatement(restored, teamId, year)).toEqual(
      getFinancialStatement(state, teamId, year),
    );
  });
});
