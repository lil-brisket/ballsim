import { describe, expect, it } from "vitest";
import { testOwnerObjective } from "../helpers/owner-objective";
import { createPlayer } from "@/domain/entities/player";
import type { Coach } from "@/domain/entities/coach";
import type { Staff } from "@/domain/entities/staff";
import {
  asCoachId,
  asContractId,
  asOwnerObjectiveId,
  asPlayerId,
  asSeasonId,
  asStaffId,
  asTeamId,
} from "@/domain/ids";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { GameState } from "@/state/game-state";
import { toOwnerGameState } from "@/state/owner-game-state";
import { getActiveOwnedFranchise } from "@/state/owner-context";

const VALID_ATTRIBUTES = {
  speed: 74,
  strength: 66,
  athleticism: 74,
  stamina: 71,
  finishing: 68,
  midRange: 70,
  threePoint: 67,
  freeThrow: 73,
  ballHandling: 71,
  passing: 72,
  perimeterDefense: 65,
  interiorDefense: 60,
  steal: 63,
  block: 58,
  rebounding: 58,
  basketballIq: 69,
  offensiveIq: 70,
  defensiveIq: 64,
  consistency: 68,
};

function baseState(): GameState {
  return createInitialGameState({
    saveId: "save_owner_view",
    rngSeed: 7,
    nowIso: "2026-08-13T12:00:00.000Z",
    settings: CBL_GAME_SETTINGS,
  });
}

describe("toOwnerGameState", () => {
  it("creates Owner Mode state for a valid team", () => {
    const state = baseState();
    const owner = toOwnerGameState(state);
    expect(owner.selectedTeamId).toBe(state.user.activeOwnerTeamId);
    expect(owner.currentDate).toBe(state.world.calendar.currentDate);
    expect(owner.currentSeasonId).toBe(state.competition.season.id);
  });

  it("resolves selectedTeamId to the canonical team", () => {
    const state = baseState();
    const owner = toOwnerGameState(state);
    expect(owner.selectedTeamId).toBe(state.user.activeOwnerTeamId);
    expect(state.world.teams[owner.selectedTeamId]).toBeDefined();
    expect(state.world.teams[owner.selectedTeamId]!.id).toBe(
      owner.selectedTeamId,
    );
  });

  it("resolves currentSeasonId to the canonical season", () => {
    const state = baseState();
    const owner = toOwnerGameState(state);
    expect(owner.currentSeasonId).toBe(state.competition.season.id);
    expect(owner.leagueState.season).toBe(state.competition.season);
  });

  it("preserves live objectives array reference", () => {
    const state = baseState();
    const objective = testOwnerObjective({
      id: asOwnerObjectiveId("obj_playoffs"),
      type: "make_playoffs",
      description: "Make the playoffs",
      status: "active",
      seasonYear: state.competition.season.year,
      consequenceApplied: false,
    });
    getActiveOwnedFranchise(state).objectives.push(objective);
    const owner = toOwnerGameState(state);
    expect(owner.objectives).toBe(getActiveOwnedFranchise(state).objectives);
    expect(owner.objectives).toHaveLength(1);
    expect(owner.objectives[0]!.type).toBe("make_playoffs");
  });

  it("preserves live notifications array reference", () => {
    const state = baseState();
    expect(toOwnerGameState(state).notifications).toBe(getActiveOwnedFranchise(state).notifications);
  });

  it("preserves live finances reference", () => {
    const state = baseState();
    const owner = toOwnerGameState(state);
    const teamId = owner.selectedTeamId;
    expect(owner.finances).toBe(state.business.finances[teamId]);
    expect(owner.finances.businessFunds).toBe(18_000_000);
    expect(owner.finances.booksByYear).toEqual({});
    expect(owner.finances.payroll).toBe(0);
  });

  it("resolves staff ids against world catalogs", () => {
    const state = baseState();
    const teamId = state.user.activeOwnerTeamId;
    const coachId = asCoachId("coach_owner_1");
    const staffId = asStaffId("staff_owner_1");
    const coach: Coach = {
      id: coachId,
      teamId,
      firstName: "Pat",
      lastName: "Riley",
    };
    const staffMember: Staff = {
      id: staffId,
      teamId,
      firstName: "Sam",
      lastName: "Scout",
      role: "scout",
      quality: 60,
      experience: 8,
      strengths: ["scouting"],
      weaknesses: [],
    };
    // Isolate catalogs for this assertion (initial state seeds staff/coaches).
    state.world.coaches = { [coachId]: coach };
    state.world.staff = { [staffId]: staffMember };
    state.world.teams[teamId] = {
      ...state.world.teams[teamId]!,
      staff: [staffId],
    };

    const owner = toOwnerGameState(state);
    expect(owner.staff.coachIds).toEqual([coachId]);
    expect(owner.staff.staffIds).toEqual([staffId]);
    expect(state.world.coaches[owner.staff.coachIds[0]!]).toBe(coach);
    expect(state.world.staff[owner.staff.staffIds[0]!]).toBe(staffMember);
  });

  it("preserves live roster reference and resolves players", () => {
    const state = baseState();
    const teamId = state.user.activeOwnerTeamId;
    const playerId = asPlayerId("player_owner_1");
    const player = createPlayer({
      id: playerId,
      teamId,
      firstName: "Alex",
      lastName: "Rivera",
      nationality: "USA",
      age: 22,
      heightInches: 76,
      weightPounds: 200,
      position: "SG",
      archetype: "three_and_d_wing",
      attributes: { ...VALID_ATTRIBUTES },
      potential: { overall: 80 },
      personality: {
        workEthic: 60,
        loyalty: 55,
        competitiveness: 65,
        leadership: 50,
        composure: 58,
      },
      contractId: asContractId("contract_owner_1"),
      injury: { kind: "healthy" },
      development: { stage: "developing" },
    });
    state.world.players[playerId] = player;
    const roster = [playerId];
    state.world.teams[teamId] = {
      ...state.world.teams[teamId]!,
      roster,
    };

    const owner = toOwnerGameState(state);
    expect(owner.roster).toBe(roster);
    expect(owner.roster).toBe(state.world.teams[teamId]!.roster);
    expect(state.world.players[owner.roster[0]!]).toBe(player);
  });

  it("exposes league state as live canonical references", () => {
    const state = baseState();
    const owner = toOwnerGameState(state);
    expect(owner.leagueState.league).toBe(state.world.league);
    expect(owner.leagueState.teams).toBe(state.world.teams);
    expect(owner.leagueState.season).toBe(state.competition.season);
    expect(owner.leagueState.schedule).toBe(state.competition.schedule);
    expect(owner.leagueState.games).toBe(state.competition.games);
    expect(owner.leagueState.standings).toBe(state.competition.standings);
    expect(owner.leagueState.playoffs).toBe(state.competition.playoffs);
  });

  it("rejects unknown controlledTeamId", () => {
    const state = baseState();
    state.user.activeOwnerTeamId = asTeamId("team_does_not_exist");
    expect(() => toOwnerGameState(state)).toThrow(/selectedTeamId/);
  });

  it("rejects missing season id", () => {
    const state = baseState();
    state.competition.season = {
      ...state.competition.season,
      id: asSeasonId(""),
    };
    expect(() => toOwnerGameState(state)).toThrow(/currentSeasonId/);
  });

  it("rejects missing team finances", () => {
    const state = baseState();
    const teamId = state.user.activeOwnerTeamId;
    delete state.business.finances[teamId];
    expect(() => toOwnerGameState(state)).toThrow(/finances/);
  });

  it("rejects unresolved roster player ids", () => {
    const state = baseState();
    const teamId = state.user.activeOwnerTeamId;
    state.world.teams[teamId] = {
      ...state.world.teams[teamId]!,
      roster: [asPlayerId("player_missing")],
    };
    expect(() => toOwnerGameState(state)).toThrow(/roster player/);
  });

  it("rejects unresolved staff ids", () => {
    const state = baseState();
    const teamId = state.user.activeOwnerTeamId;
    state.world.teams[teamId] = {
      ...state.world.teams[teamId]!,
      staff: [asStaffId("staff_missing")],
    };
    expect(() => toOwnerGameState(state)).toThrow(/staff/);
  });
});

