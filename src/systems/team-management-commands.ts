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
  styleFromPhilosophy,
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
  optimizeRotationFromRoster,
  recommendRosterManagement,
  validateRosterManagementShape,
  withTeamRosterManagement,
} from "@/systems/roster-management";
import { deriveRotationConstraints } from "@/systems/rotation/derive-rotation-constraints";
import { redistributeRotationForInjuries } from "@/systems/rotation/rotation-injury-response";
import { getPlayerAvailability } from "@/systems/player-availability";
import { ROLE_TEMPLATES } from "@/systems/rotation/rotation-role-templates";

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

function starterTemplateEntry(
  playerId: PlayerId,
  preferredPositions: RotationEntry["preferredPositions"],
): RotationEntry {
  const template = ROLE_TEMPLATES.starter;
  return {
    playerId,
    targetMinutes: 32,
    minimumMinutes: template.min,
    normalMaximumMinutes: template.normalMax,
    absoluteMaximumMinutes: template.absoluteMax,
    rotationPriority: template.priority,
    rotationStatus: "active",
    role: "starter",
    preferredPositions,
    secondaryPositions: [],
    minutePriorityBias: 0,
  };
}

function benchTemplateEntry(
  playerId: PlayerId,
  preferredPositions: RotationEntry["preferredPositions"],
): RotationEntry {
  const template = ROLE_TEMPLATES.bench;
  return {
    playerId,
    targetMinutes: 0,
    minimumMinutes: 0,
    normalMaximumMinutes: template.normalMax,
    absoluteMaximumMinutes: template.absoluteMax,
    rotationPriority: template.priority,
    rotationStatus: "inactive",
    role: "bench",
    preferredPositions,
    secondaryPositions: [],
    minutePriorityBias: 0,
  };
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
      preferredPositions: [...entry.preferredPositions],
      secondaryPositions: [...entry.secondaryPositions],
      role: starterIds.has(entry.playerId)
        ? ("starter" as const)
        : entry.role === "starter"
          ? ("bench" as const)
          : entry.role,
      targetMinutes: input.inactive.includes(entry.playerId)
        ? 0
        : entry.targetMinutes,
      rotationStatus: input.inactive.includes(entry.playerId)
        ? ("inactive" as const)
        : entry.rotationStatus,
    }));

  for (const slot of input.startingLineup) {
    if (!rotation.some((entry) => entry.playerId === slot.playerId)) {
      const player = state.world.players[slot.playerId];
      rotation.push(
        starterTemplateEntry(
          slot.playerId,
          player ? [player.position] : [slot.slot],
        ),
      );
    }
  }
  for (const playerId of input.bench) {
    if (!rotation.some((entry) => entry.playerId === playerId)) {
      const player = state.world.players[playerId];
      rotation.push(
        benchTemplateEntry(playerId, player ? [player.position] : ["SF"]),
      );
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
  const inactiveSet = new Set(current.inactive);
  for (const entry of input.rotation) {
    if (inactiveSet.has(entry.playerId) && entry.targetMinutes > 0) {
      return {
        ok: false,
        error: `Inactive player ${entry.playerId} cannot have target minutes > 0.`,
      };
    }
  }

  const philosophy =
    input.rotationPhilosophy ??
    (input.rotationStyle
      ? philosophyFromStyle(input.rotationStyle)
      : current.rotationPhilosophy);

  const derivedRotation = input.rotation.map((entry) => {
    const avail = getPlayerAvailability(state, entry.playerId, input.teamId);
    return deriveRotationConstraints({
      playerId: entry.playerId,
      targetMinutes: entry.targetMinutes,
      role: entry.role === "deep_bench" ? "bench" : entry.role,
      preferredPositions: entry.preferredPositions,
      secondaryPositions: entry.secondaryPositions,
      rotationPriority: entry.rotationPriority,
      minutePriorityBias: entry.minutePriorityBias,
      overrideMedicalRecommendation: entry.overrideMedicalRecommendation,
      recommendedWorkloadMpg: avail.recommendedWorkloadMpg,
      maximumWorkloadMpg: avail.maximumWorkloadMpg,
      canPlay: avail.canPlay && !inactiveSet.has(entry.playerId),
    });
  });

  let next: TeamRosterManagement = {
    ...cloneTeamRosterManagement(current),
    rotation: derivedRotation,
    rotationPhilosophy: philosophy,
    rotationStyle: styleFromPhilosophy(philosophy),
    rotationDepth:
      input.rotationDepth ??
      current.rotationDepth ??
      depthForPhilosophy(philosophy),
    rotationPreset: input.rotationPreset ?? "custom",
    closingLineupPolicy:
      input.closingLineupPolicy ?? current.closingLineupPolicy,
    closingLineupIds:
      input.closingLineupIds ?? current.closingLineupIds,
    lastConfiguredBy: "user",
  };

  const redistributed = redistributeRotationForInjuries(
    state,
    input.teamId,
    next,
  );
  next = {
    ...redistributed.management,
    lastConfiguredBy: "user",
  };

  return {
    ok: true,
    state: withTeamRosterManagement(state, input.teamId, next),
  };
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
