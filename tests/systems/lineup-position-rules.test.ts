import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import {
  createPlayer,
  PLAYER_POSITIONS,
  playsPosition,
  type PlayerPosition,
} from "@/domain/entities/player";
import type { TeamId } from "@/domain/ids";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import {
  getEmergencyLineup,
  recommendRosterManagement,
  validateRosterManagementShape,
} from "@/systems/roster-management";
import { updateLineupCommand } from "@/systems/team-management-commands";
import { detectManagementNeeds } from "@/systems/simulation/management-needs";
import { ownerLineupNeedsFix } from "@/systems/simulation/owner-lineup-gate";
import { listFreeAgents } from "@/systems/free-agency";
import { generatePlayer } from "@/systems/player-generation";
import { bootstrapWorld } from "@/systems/world-pipeline";

function seasonState(): GameState {
  let state = createInitialGameState({
    saveId: "lineup_rules",
    rngSeed: 411,
    settings: CBL_GAME_SETTINGS,
  });
  state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
  return {
    ...state,
    competition: {
      ...state.competition,
      season: { ...state.competition.season, phase: "regular" },
    },
  };
}

function injure(
  state: GameState,
  teamId: TeamId,
  position: PlayerPosition,
): GameState {
  const players = { ...state.world.players };
  for (const id of state.world.teams[teamId]!.roster) {
    const player = players[id]!;
    if (playsPosition(player, position)) {
      players[id] = createPlayer({ ...player, availability: "out" });
    }
  }
  return { ...state, world: { ...state.world, players } };
}

describe("recommended lineup", () => {
  it("places every starter at his primary or secondary position, once", () => {
    const state = seasonState();
    for (const teamId of Object.keys(state.world.teams) as TeamId[]) {
      const { startingLineup } = recommendRosterManagement(state, teamId);
      expect(new Set(startingLineup.map((s) => s.slot)).size).toBe(
        startingLineup.length,
      );
      for (const slot of startingLineup) {
        expect(
          playsPosition(state.world.players[slot.playerId]!, slot.slot),
        ).toBe(true);
      }
    }
  });

  it("is left short rather than padded with an off-position starter", () => {
    const state = injure(
      seasonState(),
      seasonState().user.activeOwnerTeamId,
      "C",
    );
    const teamId = state.user.activeOwnerTeamId;
    const { startingLineup } = recommendRosterManagement(state, teamId);
    expect(startingLineup.length).toBeLessThan(5);
    expect(startingLineup.some((slot) => slot.slot === "C")).toBe(false);
  });
});

describe("illegal starting slots", () => {
  it("are flagged by the shape validator", () => {
    const state = seasonState();
    const teamId = state.user.activeOwnerTeamId;
    const management = state.world.teams[teamId]!.rosterManagement;
    const [first, second] = management.startingLineup;
    const misplaced = player(state, first!.playerId);
    // Put the first starter into a slot he does not play.
    const wrong = PLAYER_POSITIONS.find(
      (position) => !playsPosition(misplaced, position),
    )!;
    const next = {
      ...management,
      startingLineup: [
        { playerId: first!.playerId, slot: wrong },
        ...management.startingLineup.slice(1).filter((s) => s.slot !== wrong),
      ],
    };
    expect(second).toBeDefined();
    const issues = validateRosterManagementShape(state, teamId, next);
    expect(issues.some((issue) => issue.code === "illegal_slot")).toBe(true);
  });

  it("cannot be saved through the lineup command", () => {
    const state = seasonState();
    const teamId = state.user.activeOwnerTeamId;
    const management = state.world.teams[teamId]!.rosterManagement;
    const first = management.startingLineup[0]!;
    const wrong = PLAYER_POSITIONS.find(
      (position) => !playsPosition(player(state, first.playerId), position),
    )!;
    const result = updateLineupCommand(state, {
      teamId,
      startingLineup: [
        { playerId: first.playerId, slot: wrong },
        ...management.startingLineup.slice(1).filter((s) => s.slot !== wrong),
      ],
      bench: management.bench,
      inactive: management.inactive,
    });
    expect(result.ok).toBe(false);
  });
});

