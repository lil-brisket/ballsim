import { describe, expect, it } from "vitest";
import type { Contract } from "@/domain/entities/contract";
import type { DeadMoneyEntry } from "@/domain/entities/dead-money";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import { toCapSheetView } from "@/state/cap-sheet-selectors";
import { toFinanceHubView } from "@/state/finance-hub-selectors";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { luxuryTaxThreshold, salaryFloor } from "@/systems/payroll-rules";
import { getContractSigningYear, getTeamPayroll } from "@/systems/salary-cap";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

const base = bootstrapWorld(
  createTestGameState({ saveId: "cap_sheet" }),
  createSeededRng("cap-sheet"),
).state;
const teamId = base.user.activeOwnerTeamId as string;
const FIRST = getContractSigningYear(base);

function contractsOf(state: GameState): Contract[] {
  return Object.values(state.business.contracts).filter(
    (c) => c.teamId === teamId,
  );
}

function withContract(state: GameState, contract: Contract): GameState {
  return {
    ...state,
    business: {
      ...state.business,
      contracts: { ...state.business.contracts, [contract.id]: contract },
    },
  };
}

function withDead(state: GameState, entries: DeadMoneyEntry[]): GameState {
  return {
    ...state,
    business: {
      ...state.business,
      deadMoney: {
        ...state.business.deadMoney,
        [teamId]: [...(state.business.deadMoney?.[teamId] ?? []), ...entries],
      },
    },
  };
}

function withRules(
  state: GameState,
  rules: Partial<GameState["settings"]["financialRules"]>,
): GameState {
  return {
    ...state,
    settings: {
      ...state.settings,
      financialRules: { ...state.settings.financialRules, ...rules },
    },
  };
}

function withPhase(
  state: GameState,
  phase: GameState["competition"]["season"]["phase"],
): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      season: { ...state.competition.season, phase },
    },
  };
}

/** A fresh contract for an existing roster player of the team. */
function templateContract(state: GameState): Contract {
  return contractsOf(state).find(
    (c) => c.salaryByYear[String(FIRST)] !== undefined,
  )!;
}

function dead(
  state: GameState,
  seasonYear: number,
  amount: number,
  reason: DeadMoneyEntry["reason"],
): DeadMoneyEntry {
  const playerId = templateContract(state).playerId;
  return {
    playerId,
    teamId: teamId as DeadMoneyEntry["teamId"],
    seasonYear,
    amount,
    reason,
    prepaid: reason === "buyout_paid",
    createdOn: "2026-10-01",
  };
}

/** Sum of counted cells for a season. */
function countedSum(
  view: ReturnType<typeof toCapSheetView>,
  index: number,
): number {
  let sum = 0;
  for (const row of view.rows) {
    if (row.kind === "development_league") continue;
    const cell = row.cells[index]!;
    if (cell.kind === "salary" || cell.kind === "dead") sum += cell.amount;
  }
  return sum;
}

