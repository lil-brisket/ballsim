import { describe, expect, it } from "vitest";
import { createContract } from "@/domain/entities/contract";
import { asContractId, asPlayerId } from "@/domain/ids";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { DEFAULT_SALARY_CAP } from "@/systems/salary-cap-config";
import { getTeamPayroll } from "@/systems/salary-cap";
import {
  executeTrade,
  validateTrade,
} from "@/systems/trades";
import { applyTradeSalaryRule } from "@/systems/trades/trade-salary-rules";
import {
  createTradeFixture,
  pickForTeam,
  playerForPlayerProposal,
  playerOnTeam,
  teamIds,
} from "./fixture";

describe("trade validation — valid trades", () => {
  it("accepts player for player", () => {
    const state = createTradeFixture();
    const proposal = playerForPlayerProposal(state);
    expect(validateTrade(state, proposal).valid).toBe(true);
  });

  it("accepts player for pick", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [playerOnTeam(state, teamA, 0)],
        draftPickIds: [],
      },
      sideB: {
        teamId: teamB,
        playerIds: [],
        draftPickIds: [pickForTeam(state, teamB, 1, 1)],
      },
    };
    expect(validateTrade(state, proposal).valid).toBe(true);
  });

  it("accepts pick for pick", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [],
        draftPickIds: [pickForTeam(state, teamA, 1, 1)],
      },
      sideB: {
        teamId: teamB,
        playerIds: [],
        draftPickIds: [pickForTeam(state, teamB, 1, 2)],
      },
    };
    expect(validateTrade(state, proposal).valid).toBe(true);
  });

  it("accepts player + pick for player", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [playerOnTeam(state, teamA, 0)],
        draftPickIds: [pickForTeam(state, teamA, 1, 1)],
      },
      sideB: {
        teamId: teamB,
        playerIds: [playerOnTeam(state, teamB, 0)],
        draftPickIds: [],
      },
    };
    expect(validateTrade(state, proposal).valid).toBe(true);
  });

  it("accepts multi-player trade", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [
          playerOnTeam(state, teamA, 0),
          playerOnTeam(state, teamA, 1),
        ],
        draftPickIds: [],
      },
      sideB: {
        teamId: teamB,
        playerIds: [
          playerOnTeam(state, teamB, 0),
          playerOnTeam(state, teamB, 1),
        ],
        draftPickIds: [],
      },
    };
    expect(validateTrade(state, proposal).valid).toBe(true);
  });

  it("accepts multi-asset trade", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [playerOnTeam(state, teamA, 0)],
        draftPickIds: [
          pickForTeam(state, teamA, 1, 1),
          pickForTeam(state, teamA, 2, 2),
        ],
      },
      sideB: {
        teamId: teamB,
        playerIds: [
          playerOnTeam(state, teamB, 0),
          playerOnTeam(state, teamB, 1),
        ],
        draftPickIds: [pickForTeam(state, teamB, 1, 1)],
      },
    };
    expect(validateTrade(state, proposal).valid).toBe(true);
  });
});

