import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createEmptyTeamFinanceBooks } from "@/domain/entities/finances";
import type { PlayerId, TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import {
  AI_PAYROLL_CASH_RESERVE,
  AI_PAYROLL_REVENUE_MARGIN,
} from "@/systems/ai-payroll-budget";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  playerExtensionAsk,
  processCpuContractExtensions,
} from "@/systems/contract-extensions";
import { getContractSigningYear, getTeamPayroll } from "@/systems/salary-cap";
import { transitionPhase } from "@/systems/simulation/phase-machine";

function bootstrapped(saveId: string): GameState {
  const initial = createInitialGameState({
    saveId,
    rngSeed: 21,
    settings: CBL_GAME_SETTINGS,
  });
  return bootstrapWorld(initial, createSeededRng(initial.meta.rngState)).state;
}

/**
 * Makes the team's first contracted player a star (all ratings 95) on a
 * near-minimum deal with `seasonsLeft` seasons from the signing year.
 */
function withStar(
  base: GameState,
  teamId: TeamId,
  seasonsLeft: number,
): { state: GameState; starId: PlayerId; contractId: string } {
  const team = base.world.teams[teamId]!;
  const starId = team.roster.find(
    (id) => base.world.players[id]?.contractId != null,
  )!;
  const star = base.world.players[starId]!;
  const contractId = star.contractId!;
  const contract = base.business.contracts[contractId]!;
  const year = getContractSigningYear(base);
  const endYear = year + seasonsLeft - 1;
  const attributes = Object.fromEntries(
    Object.keys(star.attributes).map((key) => [key, 95]),
  ) as typeof star.attributes;
  const salaryByYear: Record<string, number> = {};
  for (let y = year - 1; y <= endYear; y += 1) {
    salaryByYear[String(y)] = 100_000;
  }

  const state: GameState = {
    ...base,
    world: {
      ...base.world,
      players: { ...base.world.players, [starId]: { ...star, attributes } },
    },
    business: {
      ...base.business,
      contracts: {
        ...base.business.contracts,
        [contractId]: {
          ...contract,
          startYear: year - 1,
          endYear,
          salaryByYear,
        },
      },
    },
  };
  return { state, starId, contractId };
}

/** Owner team with a star in the last season of his deal. */
function ownerWithUnderpaidStar(
  contractsMode: "off" | "full",
  seasonsLeft = 1,
): { state: GameState; starId: PlayerId; contractId: string } {
  const base = bootstrapped("extensions");
  const ownerTeamId = base.user.activeOwnerTeamId;
  const { state, starId, contractId } = withStar(
    base,
    ownerTeamId,
    seasonsLeft,
  );
  return {
    state: {
      ...state,
      user: {
        ...state.user,
        ownedFranchises: {
          ...state.user.ownedFranchises,
          [ownerTeamId]: {
            ...state.user.ownedFranchises[ownerTeamId]!,
            managementPreset: "custom",
            aiAssistance: {
              ...state.user.ownedFranchises[ownerTeamId]!.aiAssistance,
              contracts: contractsMode,
            },
          },
        },
      },
    },
    starId,
    contractId,
  };
}

/**
 * Offseason CPU team whose last season had `revenue` and no costs, with
 * `cash` on hand, and a star with one season left.
 */
function cpuWithStar(input: { revenue: number; cash: number }): {
  state: GameState;
  teamId: TeamId;
  starId: PlayerId;
  contractId: string;
} {
  let base = bootstrapped("cpu_extensions");
  base = transitionPhase(base, "regular").state;
  base = transitionPhase(base, "postseason").state;
  base = transitionPhase(base, "offseason").state;
  const teamId = (Object.keys(base.world.teams) as TeamId[])
    .filter((id) => id !== base.user.activeOwnerTeamId)
    .sort()[0]!;
  const { state, starId, contractId } = withStar(base, teamId, 1);
  const finances = state.business.finances[teamId]!;
  const books = createEmptyTeamFinanceBooks();
  books.revenue.tickets = input.revenue;
  return {
    state: {
      ...state,
      business: {
        ...state.business,
        finances: {
          ...state.business.finances,
          [teamId]: {
            ...finances,
            businessFunds: input.cash,
            booksByYear: {
              ...finances.booksByYear,
              [String(state.competition.season.year)]: books,
            },
          },
        },
      },
    },
    teamId,
    starId,
    contractId,
  };
}