describe("toCapSheetView", () => {
  it("starts at the signing year and shows five seasons", () => {
    const view = toCapSheetView(base);
    expect(view.teamId).toBe(teamId);
    expect(view.seasons).toEqual([
      FIRST,
      FIRST + 1,
      FIRST + 2,
      FIRST + 3,
      FIRST + 4,
    ]);
    expect(view.payroll).toBe(getTeamPayroll(teamId as never, FIRST, base));
  });

  it("starts next season in the offseason and this season otherwise", () => {
    const year = base.competition.season.year;
    expect(toCapSheetView(withPhase(base, "offseason")).seasons[0]).toBe(
      year + 1,
    );
    expect(toCapSheetView(withPhase(base, "regular")).seasons[0]).toBe(year);
  });

  it("totals match getTeamPayroll and counted cells sum to them", () => {
    const state = withDead(base, [
      dead(base, FIRST, 1_000_000, "waived"),
      dead(base, FIRST + 1, 2_000_000, "bought_out"),
    ]);
    const view = toCapSheetView(state);
    view.totals.forEach((total, index) => {
      expect(total.season).toBe(view.seasons[index]);
      expect(total.payroll).toBe(
        getTeamPayroll(teamId as never, total.season, state),
      );
      expect(countedSum(view, index)).toBe(total.payroll);
    });
  });

  it("shows dead money rows per reason and counts them", () => {
    const state = withDead(base, [
      dead(base, FIRST, 1_000_000, "waived"),
      dead(base, FIRST + 1, 500_000, "waived"),
      dead(base, FIRST, 700_000, "buyout_paid"),
    ]);
    const view = toCapSheetView(state);
    const rows = view.rows.filter((r) => r.kind === "dead_money");
    expect(rows.map((r) => r.note)).toEqual(["Waived", "Buyout (prepaid)"]);
    expect(rows[0]!.cells[0]).toEqual({ kind: "dead", amount: 1_000_000 });
    expect(rows[0]!.cells[1]).toEqual({ kind: "dead", amount: 500_000 });
    expect(rows[0]!.cells[2]).toEqual({ kind: "empty" });
    const without = toCapSheetView(base);
    expect(view.totals[0]!.payroll - without.totals[0]!.payroll).toBe(
      1_700_000,
    );
  });

  it("shows a pending team or player option without counting it", () => {
    for (const which of ["teamOption", "playerOption"] as const) {
      const t = templateContract(base);
      const contract: Contract = {
        ...t,
        id: `opt_${which}` as never,
        startYear: FIRST,
        endYear: FIRST + 1,
        salaryByYear: { [FIRST]: 5_000_000, [FIRST + 1]: 5_000_000 },
        teamOption: undefined,
        playerOption: undefined,
        [which]: { year: FIRST + 2, salary: 6_000_000, status: "pending" },
      };
      const state = withContract(base, contract);
      const view = toCapSheetView(state);
      const row = view.rows.find((r) => r.key === `contract:opt_${which}`)!;
      expect(row.cells[2]).toEqual({
        kind: "option",
        option: which === "teamOption" ? "team" : "player",
        amount: 6_000_000,
      });
      expect(view.totals[2]!.payroll).toBe(
        getTeamPayroll(teamId as never, FIRST + 2, state),
      );
      expect(countedSum(view, 2)).toBe(view.totals[2]!.payroll);
    }
  });

  it("counts an exercised option as salary and hides a declined one", () => {
    const t = templateContract(base);
    const exercised: Contract = {
      ...t,
      id: "opt_ex" as never,
      startYear: FIRST,
      endYear: FIRST + 2,
      salaryByYear: {
        [FIRST]: 5_000_000,
        [FIRST + 1]: 5_000_000,
        [FIRST + 2]: 6_000_000,
      },
      teamOption: { year: FIRST + 2, salary: 6_000_000, status: "exercised" },
      playerOption: undefined,
    };
    const declined: Contract = {
      ...t,
      id: "opt_dec" as never,
      startYear: FIRST,
      endYear: FIRST,
      salaryByYear: { [FIRST]: 5_000_000 },
      teamOption: { year: FIRST + 1, salary: 9_000_000, status: "declined" },
      playerOption: undefined,
    };
    const state = withContract(withContract(base, exercised), declined);
    const view = toCapSheetView(state);
    const ex = view.rows.find((r) => r.key === "contract:opt_ex")!;
    expect(ex.cells[2]).toEqual({ kind: "salary", amount: 6_000_000 });
    const dec = view.rows.find((r) => r.key === "contract:opt_dec")!;
    expect(dec.cells[1]).toEqual({ kind: "empty" });
    expect(countedSum(view, 2)).toBe(view.totals[2]!.payroll);
  });

  it("shows development league players apart and excludes them", () => {
    const t = templateContract(base);
    const player = base.world.players[t.playerId]!;
    const state: GameState = {
      ...base,
      world: {
        ...base.world,
        players: {
          ...base.world.players,
          [t.playerId]: {
            ...player,
            developmentLeague: {
              ...player.developmentLeague,
              status: "assigned",
            },
          },
        },
      },
    };
    const view = toCapSheetView(state);
    const row = view.rows.find((r) => r.key === `contract:${t.id}`)!;
    expect(row.kind).toBe("development_league");
    expect(row.note).toBe("Development league");
    view.totals.forEach((total, index) => {
      expect(countedSum(view, index)).toBe(total.payroll);
      expect(total.payroll).toBe(
        getTeamPayroll(teamId as never, total.season, state),
      );
    });
    const kinds = view.rows.map((r) => r.kind);
    expect(kinds.lastIndexOf("player")).toBeLessThan(
      kinds.indexOf("development_league"),
    );
  });

  it("builds lines from the rules and hides those that are off", () => {
    const cap = getLeagueSalaryCap(base);
    const view = toCapSheetView(
      withRules(base, {
        salaryCapEnabled: true,
        luxuryTaxEnabled: true,
        salaryFloorEnabled: true,
      }),
    );
    expect(view.lines.map((l) => l.key)).toEqual(["floor", "cap", "tax"]);
    const by = Object.fromEntries(view.lines.map((l) => [l.key, l]));
    expect(by.floor!.amount).toBe(salaryFloor(base.settings, cap));
    expect(by.cap!.amount).toBe(cap);
    expect(by.tax!.amount).toBe(luxuryTaxThreshold(base.settings, cap));
    for (const line of view.lines) {
      expect(line.delta).toBe(view.payroll - line.amount);
    }

    const noTax = toCapSheetView(withRules(base, { luxuryTaxEnabled: false }));
    expect(noTax.lines.map((l) => l.key)).not.toContain("tax");
    const noFloor = toCapSheetView(
      withRules(base, { salaryFloorEnabled: false }),
    );
    expect(noFloor.lines.map((l) => l.key)).not.toContain("floor");
    const noCap = toCapSheetView(withRules(base, { salaryCapEnabled: false }));
    expect(noCap.lines.map((l) => l.key)).not.toContain("cap");
    expect(noCap.totals.every((t) => t.cap === null && t.room === null)).toBe(
      true,
    );
  });

  it("reports cap and room on totals when the cap is on", () => {
    const view = withRules(base, { salaryCapEnabled: true });
    const cap = getLeagueSalaryCap(view);
    for (const total of toCapSheetView(view).totals) {
      expect(total.cap).toBe(cap);
      expect(total.room).toBe(cap - total.payroll);
    }
  });

  it("sorts players by first-season salary then name, dead money last", () => {
    const state = withDead(base, [
      dead(base, FIRST, 100, "waived"),
      dead(base, FIRST, 900, "bought_out"),
    ]);
    const rows = toCapSheetView(state).rows;
    const players = rows.filter((r) => r.kind === "player");
    const amounts = players.map((r) =>
      r.cells[0]!.kind === "salary" ? r.cells[0]!.amount : 0,
    );
    for (let i = 1; i < amounts.length; i += 1) {
      expect(amounts[i - 1]).toBeGreaterThanOrEqual(amounts[i]!);
      if (amounts[i - 1] === amounts[i]) {
        expect(
          players[i - 1]!.name.localeCompare(players[i]!.name),
        ).toBeLessThanOrEqual(0);
      }
    }
    const tail = rows.slice(-2);
    expect(tail.map((r) => r.kind)).toEqual(["dead_money", "dead_money"]);
    expect(tail.map((r) => r.note)).toEqual(["Bought out", "Waived"]);
  });

  it("is pure and attached to the finance hub view", () => {
    const before = structuredClone(base);
    const a = toCapSheetView(base);
    const b = toCapSheetView(base);
    expect(a).toEqual(b);
    expect(base).toEqual(before);
    expect(toFinanceHubView(base).capSheet).toEqual(a);
  });
});
