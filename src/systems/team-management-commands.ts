/**
 * Owner team-management commands. Always target the active owned franchise
 * for user-facing mutations — reject stale/non-active team IDs.
 */

import type { CoachingPhilosophy } from "@/domain/coaching/coaching-philosophy";
import {
  getCoachingPreset,
  type CoachingPresetId,
} from "@/domain/coaching/coaching-presets";
import type {
  LineupSlot,
  RotationEntry,
  RotationStyle,
  TeamRosterManagement,
} from "@/domain/entities/team-roster-management";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  getActiveOwnerTeamId,
  isOwnedFranchise,
} from "@/state/owner-context";
import {
  applyRosterManagement,
  getTeamRosterManagement,
  recommendRosterManagement,
  validateRosterManagementShape,
  withTeamRosterManagement,
} from "@/systems/roster-management";
import { cloneTeamRosterManagement } from "@/domain/entities/team-roster-management";

export type TeamManagementCommandResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

function assertActiveOwnedTeam(
  state: GameState,
  teamId: TeamId,
): TeamManagementCommandResult | null {
  if (!isOwnedFranchise(state, teamId)) {
    return { ok: false, error: "Team is not a controlled franchise." };
  }
  if (teamId !== getActiveOwnerTeamId(state)) {
    return {
      ok: false,
      error:
        "Cannot mutate a non-active franchise. Switch teams first, then try again.",
    };
  }
  return null;
}

export function updateLineupCommand(
  state: GameState,
  input: {
    teamId: TeamId;
    startingLineup: LineupSlot[];
    bench: PlayerId[];
    inactive: PlayerId[];
  },
): TeamManagementCommandResult {
  const auth = assertActiveOwnedTeam(state, input.teamId);
  if (auth) {
    return auth;
  }

  const current = getTeamRosterManagement(state, input.teamId);
  const starterIds = new Set(input.startingLineup.map((slot) => slot.playerId));
  const rotation: RotationEntry[] = current.rotation
    .filter((entry) => !input.inactive.includes(entry.playerId))
    .map((entry) => ({
      ...entry,
      role: starterIds.has(entry.playerId) ? "starter" : "bench",
      plannedMinutes: input.inactive.includes(entry.playerId)
        ? 0
        : entry.plannedMinutes,
    }));

  // Ensure every starter/bench has a rotation row
  for (const slot of input.startingLineup) {
    if (!rotation.some((entry) => entry.playerId === slot.playerId)) {
      const player = state.world.players[slot.playerId];
      rotation.push({
        playerId: slot.playerId,
        plannedMinutes: 32,
        eligiblePositions: player ? [player.position] : [slot.slot],
        role: "starter",
      });
    }
  }
  for (const playerId of input.bench) {
    if (!rotation.some((entry) => entry.playerId === playerId)) {
      const player = state.world.players[playerId];
      rotation.push({
        playerId,
        plannedMinutes: 0,
        eligiblePositions: player ? [player.position] : ["SF"],
        role: "bench",
      });
    }
  }

  const next: TeamRosterManagement = {
    ...cloneTeamRosterManagement(current),
    startingLineup: input.startingLineup.map((slot) => ({ ...slot })),
    bench: [...input.bench],
    inactive: [...input.inactive],
    rotation,
    lastConfiguredBy: "user",
  };

  const issues = validateRosterManagementShape(state, input.teamId, next);
  const blocking = issues.filter(
    (issue) =>
      issue.code === "not_on_roster" ||
      issue.code === "duplicate_group" ||
      issue.code === "unavailable_starter" ||
      issue.code === "inactive_minutes",
  );
  if (blocking.length > 0) {
    return { ok: false, error: blocking.map((issue) => issue.message).join(" ") };
  }

  try {
    return {
      ok: true,
      state: applyRosterManagement(state, input.teamId, next),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to update lineup.",
    };
  }
}

export function updateRotationCommand(
  state: GameState,
  input: {
    teamId: TeamId;
    rotation: RotationEntry[];
    rotationStyle?: RotationStyle;
  },
): TeamManagementCommandResult {
  const auth = assertActiveOwnedTeam(state, input.teamId);
  if (auth) {
    return auth;
  }

  const current = getTeamRosterManagement(state, input.teamId);
  const inactiveSet = new Set(current.inactive);
  for (const entry of input.rotation) {
    if (inactiveSet.has(entry.playerId) && entry.plannedMinutes > 0) {
      return {
        ok: false,
        error: `Inactive player ${entry.playerId} cannot have planned minutes > 0.`,
      };
    }
  }

  const next: TeamRosterManagement = {
    ...cloneTeamRosterManagement(current),
    rotation: input.rotation.map((entry) => ({
      ...entry,
      eligiblePositions: [...entry.eligiblePositions],
    })),
    rotationStyle: input.rotationStyle ?? current.rotationStyle,
    lastConfiguredBy: "user",
  };

  return {
    ok: true,
    state: withTeamRosterManagement(state, input.teamId, next),
  };
}

export function previewLineupRecommendation(
  state: GameState,
  teamId: TeamId,
): TeamRosterManagement {
  return recommendRosterManagement(state, teamId, { configuredBy: "default" });
}

export function applyLineupRecommendationCommand(
  state: GameState,
  teamId: TeamId,
): TeamManagementCommandResult {
  const auth = assertActiveOwnedTeam(state, teamId);
  if (auth) {
    return auth;
  }
  const recommended = recommendRosterManagement(state, teamId, {
    configuredBy: "user",
  });
  return {
    ok: true,
    state: withTeamRosterManagement(state, teamId, recommended),
  };
}

export function updateCoachingPhilosophyCommand(
  state: GameState,
  input: {
    teamId: TeamId;
    philosophy: CoachingPhilosophy;
  },
): TeamManagementCommandResult {
  const auth = assertActiveOwnedTeam(state, input.teamId);
  if (auth) {
    return auth;
  }
  const team = state.world.teams[input.teamId];
  if (team == null) {
    return { ok: false, error: "Team not found." };
  }
  return {
    ok: true,
    state: {
      ...state,
      world: {
        ...state.world,
        teams: {
          ...state.world.teams,
          [input.teamId]: {
            ...team,
            coachingPhilosophy: { ...input.philosophy },
          },
        },
      },
    },
  };
}

export function applyCoachingPresetCommand(
  state: GameState,
  input: {
    teamId: TeamId;
    presetId: CoachingPresetId;
  },
): TeamManagementCommandResult {
  const auth = assertActiveOwnedTeam(state, input.teamId);
  if (auth) {
    return auth;
  }
  const preset = getCoachingPreset(input.presetId);
  if (preset == null) {
    return { ok: false, error: "Unknown coaching preset." };
  }
  const team = state.world.teams[input.teamId];
  if (team == null) {
    return { ok: false, error: "Team not found." };
  }

  const management = cloneTeamRosterManagement(team.rosterManagement);
  management.rotationStyle = preset.rotationStyle;
  management.lastConfiguredBy = "user";

  return {
    ok: true,
    state: {
      ...state,
      world: {
        ...state.world,
        teams: {
          ...state.world.teams,
          [input.teamId]: {
            ...team,
            coachingPhilosophy: { ...preset.philosophy },
            rosterManagement: management,
          },
        },
      },
    },
  };
}
