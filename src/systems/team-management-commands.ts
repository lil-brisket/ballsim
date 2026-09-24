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
  ClosingLineupPolicy,
  LineupSlot,
  RotationEntry,
  RotationPhilosophy,
  RotationPreset,
  RotationStyle,
  TeamRosterManagement,
} from "@/domain/entities/team-roster-management";
import {
  cloneTeamRosterManagement,
  depthForPhilosophy,
  philosophyFromStyle,
} from "@/domain/entities/team-roster-management";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  getActiveOwnerTeamId,
  isOwnedFranchise,
} from "@/state/owner-context";
import {
  applyRosterManagement,
  applyRotationEditsToManagement,
  getTeamRosterManagement,
  mergeLineupIntoManagement,
  optimizeRotationFromRoster,
  recommendRosterManagement,
  validateRosterManagementShape,
  withTeamRosterManagement,
} from "@/systems/roster-management";

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

function blockingShapeErrors(
  state: GameState,
  teamId: TeamId,
  management: TeamRosterManagement,
): string | null {
  const issues = validateRosterManagementShape(state, teamId, management);
  const blocking = issues.filter(
    (issue) =>
      issue.code === "not_on_roster" ||
      issue.code === "duplicate_group" ||
      issue.code === "unavailable_starter" ||
      issue.code === "inactive_minutes",
  );
  if (blocking.length > 0) {
    return blocking.map((issue) => issue.message).join(" ");
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
  const next = mergeLineupIntoManagement(state, input.teamId, current, {
    startingLineup: input.startingLineup,
    bench: input.bench,
    inactive: input.inactive,
  });

  const shapeError = blockingShapeErrors(state, input.teamId, next);
  if (shapeError) {
    return { ok: false, error: shapeError };
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
    rotationPhilosophy?: RotationPhilosophy;
    rotationDepth?: number;
    rotationPreset?: RotationPreset;
    closingLineupPolicy?: ClosingLineupPolicy;
    closingLineupIds?: PlayerId[];
  },
): TeamManagementCommandResult {
  const auth = assertActiveOwnedTeam(state, input.teamId);
  if (auth) {
    return auth;
  }

  const current = getTeamRosterManagement(state, input.teamId);
  const applied = applyRotationEditsToManagement(
    state,
    input.teamId,
    current,
    {
      rotation: input.rotation,
      rotationStyle: input.rotationStyle,
      rotationPhilosophy: input.rotationPhilosophy,
      rotationDepth: input.rotationDepth,
      rotationPreset: input.rotationPreset,
      closingLineupPolicy: input.closingLineupPolicy,
      closingLineupIds: input.closingLineupIds,
    },
  );
  if (!applied.ok) {
    return applied;
  }

  return {
    ok: true,
    state: withTeamRosterManagement(state, input.teamId, applied.management),
  };
}

/**
 * Atomic lineup + rotation save: merge lineup → overlay rotation edits →
 * validate → persist once.
 */
export function updateLineupAndRotationCommand(
  state: GameState,
  input: {
    teamId: TeamId;
    startingLineup: LineupSlot[];
    bench: PlayerId[];
    inactive: PlayerId[];
    rotation: RotationEntry[];
    rotationStyle?: RotationStyle;
    rotationPhilosophy?: RotationPhilosophy;
    rotationDepth?: number;
    rotationPreset?: RotationPreset;
    closingLineupPolicy?: ClosingLineupPolicy;
    closingLineupIds?: PlayerId[];
  },
): TeamManagementCommandResult {
  const auth = assertActiveOwnedTeam(state, input.teamId);
  if (auth) {
    return auth;
  }

  const current = getTeamRosterManagement(state, input.teamId);
  const afterLineup = mergeLineupIntoManagement(state, input.teamId, current, {
    startingLineup: input.startingLineup,
    bench: input.bench,
    inactive: input.inactive,
  });

  const applied = applyRotationEditsToManagement(
    state,
    input.teamId,
    afterLineup,
    {
      rotation: input.rotation,
      rotationStyle: input.rotationStyle,
      rotationPhilosophy: input.rotationPhilosophy,
      rotationDepth: input.rotationDepth,
      rotationPreset: input.rotationPreset,
      closingLineupPolicy: input.closingLineupPolicy,
      closingLineupIds: input.closingLineupIds,
    },
  );
  if (!applied.ok) {
    return applied;
  }

  const shapeError = blockingShapeErrors(
    state,
    input.teamId,
    applied.management,
  );
  if (shapeError) {
    return { ok: false, error: shapeError };
  }

  try {
    return {
      ok: true,
      state: applyRosterManagement(state, input.teamId, applied.management),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update lineup and rotation.",
    };
  }
}

export function optimizeRotationCommand(
  state: GameState,
  input: {
    teamId: TeamId;
    rotationPreset?: RotationPreset;
    rotationPhilosophy?: RotationPhilosophy;
  },
): TeamManagementCommandResult {
  const auth = assertActiveOwnedTeam(state, input.teamId);
  if (auth) {
    return auth;
  }
  const optimized = optimizeRotationFromRoster(state, input.teamId, {
    rotationPreset: input.rotationPreset,
    rotationPhilosophy: input.rotationPhilosophy,
    configuredBy: "user",
  });
  return {
    ok: true,
    state: withTeamRosterManagement(state, input.teamId, optimized),
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
  management.rotationPhilosophy = philosophyFromStyle(preset.rotationStyle);
  management.rotationDepth = depthForPhilosophy(management.rotationPhilosophy);
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
