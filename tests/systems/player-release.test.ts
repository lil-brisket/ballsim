import { describe, expect, it } from "vitest";
import { addCalendarDays } from "@/domain/calendar-date";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { getContractSalaryForYear } from "@/domain/entities/contract";
import type { PlayerId, TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { validateGameState } from "@/persistence/validate-game-state";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";
import { processWeeklyPlayerPayroll } from "@/systems/player-payroll";
import {
  AI_WAIVE_MAX_DEAD_MONEY_CAP_SHARE,
  findCpuWaiverCandidate,
  getPlayerReleaseBlockReason,
  previewPlayerRelease,
  releasePlayerUnderContract,
} from "@/systems/player-release";
import {
  getTeamCapSpace,
  getTeamContractualSalaryObligation,
  getTeamPayroll,
  getTeamPrepaidDeadMoney,
} from "@/systems/salary-cap";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { bootstrapWorld } from "@/systems/world-pipeline";

function regularSeasonLeague(seed = 11): GameState {
  let state = createInitialGameState({
    saveId: `release_${seed}`,
    rngSeed: seed,
    settings: CBL_GAME_SETTINGS,
  });
  state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
  return beginRegularSeasonFromPreseason(state).state;
}

/** A rostered player with salary this season and at least one more year. */
function multiYearPlayer(state: GameState, teamId: TeamId): PlayerId {
  const year = state.competition.season.year;
  const team = state.world.teams[teamId]!;
  for (const id of team.roster) {
    const player = state.world.players[id]!;
    const contract = player.contractId
      ? state.business.contracts[player.contractId]
      : undefined;
    if (contract && contract.endYear > year) return id;
  }
  throw new Error("No multi-year contract on the roster.");
}

function firstTeam(state: GameState): TeamId {
  return Object.keys(state.world.teams).sort()[0]! as TeamId;
}

describe("releasePlayerUnderContract — waive", () => {
  it("turns the remaining salary into dead money on the original schedule", () => {
    const state = regularSeasonLeague();
    const teamId = firstTeam(state);
    const playerId = multiYearPlayer(state, teamId);
    const contract =
      state.business.contracts[state.world.players[playerId]!.contractId!]!;
    const year = state.competition.season.year;

    const result = releasePlayerUnderContract(state, {
      playerId,
      teamId,
      mode: "waive",
    });
    const next = result.state;
    const entries = next.business.deadMoney[teamId]!;

    for (let y = year; y <= contract.endYear; y += 1) {
      const salary = getContractSalaryForYear(contract, y)!;
      const entry = entries.find((e) => e.seasonYear === y)!;
      expect(entry.amount).toBe(salary);
      expect(entry.reason).toBe("waived");
      expect(entry.prepaid).toBe(false);
      // Cap and books still carry the salary, as dead money.
      expect(getTeamPayroll(teamId, y, next)).toBe(
        getTeamPayroll(teamId, y, state),
      );
      expect(getTeamContractualSalaryObligation(teamId, y, next)).toBe(
        getTeamContractualSalaryObligation(teamId, y, state),
      );
    }
    expect(next.business.contracts[contract.id]).toBeUndefined();
    expect(next.world.players[playerId]!.teamId).toBeNull();
    expect(next.world.players[playerId]!.contractId).toBeNull();
    expect(next.world.teams[teamId]!.roster).not.toContain(playerId);
    expect(result.events.map((e) => e.type)).toContain("PlayerWaived");
    expect(result.events.map((e) => e.type)).not.toContain("PlayerReleased");
    expect(() => validateGameState(next)).not.toThrow();
  });

  it("keeps paying the dead money in cash through weekly payroll", () => {
    const state = regularSeasonLeague();
    const teamId = firstTeam(state);
    const playerId = multiYearPlayer(state, teamId);
    const released = releasePlayerUnderContract(state, {
      playerId,
      teamId,
      mode: "waive",
    }).state;
    const weekEnd = addCalendarDays(state.world.calendar.currentDate, 6);
    const cash = (s: GameState) => s.business.finances[teamId]!.businessFunds;
    const paidBefore =
      cash(state) - cash(processWeeklyPlayerPayroll(state, weekEnd).state);
    const paidAfter =
      cash(released) -
      cash(processWeeklyPlayerPayroll(released, weekEnd).state);
    expect(paidAfter).toBe(paidBefore);
  });

  it("is deterministic", () => {
    const run = () => {
      const state = regularSeasonLeague(23);
      const teamId = firstTeam(state);
      const playerId = multiYearPlayer(state, teamId);
      const next = releasePlayerUnderContract(state, {
        playerId,
        teamId,
        mode: "waive",
      }).state;
      return JSON.stringify({
        deadMoney: next.business.deadMoney,
        rosters: Object.values(next.world.teams).map((t) => t.roster),
        cash: next.business.finances[teamId]!.businessFunds,
      });
    };
    expect(run()).toBe(run());
  });
});

describe("releasePlayerUnderContract — buyout", () => {
  it("pays a lump now and spreads a prepaid cap hit over the remaining seasons", () => {
    const state = regularSeasonLeague();
    const teamId = firstTeam(state);
    const playerId = multiYearPlayer(state, teamId);
    const contract =
      state.business.contracts[state.world.players[playerId]!.contractId!]!;
    const year = state.competition.season.year;
    const preview = previewPlayerRelease(state, {
      playerId,
      teamId,
      mode: "buyout",
    });
    expect(preview.buyoutRate).not.toBeNull();
    expect(preview.cashNow).toBe(
      Math.round((preview.remainingSalary * preview.buyoutRate!) / 1_000) *
        1_000,
    );

    const next = releasePlayerUnderContract(state, {
      playerId,
      teamId,
      mode: "buyout",
    }).state;
    expect(next.business.finances[teamId]!.businessFunds).toBe(
      state.business.finances[teamId]!.businessFunds - preview.cashNow,
    );
    const entries = next.business.deadMoney[teamId]!;
    expect(entries.every((e) => e.prepaid)).toBe(true);
    const boughtOut = entries
      .filter((e) => e.reason === "bought_out")
      .reduce((sum, e) => sum + e.amount, 0);
    expect(boughtOut).toBe(preview.cashNow);
    for (let y = year; y <= contract.endYear; y += 1) {
      expect(getTeamPrepaidDeadMoney(teamId, y, next)).toBeGreaterThan(0);
    }
  });

  it("is not paid again by weekly payroll", () => {
    const state = regularSeasonLeague();
    const teamId = firstTeam(state);
    const playerId = multiYearPlayer(state, teamId);
    const salary = getContractSalaryForYear(
      state.business.contracts[state.world.players[playerId]!.contractId!]!,
      state.competition.season.year,
    )!;
    const released = releasePlayerUnderContract(state, {
      playerId,
      teamId,
      mode: "buyout",
    }).state;
    const weekEnd = addCalendarDays(state.world.calendar.currentDate, 6);
    const cash = (s: GameState) => s.business.finances[teamId]!.businessFunds;
    const paidBefore =
      cash(state) - cash(processWeeklyPlayerPayroll(state, weekEnd).state);
    const paidAfter =
      cash(released) -
      cash(processWeeklyPlayerPayroll(released, weekEnd).state);
    expect(paidAfter).toBeLessThan(paidBefore);
    expect(paidBefore - paidAfter).toBeLessThanOrEqual(salary);
  });
});

describe("getPlayerReleaseBlockReason", () => {
  it("blocks a release that would drop below the roster minimum in season", () => {
    let state = regularSeasonLeague();
    const teamId = firstTeam(state);
    const team = state.world.teams[teamId]!;
    // Cut the roster down to the minimum without dead money noise.
    state = {
      ...state,
      world: {
        ...state.world,
        teams: {
          ...state.world.teams,
          [teamId]: {
            ...team,
            roster: team.roster.slice(0, TRADE_ROSTER_RULES.minRosterSize),
          },
        },
      },
    };
    const playerId = state.world.teams[teamId]!.roster[0]!;
    expect(getPlayerReleaseBlockReason(state, { playerId, teamId })).toMatch(
      new RegExp(`fewer than ${TRADE_ROSTER_RULES.minRosterSize}`),
    );
  });

  it("blocks releasing a player who just signed", () => {
    const state = regularSeasonLeague();
    const teamId = firstTeam(state);
    const playerId = multiYearPlayer(state, teamId);
    const contractId = state.world.players[playerId]!.contractId!;
    const today = state.world.calendar.currentDate;
    const withSigning: GameState = {
      ...state,
      business: {
        ...state.business,
        freeAgency: {
          offers: {
            offer_recent: {
              id: "offer_recent" as never,
              playerId,
              teamId,
              terms: state.business.contracts[contractId]!,
              status: "accepted",
              contractId,
              createdOn: today,
              updatedOn: addCalendarDays(today, -3),
            },
          },
        },
      },
    };
    expect(
      getPlayerReleaseBlockReason(withSigning, { playerId, teamId }),
    ).toMatch(/signed 3 days ago/);
    expect(() =>
      releasePlayerUnderContract(withSigning, {
        playerId,
        teamId,
        mode: "waive",
      }),
    ).toThrow(/signed/);
  });

  it("blocks a player on another team", () => {
    const state = regularSeasonLeague();
    const [a, b] = Object.keys(state.world.teams).sort() as TeamId[];
    const playerId = state.world.teams[b!]!.roster[0]!;
    expect(
      getPlayerReleaseBlockReason(state, { playerId, teamId: a! }),
    ).toMatch(/not on this team/);
  });
});

describe("findCpuWaiverCandidate", () => {
  it("only picks spares whose dead money stays inside the CPU limit", () => {
    const state = regularSeasonLeague();
    const limit = getLeagueSalaryCap(state) * AI_WAIVE_MAX_DEAD_MONEY_CAP_SHARE;
    for (const teamId of Object.keys(state.world.teams) as TeamId[]) {
      const id = findCpuWaiverCandidate(state, teamId, "C");
      if (id === null) continue;
      const preview = previewPlayerRelease(state, {
        playerId: id,
        teamId,
        mode: "waive",
      });
      const dead = preview.entries.reduce((sum, e) => sum + e.amount, 0);
      expect(dead).toBeLessThanOrEqual(limit);
      expect(state.world.players[id]!.position).not.toBe("C");
    }
  });

  it("leaves cap space unchanged this season when waiving", () => {
    const state = regularSeasonLeague();
    const teamId = firstTeam(state);
    const playerId = multiYearPlayer(state, teamId);
    const year = state.competition.season.year;
    const preview = previewPlayerRelease(state, {
      playerId,
      teamId,
      mode: "waive",
    });
    expect(preview.capSpaceAfter).toBe(getTeamCapSpace(teamId, year, state));
  });
});
