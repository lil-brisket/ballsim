/**
 * Offseason phase tests for the last step of the summer.
 *
 * There is no separate training-camp step. Leaving Staff & Development
 * initializes the new season, fills short rosters and caps long ones, and
 * lands in preseason.preparation; leaving preseason.preparation caps rosters
 * again, runs the roster gate and opens the regular season. These tests cover
 * that path on a real fixture and on hand-edited copies of it.
 */

import { describe, expect, it } from "vitest";
import { addCalendarDays } from "@/domain/calendar-date";
import { createContract } from "@/domain/entities/contract";
import type { DeadMoneyEntry } from "@/domain/entities/dead-money";
import { createDefaultDevelopmentLeagueProfile } from "@/domain/entities/development-league";
import type { Player } from "@/domain/entities/player";
import { asContractId, asPlayerId, type TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { createSeededRng, type Rng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import { enforceMaxRosterViaDevelopmentLeague } from "@/systems/development-league/enforce-roster-cap";
import { isDevelopmentLeagueEligible } from "@/systems/development-league/eligibility";
import { isPlayerDlAssigned } from "@/systems/development-league/franchise-membership";
import { canBeginRegularSeason } from "@/systems/league-rules";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { getActivePhaseId } from "@/systems/phase-engine";
import { getTeamDeadMoney, getTeamPayroll } from "@/systems/salary-cap";
import { vetMinSalary } from "@/systems/salary-scale";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { runDailyPipeline } from "@/systems/simulation/daily-pipeline";
import { advanceLeaguePhase } from "@/systems/simulation/offseason-lifecycle";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { canonicalPreseasonStartDate } from "@/systems/simulation/season-lifecycle-config";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";
import { createPlayer, uniformPlayerAttributes } from "../factories/player";
import { TEST_RNG_SEED } from "../helpers/determinism";
import {
  advanceThroughPhase,
  buildOffseasonFixture,
  type PhaseAdvanceResult,
} from "./driver";
import {
  assertOffseasonInvariants,
  collectOffseasonInvariantIssues,
} from "./invariants";
import { stateForComparison } from "./snapshot";

const SEED = TEST_RNG_SEED;
const { minRosterSize, maxRosterSize } = TRADE_ROSTER_RULES;

const beforeCamp = buildOffseasonFixture({
  seed: SEED,
  phase: "offseason.staff_development",
}).state;
const preparation = buildOffseasonFixture({
  seed: SEED,
  phase: "preseason.preparation",
}).state;
const opening = buildOffseasonFixture({ seed: SEED, phase: "regular" }).state;
const userTeamId = beforeCamp.user.activeOwnerTeamId;

function teamIdsOf(state: GameState): TeamId[] {
  return (Object.keys(state.world.teams) as TeamId[]).sort();
}

function rosterSizes(state: GameState): Record<string, number> {
  const sizes: Record<string, number> = {};
  for (const teamId of teamIdsOf(state)) {
    sizes[teamId] = state.world.teams[teamId]!.roster.length;
  }
  return sizes;
}

function overallOf(player: Player): number {
  return calculatePlayerOverall(player.position, player.attributes);
}

function codes(state: GameState, previous?: GameState): string[] {
  return collectOffseasonInvariantIssues(state, { previous }).map(
    (issue) => issue.code,
  );
}

function aiTeamId(state: GameState): TeamId {
  return teamIdsOf(state).find((teamId) => teamId !== userTeamId)!;
}

function dlAssignedIds(state: GameState, teamId: TeamId): string[] {
  return Object.values(state.world.players)
    .filter((player) => player.teamId === teamId && isPlayerDlAssigned(player))
    .map((player) => player.id)
    .sort();
}

function withPayroll(state: GameState, teamId: TeamId): GameState {
  return {
    ...state,
    business: {
      ...state.business,
      finances: {
        ...state.business.finances,
        [teamId]: {
          ...state.business.finances[teamId]!,
          payroll: getTeamPayroll(teamId, state.competition.season.year, state),
        },
      },
    },
  };
}

/** Takes the last players off a team as a release would, without dead money. */
function removeFromRoster(
  state: GameState,
  teamId: TeamId,
  count: number,
): GameState {
  const team = state.world.teams[teamId]!;
  const removed = team.roster.slice(-count);
  const players = { ...state.world.players };
  const contracts = { ...state.business.contracts };
  for (const playerId of removed) {
    const player = players[playerId]!;
    delete contracts[player.contractId!];
    players[playerId] = { ...player, teamId: null, contractId: null };
  }
  return withPayroll(
    {
      ...state,
      world: {
        ...state.world,
        players,
        teams: {
          ...state.world.teams,
          [teamId]: { ...team, roster: team.roster.slice(0, -count) },
        },
      },
      business: {
        ...state.business,
        contracts,
        tradeBlocks: dropFromTradeBlock(state, teamId, removed),
      },
    },
    teamId,
  );
}

function dropFromTradeBlock(
  state: GameState,
  teamId: TeamId,
  playerIds: readonly string[],
): GameState["business"]["tradeBlocks"] {
  const block = state.business.tradeBlocks[teamId];
  if (block === undefined) return state.business.tradeBlocks;
  return {
    ...state.business.tradeBlocks,
    [teamId]: {
      ...block,
      assets: block.assets.filter(
        (asset) => !("playerId" in asset && playerIds.includes(asset.playerId)),
      ),
    },
  };
}

type ExtraPlayer = { id: string; rating: number; drafted: boolean };

/** Adds minimum-contract players; only drafted ones can go to the DL. */
function addExtras(
  state: GameState,
  teamId: TeamId,
  extras: readonly ExtraPlayer[],
): GameState {
  const year = state.competition.season.year;
  const minimum = vetMinSalary(getLeagueSalaryCap(state));
  const players = { ...state.world.players };
  const contracts = { ...state.business.contracts };
  const roster = [...state.world.teams[teamId]!.roster];
  extras.forEach((extra, index) => {
    const contractId = asContractId(`contract_${extra.id}`);
    players[extra.id] = {
      ...createPlayer({
        id: extra.id,
        teamId,
        contractId,
        firstName: `Extra${index}`,
        lastName: extra.id,
        attributes: uniformPlayerAttributes(extra.rating),
        age: 20,
      }),
      developmentLeague: {
        ...createDefaultDevelopmentLeagueProfile(),
        draftSeasonYear: extra.drafted ? year : null,
      },
    };
    contracts[contractId] = createContract({
      id: contractId,
      playerId: asPlayerId(extra.id),
      teamId,
      startYear: year,
      endYear: year,
      salaryByYear: { [String(year)]: minimum },
    });
    roster.push(asPlayerId(extra.id));
  });
  return withPayroll(
    {
      ...state,
      world: {
        ...state.world,
        players,
        teams: {
          ...state.world.teams,
          [teamId]: { ...state.world.teams[teamId]!, roster },
        },
      },
      business: { ...state.business, contracts },
    },
    teamId,
  );
}

function daysBetween(from: string, to: string): number {
  let days = 0;
  let cursor = from;
  while (cursor < to) {
    cursor = addCalendarDays(cursor, 1);
    days += 1;
  }
  return days;
}

describe("leaving Staff & Development", () => {
  it("lands every team, the user's included, on a legal roster", () => {
    expect(getActivePhaseId(beforeCamp)).toBe("offseason.staff_development");
    expect(getActivePhaseId(preparation)).toBe("preseason.preparation");
    expect(preparation.competition.season.year).toBe(
      beforeCamp.competition.season.year + 1,
    );
    // The fixture really needed both the fill and the cap.
    const before = Object.values(rosterSizes(beforeCamp));
    expect(before.some((size) => size < maxRosterSize)).toBe(true);
    expect(before.some((size) => size > maxRosterSize)).toBe(true);

    for (const teamId of teamIdsOf(preparation)) {
      const size = preparation.world.teams[teamId]!.roster.length;
      expect(size, teamId).toBeGreaterThanOrEqual(minRosterSize);
      expect(size, teamId).toBeLessThanOrEqual(maxRosterSize);
    }
    assertOffseasonInvariants(preparation, {
      label: `seed ${SEED}, preseason.preparation`,
      previous: beforeCamp,
    });
  });

  it("opens the regular season on legal rosters and holds the invariants", () => {
    expect(getActivePhaseId(opening)).toBe("regular");
    for (const teamId of teamIdsOf(opening)) {
      const size = opening.world.teams[teamId]!.roster.length;
      expect(size, teamId).toBeGreaterThanOrEqual(minRosterSize);
      expect(size, teamId).toBeLessThanOrEqual(maxRosterSize);
    }
    expect(opening.competition.season.tradeDeadlineDate).not.toBeNull();
    assertOffseasonInvariants(opening, {
      label: `seed ${SEED}, regular day 1`,
      previous: preparation,
    });
  });

  it("starts the new season clean: no games, and no exhibitions", () => {
    expect(preparation.competition.season.phase).toBe("preseason");
    expect(preparation.competition.schedule.gameIds).toEqual([]);
    // Exhibitions are only generated when a league is first bootstrapped.
    expect(Object.keys(preparation.competition.games)).toEqual([]);
    for (const standing of Object.values(
      preparation.competition.standings.byTeamId,
    )) {
      expect(standing.wins + standing.losses).toBe(0);
    }
  });

  it("signs the fills of a short user roster at the minimum, never at market", () => {
    const state = removeFromRoster(
      beforeCamp,
      userTeamId,
      beforeCamp.world.teams[userTeamId]!.roster.length - minRosterSize,
    );
    const shortBy = state.world.teams[userTeamId]!.roster.length;
    expect(shortBy).toBe(minRosterSize);
    const known = new Set(state.world.teams[userTeamId]!.roster);

    const next = advanceLeaguePhase(state).state;
    const roster = next.world.teams[userTeamId]!.roster;
    expect(roster).toHaveLength(maxRosterSize);
    const minimum = vetMinSalary(getLeagueSalaryCap(next));
    const signed = roster.filter((playerId) => !known.has(playerId));
    expect(signed).toHaveLength(maxRosterSize - shortBy);
    for (const playerId of signed) {
      const contract =
        next.business.contracts[next.world.players[playerId]!.contractId!]!;
      expect(contract.teamId).toBe(userTeamId);
      expect(contract.startYear).toBe(next.competition.season.year);
      expect(contract.endYear, playerId).toBe(contract.startYear);
      expect(contract.salaryByYear).toEqual({
        [String(contract.startYear)]: minimum,
      });
    }
    assertOffseasonInvariants(next, { label: "user fill", previous: state });
  });

  it("never pays an AI fill below the minimum, and keeps the invariants", () => {
    const teamId = aiTeamId(beforeCamp);
    const state = removeFromRoster(beforeCamp, teamId, 6);
    const known = new Set(state.world.teams[teamId]!.roster);
    const next = advanceLeaguePhase(state).state;
    const minimum = vetMinSalary(getLeagueSalaryCap(next));
    const roster = next.world.teams[teamId]!.roster;
    expect(roster).toHaveLength(maxRosterSize);
    for (const playerId of roster.filter((id) => !known.has(id))) {
      const contract =
        next.business.contracts[next.world.players[playerId]!.contractId!]!;
      const salary = contract.salaryByYear[String(contract.startYear)]!;
      expect(salary, playerId).toBeGreaterThanOrEqual(minimum);
    }
    assertOffseasonInvariants(next, { label: "AI fill", previous: state });
  });
});

describe("roster overflow", () => {
  it("sends the weakest eligible players to the Development League, weakest first", () => {
    const teamId = aiTeamId(preparation);
    const withExtras = addExtras(preparation, teamId, [
      { id: "extra_c", rating: 22, drafted: true },
      { id: "extra_a", rating: 20, drafted: true },
      { id: "extra_b", rating: 21, drafted: true },
    ]);
    expect(withExtras.world.teams[teamId]!.roster).toHaveLength(18);
    const realMinimum = Math.min(
      ...withExtras.world.teams[teamId]!.roster.filter(
        (id) => !id.startsWith("extra_"),
      )
        .map((id) => withExtras.world.players[id]!)
        .filter((player) =>
          isDevelopmentLeagueEligible(player, teamId, withExtras),
        )
        .map(overallOf),
    );
    // Precondition: the extras really are the weakest eligible players.
    expect(overallOf(withExtras.world.players["extra_c"]!)).toBeLessThan(
      realMinimum,
    );
    const alreadyAssigned = dlAssignedIds(withExtras, teamId);

    const next = beginRegularSeasonFromPreseason(withExtras).state;
    expect(next.world.teams[teamId]!.roster).toHaveLength(maxRosterSize);
    expect(dlAssignedIds(next, teamId)).toEqual(
      [...alreadyAssigned, "extra_a", "extra_b", "extra_c"].sort(),
    );
    // They stay on the franchise, under contract, off the top roster.
    for (const id of ["extra_a", "extra_b", "extra_c"]) {
      const player = next.world.players[id]!;
      expect(player.teamId).toBe(teamId);
      expect(player.developmentLeague?.status).toBe("assigned");
      expect(next.world.teams[teamId]!.roster).not.toContain(id);
      expect(next.business.contracts[player.contractId!]).toBeDefined();
    }
    assertOffseasonInvariants(next, {
      label: "AI overflow",
      previous: withExtras,
    });
  });

  it("breaks overall ties by player id and sends only as many as needed", () => {
    const teamId = aiTeamId(preparation);
    const trimmed = removeFromRoster(preparation, teamId, 1);
    const withExtras = addExtras(trimmed, teamId, [
      { id: "extra_b", rating: 20, drafted: true },
      { id: "extra_a", rating: 20, drafted: true },
    ]);
    expect(withExtras.world.teams[teamId]!.roster).toHaveLength(16);
    const alreadyAssigned = dlAssignedIds(withExtras, teamId);

    const next = beginRegularSeasonFromPreseason(withExtras).state;
    expect(next.world.teams[teamId]!.roster).toHaveLength(maxRosterSize);
    expect(dlAssignedIds(next, teamId)).toEqual(
      [...alreadyAssigned, "extra_a"].sort(),
    );
    expect(next.world.teams[teamId]!.roster).toContain("extra_b");
  });

  it("passes over a weak player who cannot go down and takes the next eligible one", () => {
    const teamId = aiTeamId(preparation);
    const trimmed = removeFromRoster(preparation, teamId, 1);
    const withExtras = addExtras(trimmed, teamId, [
      { id: "extra_undrafted", rating: 10, drafted: false },
      { id: "extra_drafted", rating: 30, drafted: true },
    ]);
    const next = beginRegularSeasonFromPreseason(withExtras).state;
    expect(next.world.teams[teamId]!.roster).toHaveLength(maxRosterSize);
    expect(next.world.teams[teamId]!.roster).toContain("extra_undrafted");
    expect(dlAssignedIds(next, teamId)).toContain("extra_drafted");
  });

  it("applies the same cut to the user's team", () => {
    const withExtras = addExtras(preparation, userTeamId, [
      { id: "extra_user_a", rating: 20, drafted: true },
      { id: "extra_user_b", rating: 21, drafted: true },
    ]);
    const next = beginRegularSeasonFromPreseason(withExtras).state;
    expect(next.world.teams[userTeamId]!.roster).toHaveLength(maxRosterSize);
    expect(dlAssignedIds(next, userTeamId)).toEqual(
      expect.arrayContaining(["extra_user_a", "extra_user_b"]),
    );
    assertOffseasonInvariants(next, { label: "user overflow" });
  });

  it("creates no dead money, and payroll stays contracts plus dead money", () => {
    const teamId = aiTeamId(preparation);
    const year = preparation.competition.season.year;
    const earlier: DeadMoneyEntry = {
      playerId: asPlayerId("released_earlier"),
      teamId,
      seasonYear: year,
      amount: 1_234_567,
      reason: "waived",
      prepaid: false,
      createdOn: preparation.world.calendar.currentDate,
    };
    const withDead: GameState = {
      ...preparation,
      business: {
        ...preparation.business,
        deadMoney: { ...preparation.business.deadMoney, [teamId]: [earlier] },
      },
    };
    const withExtras = addExtras(withDead, teamId, [
      { id: "extra_a", rating: 20, drafted: true },
      { id: "extra_b", rating: 21, drafted: true },
    ]);
    const payrollBefore = getTeamPayroll(teamId, year, withExtras);

    const next = beginRegularSeasonFromPreseason(withExtras).state;
    // The cut-down is a DL assignment, not a release: nothing is owed.
    expect(next.business.deadMoney).toEqual(withExtras.business.deadMoney);
    expect(getTeamDeadMoney(teamId, year, next)).toBe(earlier.amount);

    const contractTotal = next.world.teams[teamId]!.roster.reduce(
      (total, playerId) => {
        const contract =
          next.business.contracts[next.world.players[playerId]!.contractId!]!;
        return total + (contract.salaryByYear[String(year)] ?? 0);
      },
      0,
    );
    const payrollAfter = getTeamPayroll(teamId, year, next);
    expect(payrollAfter).toBe(contractTotal + earlier.amount);
    // A DL assignee's salary leaves the payroll while he is assigned.
    expect(payrollAfter).toBeLessThan(payrollBefore);
  });
});

describe("the roster gate", () => {
  it("blocks a team with too many players the DL cannot take, and says which", () => {
    const teamId = aiTeamId(preparation);
    const crowded = addExtras(preparation, teamId, [
      ...["u", "v", "w", "x", "y", "z"].map((letter) => ({
        id: `extra_${letter}`,
        rating: 40,
        drafted: false,
      })),
    ]);
    const before = structuredClone(crowded);

    // The cap runs first; undrafted players are not DL-eligible, so it holds.
    const capped = enforceMaxRosterViaDevelopmentLeague(crowded).state;
    expect(capped.world.teams[teamId]!.roster.length).toBeGreaterThan(
      maxRosterSize,
    );
    const gate = canBeginRegularSeason(capped);
    expect(gate.allowed).toBe(false);
    expect(gate.violations).toHaveLength(1);
    expect(gate.violations[0]?.code).toBe("ROSTER_INVALID");
    expect(gate.blockReason).toContain(teamId);
    expect(gate.blockReason).toContain(
      `Roster size must be at most ${maxRosterSize}`,
    );

    expect(() => beginRegularSeasonFromPreseason(crowded)).toThrow(
      new RegExp(`Season cannot begin.*${teamId}.*at most ${maxRosterSize}`),
    );
    expect(() => advanceLeaguePhase(crowded)).toThrow(
      new RegExp(`${teamId}.*at most ${maxRosterSize}`),
    );
    expect(crowded).toEqual(before);
  });

  it("blocks a user team below the minimum; the engine does not fill it", () => {
    const state = removeFromRoster(
      preparation,
      userTeamId,
      maxRosterSize - (minRosterSize - 1),
    );
    expect(state.world.teams[userTeamId]!.roster).toHaveLength(
      minRosterSize - 1,
    );
    const before = structuredClone(state);

    const gate = canBeginRegularSeason(state);
    expect(gate.allowed).toBe(false);
    expect(gate.blockReason).toContain(userTeamId);
    expect(gate.blockReason).toContain(
      `Roster size must be at least ${minRosterSize}`,
    );
    expect(() => beginRegularSeasonFromPreseason(state)).toThrow(
      new RegExp(`${userTeamId}.*at least ${minRosterSize}`),
    );
    expect(() => advanceLeaguePhase(state)).toThrow(
      new RegExp(`at least ${minRosterSize}`),
    );
    expect(state).toEqual(before);
    expect(getActivePhaseId(state)).toBe("preseason.preparation");
  });

  it("opens at exactly the minimum roster", () => {
    const low = removeFromRoster(
      preparation,
      userTeamId,
      maxRosterSize - minRosterSize,
    );
    expect(low.world.teams[userTeamId]!.roster).toHaveLength(minRosterSize);
    const begun = beginRegularSeasonFromPreseason(low).state;
    expect(getActivePhaseId(begun)).toBe("regular");
    expect(begun.world.teams[userTeamId]!.roster).toHaveLength(minRosterSize);
    expect(codes(begun)).toEqual([]);
  });

  it("reports every illegal team, not just the first", () => {
    const [first, second] = teamIdsOf(preparation).filter(
      (teamId) => teamId !== userTeamId,
    );
    const broken = removeFromRoster(
      removeFromRoster(preparation, first!, 10),
      second!,
      10,
    );
    const gate = canBeginRegularSeason(broken);
    expect(gate.allowed).toBe(false);
    expect(gate.violations).toHaveLength(2);
    const text = gate.violations
      .map((violation) => violation.message)
      .join("|");
    expect(text).toContain(first);
    expect(text).toContain(second);
  });

  it("refuses to begin the season from any other phase", () => {
    expect(() => beginRegularSeasonFromPreseason(beforeCamp)).toThrow(
      /requires preseason\.preparation/,
    );
  });
});

describe("calendar time and the manual advance agree", () => {
  const manualPreparation = advanceLeaguePhase(beforeCamp);
  const autoStaff: PhaseAdvanceResult = advanceThroughPhase(
    beforeCamp,
    "offseason.staff_development",
  );

  it("reach the same phase with legal, equally sized rosters", () => {
    expect(autoStaff.toPhaseId).toBe("preseason.preparation");
    expect(getActivePhaseId(manualPreparation.state)).toBe(
      "preseason.preparation",
    );
    expect(rosterSizes(manualPreparation.state)).toEqual(
      rosterSizes(autoStaff.state),
    );
    expect(rosterSizes(autoStaff.state)).toEqual(rosterSizes(preparation));
    expect(manualPreparation.state.competition.season.year).toBe(
      autoStaff.state.competition.season.year,
    );
    for (const state of [manualPreparation.state, autoStaff.state]) {
      assertOffseasonInvariants(state, {
        label: "staff_development exit",
        previous: beforeCamp,
      });
    }
  });

  it("differ only in the calendar: manual runs no days, time waits for the date", () => {
    const year = manualPreparation.state.competition.season.year;
    expect(manualPreparation.state.world.calendar.currentDate).toBe(
      canonicalPreseasonStartDate(year),
    );
    expect(autoStaff.days).toBeGreaterThan(0);
    expect(
      autoStaff.state.world.calendar.currentDate >=
        manualPreparation.state.world.calendar.currentDate,
    ).toBe(true);
  });

  it("open the season on the same day with the same shape", () => {
    const manualOpening = advanceLeaguePhase(preparation).state;
    expect(getActivePhaseId(manualOpening)).toBe("regular");
    expect(manualOpening.competition.season.regularSeasonStartDate).toBe(
      opening.competition.season.regularSeasonStartDate,
    );
    expect(manualOpening.world.calendar.currentDate).toBe(
      opening.world.calendar.currentDate,
    );
    expect(rosterSizes(manualOpening)).toEqual(rosterSizes(opening));
    expect(manualOpening.competition.schedule.gameIds).toHaveLength(
      opening.competition.schedule.gameIds.length,
    );
    assertOffseasonInvariants(manualOpening, {
      label: "manual opening",
      previous: preparation,
    });
  });

  it("opens by itself on the planned opening day when the clock allows it", () => {
    const rng = createSeededRng(preparation.meta.rngState);
    const plannedOpener = opening.competition.season.regularSeasonStartDate!;
    const daysToOpener = daysBetween(
      preparation.world.calendar.currentDate,
      plannedOpener,
    );
    // Standing on the opener, the season has not opened; the next day opens it.
    const early = advanceSimulation(preparation, rng, {
      days: daysToOpener,
      allowOwnerManagedPhaseTransitions: true,
      stopOnPhaseChange: true,
    });
    expect(getActivePhaseId(early.state)).toBe("preseason.preparation");
    expect(early.state.world.calendar.currentDate).toBe(plannedOpener);

    const result = advanceSimulation(early.state, rng, {
      days: 1,
      allowOwnerManagedPhaseTransitions: true,
      stopOnPhaseChange: true,
    });
    expect(getActivePhaseId(result.state)).toBe("regular");
    expect(result.state.world.calendar.currentDate).toBe(plannedOpener);
    expect(rosterSizes(result.state)).toEqual(rosterSizes(opening));
    expect(codes(result.state)).toEqual([]);
  });

  it("is deterministic: the same state gives the same manual result", () => {
    const again = advanceLeaguePhase(beforeCamp);
    expect(stateForComparison(again.state)).toEqual(
      stateForComparison(manualPreparation.state),
    );
  });
});

describe("offseason training injuries", () => {
  /**
   * The 2% training exposure is rare enough that a short run produces few
   * injuries, so the roll is forced and the engine's own injury odds decide.
   */
  function forceTrainingExposure(seed: number): Rng {
    const base = createSeededRng(seed);
    return {
      ...base,
      chance: (p: number) => (p === 0.02 ? true : base.chance(p)),
    };
  }

  it("injures only rostered, active players, and the save stays valid", () => {
    expect(beforeCamp.competition.season.phase).toBe("offseason");
    const hasFreeAgents = Object.values(beforeCamp.world.players).some(
      (player) => player.teamId == null && player.retired !== true,
    );
    expect(hasFreeAgents).toBe(true);

    const rng = forceTrainingExposure(SEED);
    let state = beforeCamp;
    const injuries: {
      playerId: string;
      teamId: string | null;
      source: string;
    }[] = [];
    for (let day = 0; day < 150; day += 1) {
      const result = runDailyPipeline(state, rng);
      state = result.state;
      for (const event of result.events) {
        if (event.type !== "PlayerInjured") continue;
        const payload = event.payload as {
          playerId: string;
          teamId: string | null;
          exposureSource: string;
        };
        injuries.push({
          playerId: payload.playerId,
          teamId: payload.teamId,
          source: payload.exposureSource,
        });
      }
    }

    expect(injuries.length).toBeGreaterThan(0);
    for (const injury of injuries) {
      const player = beforeCamp.world.players[injury.playerId]!;
      expect(player, injury.playerId).toBeDefined();
      expect(player.retired).not.toBe(true);
      expect(player.teamId).not.toBeNull();
      expect(injury.teamId).toBe(player.teamId);
      expect(["offseason_training", "off_court"]).toContain(injury.source);
    }
    for (const player of Object.values(state.world.players)) {
      if (player.teamId == null || player.retired === true) {
        expect(player.activeInjuries, player.id).toEqual([]);
      }
    }
    expect(codes(state)).toEqual([]);
  });

  it("does not touch rosters or contracts", () => {
    const rng = forceTrainingExposure(SEED + 1);
    let state = beforeCamp;
    for (let day = 0; day < 20; day += 1) {
      state = runDailyPipeline(state, rng).state;
    }
    expect(rosterSizes(state)).toEqual(rosterSizes(beforeCamp));
    expect(state.business.contracts).toEqual(beforeCamp.business.contracts);
  });
});