describe("trade validation — invalid trades", () => {
  it("rejects player not owned by offering team", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [playerOnTeam(state, teamB, 0)],
        draftPickIds: [],
      },
      sideB: {
        teamId: teamB,
        playerIds: [playerOnTeam(state, teamB, 1)],
        draftPickIds: [],
      },
    };
    const result = validateTrade(state, proposal);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "PLAYER_NOT_OWNED")).toBe(true);
  });

  it("rejects pick not owned by offering team", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [],
        draftPickIds: [pickForTeam(state, teamB, 1, 1)],
      },
      sideB: {
        teamId: teamB,
        playerIds: [],
        draftPickIds: [pickForTeam(state, teamB, 1, 2)],
      },
    };
    const result = validateTrade(state, proposal);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "PICK_NOT_OWNED")).toBe(true);
  });

  it("rejects duplicate player on one side", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const player = playerOnTeam(state, teamA, 0);
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [player, player],
        draftPickIds: [],
      },
      sideB: {
        teamId: teamB,
        playerIds: [playerOnTeam(state, teamB, 0)],
        draftPickIds: [],
      },
    };
    const result = validateTrade(state, proposal);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "DUPLICATE_PLAYER")).toBe(true);
  });

  it("rejects same player on both sides", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const player = playerOnTeam(state, teamA, 0);
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [player],
        draftPickIds: [],
      },
      sideB: {
        teamId: teamB,
        playerIds: [player],
        draftPickIds: [],
      },
    };
    const result = validateTrade(state, proposal);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "DUPLICATE_PLAYER")).toBe(true);
  });

  it("rejects same pick on both sides", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const pick = pickForTeam(state, teamA, 1, 1);
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [],
        draftPickIds: [pick],
      },
      sideB: {
        teamId: teamB,
        playerIds: [],
        draftPickIds: [pick],
      },
    };
    const result = validateTrade(state, proposal);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "DUPLICATE_PICK")).toBe(true);
  });

  it("rejects same team", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [playerOnTeam(state, teamA, 0)],
        draftPickIds: [],
      },
      sideB: {
        teamId: teamA,
        playerIds: [playerOnTeam(state, teamA, 1)],
        draftPickIds: [],
      },
    };
    const result = validateTrade(state, proposal);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "SAME_TEAM")).toBe(true);
  });

  it("rejects empty side", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [playerOnTeam(state, teamA, 0)],
        draftPickIds: [],
      },
      sideB: {
        teamId: teamB,
        playerIds: [],
        draftPickIds: [],
      },
    };
    const result = validateTrade(state, proposal);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "EMPTY_SIDE")).toBe(true);
  });

  it("rejects nonexistent player", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [asPlayerId("player_missing")],
        draftPickIds: [],
      },
      sideB: {
        teamId: teamB,
        playerIds: [playerOnTeam(state, teamB, 0)],
        draftPickIds: [],
      },
    };
    const result = validateTrade(state, proposal);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "PLAYER_NOT_FOUND")).toBe(true);
  });

  it("rejects invalid roster size", () => {
    const state = createTradeFixture({ rosterSize: 8 });
    const { teamA, teamB } = teamIds(state);
    // Team A sends 0 players, receives 2 → size 10 OK for A
    // Team B sends 2, receives 0 → size 6 < min 8
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [],
        draftPickIds: [pickForTeam(state, teamA, 1, 1)],
      },
      sideB: {
        teamId: teamB,
        playerIds: [
          playerOnTeam(state, teamB, 0),
          playerOnTeam(state, teamB, 1),
        ],
        draftPickIds: [],
      },
    };
    const result = validateTrade(state, proposal);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "ROSTER_SIZE")).toBe(true);
  });

  it("picks do not affect roster size", () => {
    const state = createTradeFixture({ rosterSize: 10 });
    const { teamA, teamB } = teamIds(state);
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [],
        draftPickIds: [
          pickForTeam(state, teamA, 1, 1),
          pickForTeam(state, teamA, 1, 2),
          pickForTeam(state, teamA, 2, 1),
        ],
      },
      sideB: {
        teamId: teamB,
        playerIds: [],
        draftPickIds: [
          pickForTeam(state, teamB, 1, 1),
          pickForTeam(state, teamB, 1, 2),
          pickForTeam(state, teamB, 2, 1),
        ],
      },
    };
    expect(validateTrade(state, proposal).valid).toBe(true);
  });

  it("rejects player without active contract", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const playerId = playerOnTeam(state, teamA, 0);
    const player = state.world.players[playerId]!;
    const broken = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [playerId]: { ...player, contractId: null },
        },
      },
    };
    const proposal = playerForPlayerProposal(broken);
    const result = validateTrade(broken, proposal);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) =>
          e.code === "CONTRACT_MISSING" || e.code === "PLAYER_INELIGIBLE",
      ),
    ).toBe(true);
  });
});

