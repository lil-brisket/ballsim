import { describe, expect, it } from "vitest";
import {
  createContract,
  declineTeamOption,
  exercisePlayerOption,
  exerciseTeamOption,
  type Contract,
} from "@/domain/entities/contract";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { GameState } from "@/state/game-state";
import { asContractId, asPlayerId } from "@/domain/ids";
import {
  getTeamAmountOverTheCap,
  getTeamCapSpace,
  getTeamPayroll,
  isTeamOverTheCap,
} from "@/systems/salary-cap";
import { DEFAULT_SALARY_CAP } from "@/systems/salary-cap-config";
import { createPlayer } from "../factories/player";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../helpers/determinism";

function baseState(): GameState {
  return createInitialGameState({
    saveId: "save_cap",
    rngSeed: TEST_RNG_SEED,
    nowIso: TEST_NOW_ISO,
    settings: CBL_GAME_SETTINGS,
  });
}

function withContracts(
  state: GameState,
  contracts: Contract[],
  stalePayrollByTeamId: Record<string, number> = {},
): GameState {
  const players = { ...state.world.players };
  const contractMap: Record<string, Contract> = {};
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

  const finances = { ...state.business.finances };
  for (const [teamId, payroll] of Object.entries(stalePayrollByTeamId)) {
    const existing = finances[teamId];
    if (existing) {
      finances[teamId] = { ...existing, payroll };
    }
  }

  return {
    ...state,
    world: { ...state.world, players },
    business: {
      ...state.business,
      contracts: contractMap,
      finances,
    },
  };
}

describe("salary-cap", () => {
  it("single contract creates matching payroll", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const next = withContracts(state, [
      createContract({
        id: asContractId("c1"),
        playerId: asPlayerId("p1"),
        teamId,
        startYear: year,
        endYear: year,
        salaryByYear: { [String(year)]: 10_000_000 },
      }),
    ]);
    expect(getTeamPayroll(teamId, year, next)).toBe(10_000_000);
  });

  it("sums multiple contracts into payroll", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const next = withContracts(state, [
      createContract({
        id: asContractId("c1"),
        playerId: asPlayerId("p1"),
        teamId,
        startYear: year,
        endYear: year,
        salaryByYear: { [String(year)]: 10_000_000 },
      }),
      createContract({
        id: asContractId("c2"),
        playerId: asPlayerId("p2"),
        teamId,
        startYear: year,
        endYear: year,
        salaryByYear: { [String(year)]: 15_000_000 },
      }),
    ]);
    expect(getTeamPayroll(teamId, year, next)).toBe(25_000_000);
  });

  it("computes cap space under the cap", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const next = withContracts(state, [
      createContract({
        id: asContractId("c1"),
        playerId: asPlayerId("p1"),
        teamId,
        startYear: year,
        endYear: year,
        salaryByYear: { [String(year)]: 75_000_000 },
      }),
    ]);
    expect(getTeamCapSpace(teamId, year, next)).toBe(25_000_000);
    expect(isTeamOverTheCap(teamId, year, next)).toBe(false);
  });

  it("reports amount over the cap", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const next = withContracts(state, [
      createContract({
        id: asContractId("c1"),
        playerId: asPlayerId("p1"),
        teamId,
        startYear: year,
        endYear: year,
        salaryByYear: { [String(year)]: 110_000_000 },
      }),
    ]);
    expect(getTeamAmountOverTheCap(teamId, year, next)).toBe(10_000_000);
    expect(isTeamOverTheCap(teamId, year, next)).toBe(true);
    expect(DEFAULT_SALARY_CAP).toBe(100_000_000);
  });

  it("excludes pending team option salary from payroll", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const contract = createContract({
      id: asContractId("c1"),
      playerId: asPlayerId("p1"),
      teamId,
      startYear: 2026,
      endYear: 2026,
      salaryByYear: { "2026": 10_000_000 },
      teamOption: { year: 2027, salary: 20_000_000, status: "pending" },
    });
    const next = withContracts(state, [contract]);
    expect(getTeamPayroll(teamId, 2027, next)).toBe(0);
  });

  it("excludes pending player option salary from payroll", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const contract = createContract({
      id: asContractId("c1"),
      playerId: asPlayerId("p1"),
      teamId,
      startYear: 2026,
      endYear: 2026,
      salaryByYear: { "2026": 10_000_000 },
      playerOption: { year: 2027, salary: 18_000_000, status: "pending" },
    });
    const next = withContracts(state, [contract]);
    expect(getTeamPayroll(teamId, 2027, next)).toBe(0);
  });

  it("includes exercised option salary in payroll", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const pending = createContract({
      id: asContractId("c1"),
      playerId: asPlayerId("p1"),
      teamId,
      startYear: 2026,
      endYear: 2026,
      salaryByYear: { "2026": 10_000_000 },
      teamOption: { year: 2027, salary: 20_000_000, status: "pending" },
    });
    const next = withContracts(state, [exerciseTeamOption(pending)]);
    expect(getTeamPayroll(teamId, 2027, next)).toBe(20_000_000);
  });

  it("keeps declined option salary excluded from payroll", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const pending = createContract({
      id: asContractId("c1"),
      playerId: asPlayerId("p1"),
      teamId,
      startYear: 2026,
      endYear: 2026,
      salaryByYear: { "2026": 10_000_000 },
      teamOption: { year: 2027, salary: 20_000_000, status: "pending" },
    });
    const next = withContracts(state, [declineTeamOption(pending)]);
    expect(getTeamPayroll(teamId, 2027, next)).toBe(0);
  });

  it("does not read TeamFinances.payroll snapshot", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const next = withContracts(
      state,
      [
        createContract({
          id: asContractId("c1"),
          playerId: asPlayerId("p1"),
          teamId,
          startYear: year,
          endYear: year,
          salaryByYear: { [String(year)]: 10_000_000 },
        }),
      ],
      { [teamId]: 999_000_000 },
    );
    expect(next.business.finances[teamId]!.payroll).toBe(999_000_000);
    expect(getTeamPayroll(teamId, year, next)).toBe(10_000_000);
    expect(getTeamCapSpace(teamId, year, next)).toBe(90_000_000);
  });

  it("includes exercised player option salary in payroll", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const pending = createContract({
      id: asContractId("c1"),
      playerId: asPlayerId("p1"),
      teamId,
      startYear: 2026,
      endYear: 2026,
      salaryByYear: { "2026": 8_000_000 },
      playerOption: { year: 2027, salary: 12_000_000, status: "pending" },
    });
    const next = withContracts(state, [exercisePlayerOption(pending)]);
    expect(getTeamPayroll(teamId, 2027, next)).toBe(12_000_000);
  });
});
