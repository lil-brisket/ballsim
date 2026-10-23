/**
 * Issue #82: offseason signings must cover the upcoming season, AI free agency
 * must finish when the window closes, and the short-roster fill must respect
 * the salary cap. Together these let one AI team carry ~2x the cap.
 */
import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { getContractSalaryForYear } from "@/domain/entities/contract";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { runAiTeamDecisions } from "@/systems/ai-team-decisions";
import {
  DEFAULT_ROSTER_SIZE,
  rosterPositionForSlot,
} from "@/systems/roster-generation-config";
import type { PlayerPosition } from "@/domain/entities/player";
import { seasonRecord, withFranchiseHistory } from "../state/history-fixtures";
import { fillShortRosters } from "@/systems/roster-generation";
import {
  advanceLeaguePhase,
  processOffseasonLifecycle,
} from "@/systems/simulation/offseason-lifecycle";
import { transitionPhase } from "@/systems/simulation/phase-machine";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  listFreeAgents,
  releasePlayerToFreeAgency,
} from "@/systems/free-agency";
import { getActivePhaseId, setActivePhase } from "@/systems/phase-engine";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { getContractSigningYear, getTeamPayroll } from "@/systems/salary-cap";
import {
  REPLACEMENT_LEVEL_OVERALL,
  vetMinSalary,
} from "@/systems/salary-scale";