describe("Owner Mode GameState round-trip", () => {
  it("survives serialize/deserialize with objectives and finance fields", () => {
    const state = baseState();
    getActiveOwnedFranchise(state).objectives = [
      testOwnerObjective({
        id: asOwnerObjectiveId("obj_wins"),
        type: "minimum_win_total",
        description: "Win 40 games",
        target: 40,
        progress: 0,
        status: "active",
        seasonYear: state.competition.season.year,
        consequenceApplied: false,
      }),
    ];
    state.business.finances[state.user.activeOwnerTeamId] = {
      ...state.business.finances[state.user.activeOwnerTeamId]!,
      booksByYear: {
        [String(state.competition.season.year)]: {
          revenue: {
            tickets: 0,
            premium: 0,
            merchandise: 0,
            concessions: 0,
            sponsorships: 0,
            broadcast: 0,
            playoffs: 0,
            other: 1_000_000,
          },
          expenses: {
            staff: 0,
            facilities: 0,
            capital: 0,
            operations: 250_000,
            marketing: 0,
          },
        },
      },
      attendanceByYear: {},
      booksByMonth: {},
      businessFundsLedgerByMonth: {},
    };

    const restored = deserializeGameState(serializeGameState(state));
    expect(restored).toEqual(state);
    expect(() => validateGameState(restored)).not.toThrow();

    const owner = toOwnerGameState(restored);
    expect(owner.objectives).toBe(getActiveOwnedFranchise(restored).objectives);
    const yearKey = String(restored.competition.season.year);
    expect(owner.finances.booksByYear[yearKey]!.revenue.other).toBe(1_000_000);
    expect(owner.finances.booksByYear[yearKey]!.expenses.operations).toBe(
      250_000,
    );
  });
});