describe("trade salary rules", () => {
  it("allows imbalance under the cap", () => {
    const result = applyTradeSalaryRule({
      currentPayroll: 40_000_000,
      outgoingSalary: 5_000_000,
      incomingSalary: 20_000_000,
      salaryCap: DEFAULT_SALARY_CAP,
    });
    expect(result.valid).toBe(true);
    expect(result.projectedPayroll).toBe(55_000_000);
  });

  it("passes when outgoing and incoming are both zero", () => {
    const result = applyTradeSalaryRule({
      currentPayroll: DEFAULT_SALARY_CAP + 1,
      outgoingSalary: 0,
      incomingSalary: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("fails zero outgoing with positive incoming while over cap", () => {
    const result = applyTradeSalaryRule({
      currentPayroll: DEFAULT_SALARY_CAP + 1,
      outgoingSalary: 0,
      incomingSalary: 10_000_000,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects over-cap matching violation via validateTrade", () => {
    // Put team A over the cap with high salaries; receive more than 125% of outgoing.
    const state = createTradeFixture({
      rosterSize: 10,
      salary: 11_000_000, // payroll 110M > 100M cap
    });
    const { teamA, teamB } = teamIds(state);
    // Override one B player to have much higher salary
    const expensiveId = playerOnTeam(state, teamB, 0);
    const expensive = state.world.players[expensiveId]!;
    const year = state.competition.season.year;
    const highContract = createContract({
      id: asContractId("contract_expensive"),
      playerId: expensiveId,
      teamId: teamB,
      startYear: year,
      endYear: year,
      salaryByYear: { [String(year)]: 20_000_000 },
    });
    const next = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [expensiveId]: {
            ...expensive,
            contractId: highContract.id,
          },
        },
      },
      business: {
        ...state.business,
        contracts: {
          ...state.business.contracts,
          [highContract.id]: highContract,
        },
      },
    };
    // Remove old contract reference if different
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [playerOnTeam(next, teamA, 0)], // 11M out
        draftPickIds: [],
      },
      sideB: {
        teamId: teamB,
        playerIds: [expensiveId], // 20M in > 11M * 1.25
        draftPickIds: [],
      },
    };
    const result = validateTrade(next, proposal);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "SALARY_VIOLATION")).toBe(true);
  });
});

describe("trade execution", () => {
  it("updates player teamId, rosters, contracts, and picks atomically", () => {
    resetDomainEventSequenceForTests();
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const playerA = playerOnTeam(state, teamA, 0);
    const playerB = playerOnTeam(state, teamB, 0);
    const pickA = pickForTeam(state, teamA, 1, 1);
    const originalTeamId = state.world.draftPicks[pickA]!.originalTeamId;

    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [playerA],
        draftPickIds: [pickA],
      },
      sideB: {
        teamId: teamB,
        playerIds: [playerB],
        draftPickIds: [],
      },
    };

    const result = executeTrade(state, proposal);
    expect(result.success).toBe(true);
    expect(result.state).not.toBe(state);

    const next = result.state;
    expect(next.world.players[playerA]!.teamId).toBe(teamB);
    expect(next.world.players[playerB]!.teamId).toBe(teamA);
    expect(next.world.teams[teamA]!.roster).toContain(playerB);
    expect(next.world.teams[teamA]!.roster).not.toContain(playerA);
    expect(next.world.teams[teamB]!.roster).toContain(playerA);
    expect(next.world.teams[teamB]!.roster).not.toContain(playerB);

    const contractA =
      next.business.contracts[next.world.players[playerA]!.contractId!];
    expect(contractA!.teamId).toBe(teamB);
    expect(contractA!.playerId).toBe(playerA);
    expect(next.world.players[playerA]!.teamId).toBe(contractA!.teamId);

    expect(next.world.draftPicks[pickA]!.ownerTeamId).toBe(teamB);
    expect(next.world.draftPicks[pickA]!.originalTeamId).toBe(originalTeamId);

    expect(result.events.filter((e) => e.type === "PlayerTraded")).toHaveLength(
      2,
    );
  });

  it("refreshes payroll from post-trade contracts", () => {
    const state = createTradeFixture({ salary: 5_000_000 });
    const { teamA, teamB } = teamIds(state);
    const year = state.competition.season.year;
    const proposal = playerForPlayerProposal(state);
    const result = executeTrade(state, proposal);
    expect(result.success).toBe(true);
    expect(result.state.business.finances[teamA]!.payroll).toBe(
      getTeamPayroll(teamA, year, result.state),
    );
    expect(result.state.business.finances[teamB]!.payroll).toBe(
      getTeamPayroll(teamB, year, result.state),
    );
  });

  it("does not mutate state when validation fails", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [playerOnTeam(state, teamA, 0)],
        draftPickIds: [],
      },
      sideB: {
        teamId: teamA,
        playerIds: [playerOnTeam(state, teamA, 1)],
        draftPickIds: [],
      },
    };
    const result = executeTrade(state, proposal);
    expect(result.success).toBe(false);
    expect(result.state).toBe(state);
    expect(result.events).toHaveLength(0);
  });

  it("does not mutate nested original player objects", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const playerA = playerOnTeam(state, teamA, 0);
    const before = state.world.players[playerA]!;
    const result = executeTrade(state, playerForPlayerProposal(state));
    expect(result.success).toBe(true);
    expect(before.teamId).toBe(teamA);
    expect(result.state.world.players[playerA]!.teamId).toBe(teamB);
  });
});