function setup(saveId: string, rngSeed: number) {
  const initial = createInitialGameState({
    saveId,
    rngSeed,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(initial.meta.rngState);
  return { state: bootstrapWorld(initial, rng).state, rng };
}

function aiTeamIds(state: GameState): TeamId[] {
  return (Object.keys(state.world.teams) as TeamId[])
    .filter((id) => id !== state.user.activeOwnerTeamId)
    .sort();
}

function expireContractAndRelease(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const contractId = state.world.players[playerId]!.contractId;
  let next = state;
  const contract =
    contractId !== null ? next.business.contracts[contractId] : undefined;
  if (contractId !== null && contract) {
    next = {
      ...next,
      business: {
        ...next.business,
        contracts: {
          ...next.business.contracts,
          [contractId]: {
            ...contract,
            endYear: next.competition.season.year - 1,
            salaryByYear: {},
          },
        },
      },
    };
  }
  return releasePlayerToFreeAgency(next, playerId).state;
}

function toFreeAgency(
  state: GameState,
  rng: ReturnType<typeof createSeededRng>,
): GameState {
  let current = transitionPhase(state, "regular").state;
  current = transitionPhase(current, "postseason").state;
  current = transitionPhase(current, "offseason").state;
  current = setActivePhase(current, "offseason.season_transition");
  current = processOffseasonLifecycle(current, rng).state;
  return setActivePhase(current, "offseason.free_agency");
}

function releaseFromTeam(
  state: GameState,
  teamId: TeamId,
  count: number,
): GameState {
  let current = state;
  for (let index = 0; index < count; index += 1) {
    const playerId = current.world.teams[teamId]!.roster.at(-1)!;
    current = expireContractAndRelease(current, playerId);
  }
  return current;
}

describe("offseason signings and the salary cap (#82)", () => {
  it("tops up an owner's short roster with minimum deals only (#93)", () => {
    const { state: initial, rng } = setup("fill_owner_minimum", 34);
    const ownerId = initial.user.activeOwnerTeamId;
    const state = releaseFromTeam(initial, ownerId, 2);
    const year = getContractSigningYear(state);
    const cap = getLeagueSalaryCap(state);
    expect(getTeamPayroll(ownerId, year, state)).toBeLessThan(cap);

    const before = new Set(state.world.teams[ownerId]!.roster);
    const filled = fillShortRosters(state, rng).state;
    const added = filled.world.teams[ownerId]!.roster.filter(
      (playerId) => !before.has(playerId),
    );
    expect(added).toHaveLength(2);
    for (const playerId of added) {
      const contract =
        filled.business.contracts[filled.world.players[playerId]!.contractId!]!;
      expect(getContractSalaryForYear(contract, year)).toBe(vetMinSalary(cap));
      expect(contract.endYear).toBe(contract.startYear);
    }
  });

  it("signs offseason contracts for the upcoming season", () => {
    const { state: initial, rng } = setup("offseason_signing_year", 31);
    let state = toFreeAgency(initial, rng);
    const teamId = aiTeamIds(state)[0]!;
    state = releaseFromTeam(state, teamId, 2);
    const completedYear = state.competition.season.year;
    expect(getContractSigningYear(state)).toBe(completedYear + 1);

    const before = new Set(state.world.teams[teamId]!.roster);
    // Count free agents only: the same AI run can also trade for a player,
    // and a traded player keeps their existing contract.
    const freeAgentsBefore = new Set(listFreeAgents(state).playerIds);
    const after = runAiTeamDecisions(state, rng).state;
    const signed = after.world.teams[teamId]!.roster.filter(
      (playerId) => !before.has(playerId) && freeAgentsBefore.has(playerId),
    );
    expect(signed.length).toBeGreaterThan(0);

    const pool = new Set(listFreeAgents(after).playerIds);
    for (const playerId of signed) {
      const player = after.world.players[playerId]!;
      const contract = after.business.contracts[player.contractId!]!;
      expect(contract.startYear).toBe(completedYear + 1);
      // A player under a contract that starts next season is not a free agent.
      expect(pool.has(playerId)).toBe(false);
    }
  });

  it("finishes AI free agency when the free-agency window closes", () => {
    const { state: initial, rng } = setup("offseason_fa_completion", 32);
    let state = toFreeAgency(initial, rng);
    const [first, second] = aiTeamIds(state);
    state = releaseFromTeam(state, first!, 3);
    state = releaseFromTeam(state, second!, 2);
    const sizeBefore = (teamId: TeamId) =>
      state.world.teams[teamId]!.roster.length;
    const firstBefore = sizeBefore(first!);
    const secondBefore = sizeBefore(second!);

    // No daily AI run: closing the window alone must complete the signings.
    const closed = advanceLeaguePhase(state, rng).state;
    expect(getActivePhaseId(closed)).not.toBe("offseason.free_agency");
    expect(closed.world.teams[first!]!.roster.length).toBeGreaterThan(
      firstBefore,
    );
    expect(closed.world.teams[second!]!.roster.length).toBeGreaterThan(
      secondBefore,
    );

    const cap = getLeagueSalaryCap(closed);
    const nextYear = closed.competition.season.year + 1;
    for (const teamId of aiTeamIds(closed)) {
      expect(getTeamPayroll(teamId, nextYear, closed)).toBeLessThanOrEqual(cap);
    }
  });

  it("fills a capped-out roster with minimum deals, not market contracts", () => {
    const { state: initial, rng } = setup("fill_respects_cap", 33);
    const teamId = aiTeamIds(initial)[0]!;
    let state = releaseFromTeam(initial, teamId, 3);
    const year = getContractSigningYear(state);
    const cap = getLeagueSalaryCap(state);

    // Push the team to the cap with one existing contract.
    const anchorId =
      state.world.players[state.world.teams[teamId]!.roster[0]!]!.contractId!;
    const anchor = state.business.contracts[anchorId]!;
    const others =
      getTeamPayroll(teamId, year, state) -
      (getContractSalaryForYear(anchor, year) ?? 0);
    state = {
      ...state,
      business: {
        ...state.business,
        contracts: {
          ...state.business.contracts,
          [anchorId]: {
            ...anchor,
            salaryByYear: { ...anchor.salaryByYear, [year]: cap - others },
          },
        },
      },
    };
    expect(getTeamPayroll(teamId, year, state)).toBe(cap);

    const rosterBefore = new Set(state.world.teams[teamId]!.roster);
    const filled = fillShortRosters(state, rng).state;
    const added = filled.world.teams[teamId]!.roster.filter(
      (playerId) => !rosterBefore.has(playerId),
    );
    expect(filled.world.teams[teamId]!.roster.length).toBe(DEFAULT_ROSTER_SIZE);
    expect(added).toHaveLength(3);
    for (const playerId of added) {
      const player = filled.world.players[playerId]!;
      const contract = filled.business.contracts[player.contractId!]!;
      expect(getContractSalaryForYear(contract, year)).toBe(vetMinSalary(cap));
      expect(contract.endYear).toBe(contract.startYear);
      expect(
        calculatePlayerOverall(player.position, player.attributes),
      ).toBeLessThanOrEqual(REPLACEMENT_LEVEL_OVERALL);
    }
    expect(getTeamPayroll(teamId, year, filled)).toBe(
      cap + 3 * vetMinSalary(cap),
    );
  });

  it("fills in waiver order: the worst record gets the best free agent", () => {
    const { state: initial, rng } = setup("fill_waiver_order", 35);
    const [better, worse] = aiTeamIds(initial);
    let state = releaseFromTeam(initial, better!, 1);
    state = releaseFromTeam(state, worse!, 1);
    const year = state.competition.season.year;
    state = withFranchiseHistory(state, {
      [better!]: [seasonRecord({ year: year - 1, wins: 30, losses: 10 })],
      [worse!]: [seasonRecord({ year: year - 1, wins: 10, losses: 30 })],
    });
    const position = rosterPositionForSlot(
      state.world.teams[better!]!.roster.length,
    );
    const starId = withBestFreeAgentAt(state, position);
    state = starId.state;

    const filled = fillShortRosters(state, rng).state;
    expect(filled.world.players[starId.playerId]!.teamId).toBe(worse);
  });

  it("signs the best free agent left for the minimum when no team can pay him", () => {
    const { state: initial, rng } = setup("fill_best_at_minimum", 36);
    const ownerId = initial.user.activeOwnerTeamId;
    let state = releaseFromTeam(initial, ownerId, 1);
    const position = rosterPositionForSlot(
      state.world.teams[ownerId]!.roster.length,
    );
    const star = withBestFreeAgentAt(state, position);
    state = star.state;
    const others = aiTeamIds(state);
    // Only the owner is short, and an owner's fill pays the minimum.
    expect(
      others.every(
        (id) => state.world.teams[id]!.roster.length === DEFAULT_ROSTER_SIZE,
      ),
    ).toBe(true);

    const filled = fillShortRosters(state, rng).state;
    const player = filled.world.players[star.playerId]!;
    expect(player.teamId).toBe(ownerId);
    const contract = filled.business.contracts[player.contractId!]!;
    const year = getContractSigningYear(filled);
    expect(getContractSalaryForYear(contract, year)).toBe(
      vetMinSalary(getLeagueSalaryCap(filled)),
    );
    expect(
      calculatePlayerOverall(player.position, player.attributes),
    ).toBeGreaterThan(REPLACEMENT_LEVEL_OVERALL);
  });
});

/** Turns the first free agent into the best (all-88) player at `position`. */
function withBestFreeAgentAt(
  state: GameState,
  position: PlayerPosition,
): { state: GameState; playerId: PlayerId } {
  const playerId = listFreeAgents(state).playerIds[0]!;
  const player = state.world.players[playerId]!;
  const attributes = Object.fromEntries(
    Object.keys(player.attributes).map((key) => [key, 88]),
  ) as typeof player.attributes;
  return {
    state: {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [playerId]: { ...player, position, attributes },
        },
      },
    },
    playerId,
  };
}
