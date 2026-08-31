import { describe, expect, it } from "vitest";
import { createContract } from "@/domain/entities/contract";
import { createDefaultDevelopmentLeagueProfile } from "@/domain/entities/development-league";
import { createPlayer } from "@/domain/entities/player";
import { asContractId, asPlayerId, asTeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { createTestGameState } from "../../factories/game-state";
import { createPlayer as createTestPlayer, uniformPlayerAttributes } from "../../factories/player";
import {
  assignPlayerToDevelopmentLeague,
  recallPlayerFromDevelopmentLeague,
} from "@/systems/development-league/assignment";
import {
  evaluateDevelopmentLeagueEligibility,
  isWithinDraftEligibilityWindow,
} from "@/systems/development-league/eligibility";
import {
  getDevelopmentLeagueRosterPlayerIds,
  getFranchisePlayerIds,
  getTopLeagueRosterPlayerIds,
  getTopLeagueRosterSize,
  isPlayerDlAssigned,
} from "@/systems/development-league/franchise-membership";
import { getTeamContractualSalaryObligation, getTeamPayroll } from "@/systems/salary-cap";
import { processDevelopmentLeagueSeasonTransition } from "@/systems/development-league/season-transition";
import { computeDlOpportunityBonus } from "@/systems/development-league/development-opportunity";
import { resolveRosterForSimulation } from "@/systems/game-simulation";
import { createSeededRng } from "@/domain/rng";

function seedDraftedPlayer(
  state: ReturnType<typeof createTestGameState>,
  opts: {
    playerId: string;
    teamId: string;
    overall?: number;
    potential?: number;
    draftYear?: number;
    age?: number;
  },
) {
  const teamId = asTeamId(opts.teamId);
  const playerId = asPlayerId(opts.playerId);
  const rating = opts.overall ?? 62;
  const attrs = uniformPlayerAttributes(rating);
  const contractId = asContractId(`contract_${opts.playerId}`);
  const year = state.competition.season.year;
  const player = createPlayer({
    ...createTestPlayer({
      id: playerId,
      teamId,
      contractId,
      age: opts.age ?? 21,
      attributes: attrs,
      potential: { overall: opts.potential ?? 78 },
    }),
    developmentLeague: {
      ...createDefaultDevelopmentLeagueProfile(),
      draftSeasonYear: opts.draftYear ?? year,
    },
  });
  const contract = createContract({
    id: contractId,
    playerId,
    teamId,
    startYear: year,
    endYear: year + 1,
    salaryByYear: { [String(year)]: 1_500_000, [String(year + 1)]: 1_500_000 },
  });
  const team = state.world.teams[teamId]!;
  return {
    ...state,
    world: {
      ...state.world,
      players: { ...state.world.players, [playerId]: player },
      teams: {
        ...state.world.teams,
        [teamId]: { ...team, roster: [...team.roster, playerId] },
      },
    },
    business: {
      ...state.business,
      contracts: { ...state.business.contracts, [contractId]: contract },
    },
  };
}

describe("Development League franchise membership", () => {
  it("keeps DL players off top-league roster while owned by franchise", () => {
    let state = createTestGameState();
    const teamId = state.user.activeOwnerTeamId;
    state = seedDraftedPlayer(state, { playerId: "dl_p1", teamId });
    const before = getTopLeagueRosterSize(teamId, state);
    const assigned = assignPlayerToDevelopmentLeague(
      state,
      asPlayerId("dl_p1"),
      teamId,
    );
    expect(assigned.success).toBe(true);
    state = assigned.state;
    expect(isPlayerDlAssigned(state.world.players["dl_p1"]!)).toBe(true);
    expect(getTopLeagueRosterPlayerIds(teamId, state)).not.toContain("dl_p1");
    expect(getTopLeagueRosterSize(teamId, state)).toBe(before - 1);
    expect(getDevelopmentLeagueRosterPlayerIds(teamId, state)).toContain("dl_p1");
    expect(getFranchisePlayerIds(teamId, state)).toContain("dl_p1");
    expect(state.world.players["dl_p1"]!.teamId).toBe(teamId);
  });
});

describe("Development League eligibility", () => {
  it("allows recent draft picks and rejects outside draft window", () => {
    expect(isWithinDraftEligibilityWindow(2027, 2027)).toBe(true);
    expect(isWithinDraftEligibilityWindow(2027, 2029)).toBe(true);
    expect(isWithinDraftEligibilityWindow(2027, 2030)).toBe(false);

    let state = createTestGameState();
    const teamId = state.user.activeOwnerTeamId;
    state = seedDraftedPlayer(state, {
      playerId: "elig_p1",
      teamId,
      draftYear: state.competition.season.year,
    });
    const player = state.world.players["elig_p1"]!;
    expect(
      evaluateDevelopmentLeagueEligibility(player, teamId, state).eligible,
    ).toBe(true);

    state = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          elig_p1: createPlayer({
            ...player,
            developmentLeague: {
              ...player.developmentLeague,
              draftSeasonYear: state.competition.season.year - 5,
            },
          }),
        },
      },
    };
    expect(
      evaluateDevelopmentLeagueEligibility(
        state.world.players["elig_p1"]!,
        teamId,
        state,
      ).eligible,
    ).toBe(false);
  });
});