describe("game-time lineup", () => {
  it("uses the saved lineup when it is legal", () => {
    const state = seasonState();
    const teamId = state.user.activeOwnerTeamId;
    const lineup = getEmergencyLineup(state, teamId);
    expect(lineup.emergency).toBe(false);
    for (const slot of lineup.slots) {
      expect(playsPosition(player(state, slot.playerId), slot.slot)).toBe(true);
    }
  });

  it("replaces a saved starter who is out with a legal one when it can", () => {
    let state = seasonState();
    const teamId = state.user.activeOwnerTeamId;
    const starterId =
      state.world.teams[teamId]!.rosterManagement.startingLineup[0]!.playerId;
    state = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [starterId]: createPlayer({
            ...state.world.players[starterId]!,
            availability: "out",
          }),
        },
      },
    };
    const lineup = getEmergencyLineup(state, teamId);
    expect(lineup.players.map((p) => p.id)).not.toContain(starterId);
    if (!lineup.emergency) {
      for (const slot of lineup.slots) {
        expect(playsPosition(player(state, slot.playerId), slot.slot)).toBe(
          true,
        );
      }
    }
  });

  it("falls back to the nearest position, still five players, when no legal five exists", () => {
    const state = injure(
      seasonState(),
      seasonState().user.activeOwnerTeamId,
      "C",
    );
    const teamId = state.user.activeOwnerTeamId;
    const lineup = getEmergencyLineup(state, teamId);
    expect(lineup.emergency).toBe(true);
    expect(lineup.players).toHaveLength(5);
    expect(new Set(lineup.slots.map((slot) => slot.slot)).size).toBe(5);
    const center = lineup.slots.find((slot) => slot.slot === "C")!;
    // The player at C is the nearest available (a PF), not an arbitrary guard.
    const nearest = player(state, center.playerId);
    expect(["PF", "SF"]).toContain(nearest.position);
  });
});

describe("owner lineup gate", () => {
  it("does not stop a team that has a legal five", () => {
    expect(ownerLineupNeedsFix(seasonState())).toBe(false);
  });

  it("stops an owner with no legal five when AI assist is off", () => {
    const base = seasonState();
    const teamId = base.user.activeOwnerTeamId;
    const injured = injure(base, teamId, "C");
    const assistOff = withAssist(injured, "off");
    expect(
      detectManagementNeeds(assistOff).some(
        (need) => need.id === "no_legal_lineup",
      ),
    ).toBe(true);
    expect(ownerLineupNeedsFix(assistOff)).toBe(true);
  });

  it("does not stop an owner whose AI assist can sign for the open position", () => {
    const base = seasonState();
    const injured = injure(base, base.user.activeOwnerTeamId, "C");
    const assisted = withFreeAgentAt(
      withAssist(injured, "full_management"),
      "C",
    );
    expect(ownerLineupNeedsFix(assisted)).toBe(false);
  });

  it("stops an owner whose AI assist has nobody to sign", () => {
    const base = seasonState();
    const injured = injure(base, base.user.activeOwnerTeamId, "C");
    const assisted = withAssist(injured, "full_management");
    const noFreeAgents = withoutFreeAgents(assisted);
    expect(ownerLineupNeedsFix(noFreeAgents)).toBe(true);
  });

  it("does not raise the need outside the playing phases", () => {
    const base = seasonState();
    const injured = injure(base, base.user.activeOwnerTeamId, "C");
    const offseason = {
      ...injured,
      competition: {
        ...injured.competition,
        season: { ...injured.competition.season, phase: "offseason" as const },
      },
    };
    expect(
      detectManagementNeeds(offseason).some(
        (need) => need.id === "no_legal_lineup",
      ),
    ).toBe(false);
  });
});

/** Retires every free agent so the pool is empty. */
function withoutFreeAgents(state: GameState): GameState {
  const players = { ...state.world.players };
  for (const id of listFreeAgents(state).playerIds) {
    players[id] = createPlayer({ ...players[id]!, retired: true });
  }
  return { ...state, world: { ...state.world, players } };
}

/** Empties the pool, then adds one cheap free agent who plays `position`. */
function withFreeAgentAt(
  state: GameState,
  position: PlayerPosition,
): GameState {
  const emptied = withoutFreeAgents(state);
  const freeAgent = generatePlayer("gate_fa", {
    position,
    quality: 12,
    teamId: null,
    contractId: null,
  });
  return {
    ...emptied,
    world: {
      ...emptied.world,
      players: { ...emptied.world.players, [freeAgent.id]: freeAgent },
    },
  };
}

/**
 * The owner's franchise with AI assist fully off (preset and every phase) or
 * on full management.
 */
function withAssist(
  state: GameState,
  managementPreset: "off" | "full_management",
): GameState {
  const teamId = state.user.activeOwnerTeamId;
  const franchise = state.user.ownedFranchises[teamId]!;
  const aiAssistance =
    managementPreset === "off"
      ? (Object.fromEntries(
          Object.keys(franchise.aiAssistance).map((phase) => [phase, "off"]),
        ) as typeof franchise.aiAssistance)
      : franchise.aiAssistance;
  return {
    ...state,
    user: {
      ...state.user,
      ownedFranchises: {
        ...state.user.ownedFranchises,
        [teamId]: { ...franchise, managementPreset, aiAssistance },
      },
    },
  };
}

function player(state: GameState, id: string) {
  return state.world.players[id as keyof typeof state.world.players]!;
}
