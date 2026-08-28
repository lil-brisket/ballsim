import { describe, expect, it } from "vitest";
import { asTeamId } from "@/domain/ids";
import { generateRosters } from "@/systems/roster-generation";
import {
  getEmergencyLineup,
  getRegulationTeamMinutesTarget,
  recommendRosterManagement,
  reconcileRosterManagement,
  validatePlannedMinutes,
} from "@/systems/roster-management";
import { getPlayerAvailability } from "@/systems/player-availability";
import {
  applyLineupRecommendationCommand,
  updateLineupCommand,
} from "@/systems/team-management-commands";
import { createTestGameState } from "../factories/game-state";
import { createTestRng } from "../helpers/determinism";

function bootstrappedState() {
  const initial = createTestGameState();
  const rng = createTestRng(1);
  const generated = generateRosters(initial, rng);
  return generated.state;
}

describe("roster-management", () => {
  it("recommends a 5-man starting lineup with planned minutes near 240", () => {
    const state = bootstrappedState();
    const teamId = state.user.activeOwnerTeamId;
    const management = recommendRosterManagement(state, teamId);
    expect(management.startingLineup).toHaveLength(5);
    const slots = management.startingLineup.map((slot) => slot.slot);
    expect(new Set(slots).size).toBe(5);
    const minutes = validatePlannedMinutes(management);
    expect(minutes.target).toBe(getRegulationTeamMinutesTarget());
    expect(Math.abs(minutes.delta)).toBeLessThanOrEqual(5);
  });

  it("marks injured starters as unavailable and keeps them out of recommend starters", () => {
    let state = bootstrappedState();
    const teamId = state.user.activeOwnerTeamId;
    const team = state.world.teams[teamId]!;
    const playerId = team.roster[0]!;
    state = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [playerId]: {
            ...state.world.players[playerId]!,
            injury: { kind: "injured" },
          },
        },
      },
    };
    const availability = getPlayerAvailability(state, playerId, teamId);
    expect(availability.available).toBe(false);
    expect(availability.reason).toBe("injured");

    const recommended = recommendRosterManagement(state, teamId);
    expect(
      recommended.startingLineup.some((slot) => slot.playerId === playerId),
    ).toBe(false);
  });

  it("reconcile drops traded players and adds newcomers", () => {
    let state = bootstrappedState();
    const teamIds = Object.keys(state.world.teams);
    const teamA = asTeamId(teamIds[0]!);
    const teamB = asTeamId(teamIds[1]!);
    const playerFromA = state.world.teams[teamA]!.roster[0]!;
    const playerFromB = state.world.teams[teamB]!.roster[0]!;

    // Simulate roster membership swap without full trade system
    state = {
      ...state,
      world: {
        ...state.world,
        teams: {
          ...state.world.teams,
          [teamA]: {
            ...state.world.teams[teamA]!,
            roster: [
              ...state.world.teams[teamA]!.roster.filter((id) => id !== playerFromA),
              playerFromB,
            ],
          },
          [teamB]: {
            ...state.world.teams[teamB]!,
            roster: [
              ...state.world.teams[teamB]!.roster.filter((id) => id !== playerFromB),
              playerFromA,
            ],
          },
        },
        players: {
          ...state.world.players,
          [playerFromA]: {
            ...state.world.players[playerFromA]!,
            teamId: teamB,
          },
          [playerFromB]: {
            ...state.world.players[playerFromB]!,
            teamId: teamA,
          },
        },
      },
    };

    state = reconcileRosterManagement(state, teamA);
    state = reconcileRosterManagement(state, teamB);

    const mgmtA = state.world.teams[teamA]!.rosterManagement;
    const allA = [
      ...mgmtA.startingLineup.map((slot) => slot.playerId),
      ...mgmtA.bench,
      ...mgmtA.inactive,
    ];
    expect(allA).not.toContain(playerFromA);
    expect(allA).toContain(playerFromB);
  });

  it("emergency lineup never throws with fewer than 5 healthy players", () => {
    let state = bootstrappedState();
    const teamId = state.user.activeOwnerTeamId;
    const roster = state.world.teams[teamId]!.roster;
    const players = { ...state.world.players };
    for (let index = 0; index < roster.length - 2; index += 1) {
      const playerId = roster[index]!;
      players[playerId] = {
        ...players[playerId]!,
        injury: { kind: "injured" },
      };
    }
    state = {
      ...state,
      world: { ...state.world, players },
    };
    const emergency = getEmergencyLineup(state, teamId);
    expect(emergency.emergency).toBe(true);
    expect(emergency.players.length).toBeGreaterThan(0);
    expect(emergency.players.length).toBeLessThanOrEqual(5);
  });

  it("does not silently normalize planned minutes", () => {
    const state = bootstrappedState();
    const teamId = state.user.activeOwnerTeamId;
    const management = recommendRosterManagement(state, teamId);
    management.rotation = management.rotation.map((entry, index) => ({
      ...entry,
      plannedMinutes: index === 0 ? 50 : entry.plannedMinutes,
    }));
    const validation = validatePlannedMinutes(management);
    expect(validation.valid).toBe(false);
    expect(validation.totalPlanned).not.toBe(validation.target);
  });
});

describe("team-management multi-team auth", () => {
  it("rejects mutation for non-active owned franchise", () => {
    let state = bootstrappedState();
    const owned = [...state.user.ownedTeamIds];
    const teamA = owned[0]!;
    // Add a second owned team if needed
    const otherTeamId = Object.keys(state.world.teams).find(
      (id) => id !== teamA,
    )!;
    if (!owned.includes(asTeamId(otherTeamId))) {
      state = {
        ...state,
        user: {
          ...state.user,
          ownedTeamIds: [...owned, asTeamId(otherTeamId)],
          ownedFranchises: {
            ...state.user.ownedFranchises,
            [otherTeamId]: state.user.ownedFranchises[teamA]!,
          },
          activeOwnerTeamId: teamA,
        },
      };
    }
    const inactiveOwned =
      state.user.ownedTeamIds.find((id) => id !== state.user.activeOwnerTeamId) ??
      asTeamId(otherTeamId);

    const result = applyLineupRecommendationCommand(state, inactiveOwned);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/non-active franchise/i);
    }
  });
});

describe("lineup command", () => {
  it("applies user lineup to active franchise", () => {
    const state = bootstrappedState();
    const teamId = state.user.activeOwnerTeamId;
    const recommended = recommendRosterManagement(state, teamId, {
      configuredBy: "user",
    });
    const result = updateLineupCommand(state, {
      teamId,
      startingLineup: recommended.startingLineup,
      bench: recommended.bench,
      inactive: recommended.inactive,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.state.world.teams[teamId]!.rosterManagement.lastConfiguredBy,
      ).toBe("user");
      expect(
        result.state.world.teams[teamId]!.rosterManagement.startingLineup,
      ).toHaveLength(5);
    }
  });
});