describe("Development League assignment lock", () => {
  it("blocks re-assignment after recall in the same season", () => {
    let state = createTestGameState();
    const teamId = state.user.activeOwnerTeamId;
    state = seedDraftedPlayer(state, { playerId: "lock_p1", teamId });
    state = assignPlayerToDevelopmentLeague(
      state,
      asPlayerId("lock_p1"),
      teamId,
    ).state;
    state = recallPlayerFromDevelopmentLeague(
      state,
      asPlayerId("lock_p1"),
      teamId,
    ).state;
    const again = assignPlayerToDevelopmentLeague(
      state,
      asPlayerId("lock_p1"),
      teamId,
    );
    expect(again.success).toBe(false);
    expect(again.errors.some((e) => e.includes("recalled"))).toBe(true);
  });
});

describe("Development League payroll", () => {
  it("excludes DL salary from top-league payroll but keeps contractual obligation", () => {
    let state = createTestGameState();
    const teamId = state.user.activeOwnerTeamId;
    const year = state.competition.season.year;
    state = seedDraftedPlayer(state, { playerId: "pay_p1", teamId });
    const beforePayroll = getTeamPayroll(teamId, year, state);
    const beforeObligation = getTeamContractualSalaryObligation(
      teamId,
      year,
      state,
    );
    state = assignPlayerToDevelopmentLeague(
      state,
      asPlayerId("pay_p1"),
      teamId,
    ).state;
    const afterPayroll = getTeamPayroll(teamId, year, state);
    const afterObligation = getTeamContractualSalaryObligation(
      teamId,
      year,
      state,
    );
    expect(afterObligation).toBe(beforeObligation);
    expect(afterPayroll).toBe(beforePayroll - 1_500_000);
  });
});

describe("Development League season counting", () => {
  it("counts one season when assignedThisSeason and does not double-count", () => {
    let state = createTestGameState();
    const teamId = state.user.activeOwnerTeamId;
    state = seedDraftedPlayer(state, { playerId: "cnt_p1", teamId });
    state = assignPlayerToDevelopmentLeague(
      state,
      asPlayerId("cnt_p1"),
      teamId,
    ).state;
    expect(state.world.players["cnt_p1"]!.developmentLeague.assignedThisSeason).toBe(
      true,
    );
    const transitioned = processDevelopmentLeagueSeasonTransition(state);
    state = transitioned.state;
    expect(state.world.players["cnt_p1"]!.developmentLeague.seasonsUsed).toBe(1);
    expect(
      state.world.players["cnt_p1"]!.developmentLeague.assignedThisSeason,
    ).toBe(false);
  });
});

describe("Development League simulation overrides", () => {
  it("resolves DL roster via overrides without mutating Team.roster", () => {
    let state = createTestGameState();
    const teamId = state.user.activeOwnerTeamId;
    state = seedDraftedPlayer(state, { playerId: "sim_p1", teamId });
    state = seedDraftedPlayer(state, { playerId: "sim_p2", teamId });
    state = seedDraftedPlayer(state, { playerId: "sim_p3", teamId });
    state = seedDraftedPlayer(state, { playerId: "sim_p4", teamId });
    state = seedDraftedPlayer(state, { playerId: "sim_p5", teamId });
    for (const id of ["sim_p1", "sim_p2", "sim_p3", "sim_p4", "sim_p5"]) {
      state = assignPlayerToDevelopmentLeague(
        state,
        asPlayerId(id),
        teamId,
      ).state;
    }
    const rosterSnapshot = [...state.world.teams[teamId]!.roster];
    const overrides = {
      [teamId]: getDevelopmentLeagueRosterPlayerIds(teamId, state),
    };
    const resolved = resolveRosterForSimulation(state, teamId, overrides);
    expect(resolved.length).toBe(5);
    expect(state.world.teams[teamId]!.roster).toEqual(rosterSnapshot);
  });
});

describe("Development League opportunity bonus", () => {
  it("returns zero when not assigned and is capped", () => {
    let state = createTestGameState();
    const teamId = state.user.activeOwnerTeamId;
    state = seedDraftedPlayer(state, {
      playerId: "dev_p1",
      teamId,
      overall: 60,
      potential: 80,
    });
    const player = state.world.players["dev_p1"]!;
    expect(computeDlOpportunityBonus(player, teamId, state)).toBe(0);
  });
});

describe("Development League RNG smoke", () => {
  it("createSeededRng is available for determinism suites", () => {
    const rng = createSeededRng(42);
    expect(rng.next()).toBeGreaterThanOrEqual(0);
  });
});