function extensionFor(
  events: ReturnType<typeof processCpuContractExtensions>["events"],
  playerId: string,
) {
  return events.find(
    (event) =>
      event.type === "ContractSigned" &&
      event.payload.playerId === playerId &&
      event.payload.reason === "extension",
  );
}

describe("processCpuContractExtensions", () => {
  it("leaves an owner's star alone when contracts are not delegated", () => {
    const { state, starId, contractId } = ownerWithUnderpaidStar("off");
    const result = processCpuContractExtensions(state);
    expect(extensionFor(result.events, starId)).toBeUndefined();
    expect(result.state.business.contracts[contractId]).toEqual(
      state.business.contracts[contractId],
    );
  });

  it("extends an owner's underpaid star when contracts are fully delegated", () => {
    const { state, starId } = ownerWithUnderpaidStar("full");
    const result = processCpuContractExtensions(state);
    expect(extensionFor(result.events, starId)).toBeDefined();
  });

  it("adds his asked seasons and leaves the signed ones alone", () => {
    const { state, starId, contractId } = ownerWithUnderpaidStar("full");
    const before = state.business.contracts[contractId]!;
    const ask = playerExtensionAsk(state, starId, state.user.activeOwnerTeamId);
    const after =
      processCpuContractExtensions(state).state.business.contracts[contractId]!;
    expect(after.endYear).toBe(before.endYear + ask.minYears);
    for (const [year, salary] of Object.entries(before.salaryByYear)) {
      expect(after.salaryByYear[year]).toBe(salary);
    }
    for (let y = before.endYear + 1; y <= after.endYear; y += 1) {
      expect(after.salaryByYear[String(y)]).toBe(ask.salary);
    }
  });

  it("waits while a star has two seasons left", () => {
    const { state, starId, contractId } = ownerWithUnderpaidStar("full", 2);
    const result = processCpuContractExtensions(state);
    expect(extensionFor(result.events, starId)).toBeUndefined();
    expect(result.state.business.contracts[contractId]).toEqual(
      state.business.contracts[contractId],
    );
  });

  it("extends a CPU star when recurring revenue covers the added season", () => {
    const { state, starId } = cpuWithStar({ revenue: 300_000_000, cash: 0 });
    const result = processCpuContractExtensions(state);
    expect(extensionFor(result.events, starId)).toBeDefined();
  });

  it("projects added seasons at no less than last season's payroll", () => {
    const probe = cpuWithStar({ revenue: 0, cash: 0 });
    const lastYear = probe.state.competition.season.year;
    const added = getContractSigningYear(probe.state) + 1;
    const ask = playerExtensionAsk(probe.state, probe.starId, probe.teamId);
    // Last season's payroll with his ask in place of his old salary.
    const projected =
      getTeamPayroll(probe.teamId, lastYear, probe.state) -
      100_000 +
      ask.salary;
    // Few deals are signed that far ahead, so the bare payroll would fit.
    expect(
      getTeamPayroll(probe.teamId, added, probe.state) + ask.salary,
    ).toBeLessThan(projected - 1_000_000);
    const budgetOf = (revenue: number) =>
      cpuWithStar({ revenue, cash: AI_PAYROLL_CASH_RESERVE });

    const short = budgetOf(projected / AI_PAYROLL_REVENUE_MARGIN - 1_000_000);
    const refused = processCpuContractExtensions(short.state);
    expect(extensionFor(refused.events, short.starId)).toBeUndefined();
    expect(refused.state.business.contracts[short.contractId]).toEqual(
      short.state.business.contracts[short.contractId],
    );

    const enough = budgetOf(projected / AI_PAYROLL_REVENUE_MARGIN + 1_000_000);
    const extended = processCpuContractExtensions(enough.state);
    expect(extensionFor(extended.events, enough.starId)).toBeDefined();
  });
});
