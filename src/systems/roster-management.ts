/**
 * Team roster management: recommend, validate, reconcile, emergency lineup.
 * Lineup configuration only — Team.roster + Player.teamId own membership.
 */

import {
  PLAYER_POSITIONS,
  type Player,
  type PlayerPosition,
} from "@/domain/entities/player";
import {
  cloneTeamRosterManagement,
  depthForPhilosophy,
  emptyTeamRosterManagement,
  philosophyFromStyle,
  styleFromPhilosophy,
  type LineupSlot,
  type RotationEntry,
  type RotationPhilosophy,
  type RotationPreset,
  type RotationRole,
  type RotationStyle,
  type TeamRosterManagement,
} from "@/domain/entities/team-roster-management";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  getPlayerAvailability,
  isPlayerAvailable,
  listAvailableRosterPlayerIds,
} from "@/systems/player-availability";
import { GAME_SIMULATION_CONFIG } from "@/systems/game-simulation-config";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";
import { ROLE_TEMPLATES } from "@/systems/rotation/rotation-role-templates";
import {
  formatFeasibilityBanner,
  hasHardFeasibilityIssues,
  validateRotationFeasibility,
} from "@/systems/rotation/rotation-feasibility";

export type RosterManagementValidationIssue = {
  code: string;
  message: string;
};

export type PlannedMinutesValidation = {
  totalPlanned: number;
  target: number;
  delta: number;
  valid: boolean;
  issues: RosterManagementValidationIssue[];
};

export type RotationFeedback = {
  kind:
    | "balanced"
    | "too_many"
    | "not_enough"
    | "unavailable"
    | "high_workload"
    | "thin_bench"
    | "infeasible";
  message: string;
  playerId?: PlayerId;
};

export type EmergencyLineupResult = {
  players: Player[];
  slots: LineupSlot[];
  emergency: boolean;
};

const HIGH_WORKLOAD_MINUTES = 38;

/**
 * Regulation team-minutes target derived from sim config (240 for standard rules).
 */
export function getRegulationTeamMinutesTarget(
  config: {
    startingLineupSize: number;
    regulationPeriodCount: number;
    regulationPeriodSeconds: number;
  } = GAME_SIMULATION_CONFIG,
): number {
  return (
    (config.startingLineupSize *
      config.regulationPeriodCount *
      config.regulationPeriodSeconds) /
    60
  );
}

export function getTeamRosterManagement(
  state: GameState,
  teamId: TeamId,
): TeamRosterManagement {
  const team = state.world.teams[teamId];
  if (team == null) {
    return emptyTeamRosterManagement();
  }
  return cloneTeamRosterManagement(team.rosterManagement);
}

export function withTeamRosterManagement(
  state: GameState,
  teamId: TeamId,
  management: TeamRosterManagement,
): GameState {
  const team = state.world.teams[teamId];
  if (team == null) {
    throw new Error(`Team "${teamId}" not found.`);
  }
  return {
    ...state,
    world: {
      ...state.world,
      teams: {
        ...state.world.teams,
        [teamId]: {
          ...team,
          rosterManagement: cloneTeamRosterManagement(management),
        },
      },
    },
  };
}

export function validateRosterManagementShape(
  state: GameState,
  teamId: TeamId,
  management: TeamRosterManagement = getTeamRosterManagement(state, teamId),
): RosterManagementValidationIssue[] {
  const team = state.world.teams[teamId];
  if (team == null) {
    return [{ code: "team_missing", message: `Team "${teamId}" not found.` }];
  }

  const issues: RosterManagementValidationIssue[] = [];
  const rosterSet = new Set(team.roster.map(String));
  const seen = new Set<string>();

  const checkMembership = (
    playerId: PlayerId,
    group: string,
  ): void => {
    if (!rosterSet.has(playerId)) {
      issues.push({
        code: "not_on_roster",
        message: `Player ${playerId} in ${group} is not on the roster.`,
      });
    }
    if (seen.has(playerId)) {
      issues.push({
        code: "duplicate_group",
        message: `Player ${playerId} appears in multiple roster groups.`,
      });
    }
    seen.add(playerId);
  };

  for (const slot of management.startingLineup) {
    checkMembership(slot.playerId, "starting lineup");
    const availability = getPlayerAvailability(state, slot.playerId, teamId);
    if (!availability.available && availability.reason !== "inactive") {
      if (availability.reason === "injured") {
        issues.push({
          code: "unavailable_starter",
          message: `Starter ${slot.playerId} is unavailable (${availability.label}).`,
        });
      }
    }
  }

  for (const playerId of management.bench) {
    checkMembership(playerId, "bench");
  }
  for (const playerId of management.inactive) {
    checkMembership(playerId, "inactive");
  }

  for (const playerId of team.roster) {
    if (!seen.has(playerId)) {
      issues.push({
        code: "unassigned",
        message: `Roster player ${playerId} is not assigned to a roster group.`,
      });
    }
  }

  const starterIds = new Set(
    management.startingLineup.map((slot) => slot.playerId),
  );
  const benchSet = new Set(management.bench);
  const inactiveSet = new Set(management.inactive);

  for (const entry of management.rotation) {
    if (inactiveSet.has(entry.playerId)) {
      issues.push({
        code: "inactive_in_rotation",
        message: `Inactive player ${entry.playerId} cannot appear in rotation.`,
      });
    }
    if (
      !starterIds.has(entry.playerId) &&
      !benchSet.has(entry.playerId)
    ) {
      issues.push({
        code: "rotation_not_active",
        message: `Rotation entry ${entry.playerId} must be a starter or bench player.`,
      });
    }
    if (inactiveSet.has(entry.playerId) && entry.targetMinutes > 0) {
      issues.push({
        code: "inactive_minutes",
        message: `Inactive player ${entry.playerId} cannot have target minutes > 0.`,
      });
    }
    if (entry.preferredPositions.length === 0) {
      issues.push({
        code: "no_eligible_positions",
        message: `Rotation entry ${entry.playerId} needs at least one preferred position.`,
      });
    }
  }

  for (const playerId of management.inactive) {
    const rotationEntry = management.rotation.find(
      (entry) => entry.playerId === playerId,
    );
    if (rotationEntry != null && rotationEntry.targetMinutes > 0) {
      issues.push({
        code: "inactive_minutes",
        message: `Inactive player ${playerId} cannot have target minutes > 0.`,
      });
    }
  }

  const expectedStarters = TRADE_ROSTER_RULES.startingLineupSize;
  if (
    management.startingLineup.length !== expectedStarters &&
    team.roster.length >= expectedStarters
  ) {
    issues.push({
      code: "starter_count",
      message: `Starting lineup must contain exactly ${expectedStarters} players when roster allows.`,
    });
  }

  const slotPositions = management.startingLineup.map((slot) => slot.slot);
  const uniqueSlots = new Set(slotPositions);
  if (slotPositions.length === expectedStarters && uniqueSlots.size !== expectedStarters) {
    issues.push({
      code: "duplicate_slots",
      message: "Starting lineup slots must be unique (PG, SG, SF, PF, C).",
    });
  }

  return issues;
}

export function validatePlannedMinutes(
  management: TeamRosterManagement,
  target: number = getRegulationTeamMinutesTarget(),
): PlannedMinutesValidation {
  const totalPlanned = management.rotation.reduce(
    (sum, entry) => sum + entry.targetMinutes,
    0,
  );
  const delta = totalPlanned - target;
  const issues: RosterManagementValidationIssue[] = [];
  if (delta !== 0) {
    issues.push({
      code: delta > 0 ? "too_many_minutes" : "not_enough_minutes",
      message:
        delta > 0
          ? `Target minutes (${totalPlanned}) exceed team target (${target}) by ${delta}.`
          : `Target minutes (${totalPlanned}) are ${-delta} under team target (${target}).`,
    });
  }
  for (const entry of management.rotation) {
    if (entry.targetMinutes > HIGH_WORKLOAD_MINUTES) {
      issues.push({
        code: "high_workload",
        message: `Player ${entry.playerId} has an unusually high workload (${entry.targetMinutes} minutes).`,
      });
    }
  }
  const feasibility = validateRotationFeasibility(management);
  for (const issue of feasibility.issues) {
    if (
      issue.code === "maximums_below_available" ||
      issue.code === "minimums_exceed_available" ||
      issue.code === "all_targets_zero" ||
      issue.code === "insufficient_active"
    ) {
      issues.push({ code: issue.code, message: issue.message });
    }
  }
  return {
    totalPlanned,
    target,
    delta,
    valid: delta === 0 && !hasHardFeasibilityIssues(feasibility),
    issues,
  };
}

export function getRotationFeedback(
  state: GameState,
  teamId: TeamId,
  management: TeamRosterManagement = getTeamRosterManagement(state, teamId),
): RotationFeedback[] {
  const feedback: RotationFeedback[] = [];
  const minutes = validatePlannedMinutes(management);
  const feasibility = validateRotationFeasibility(management);
  const banner = formatFeasibilityBanner(feasibility);
  if (banner != null) {
    feedback.push({
      kind: "infeasible",
      message: banner,
    });
  }

  if (minutes.delta === 0 && banner == null) {
    feedback.push({
      kind: "balanced",
      message: "Minutes are balanced.",
    });
  } else if (minutes.delta > 0) {
    feedback.push({
      kind: "too_many",
      message: `Too many minutes assigned (${minutes.totalPlanned} / ${minutes.target}).`,
    });
  } else if (minutes.delta < 0) {
    feedback.push({
      kind: "not_enough",
      message: `Not enough minutes assigned (${minutes.totalPlanned} / ${minutes.target}).`,
    });
  }

  for (const entry of management.rotation) {
    if (entry.targetMinutes <= 0) {
      continue;
    }
    const availability = getPlayerAvailability(state, entry.playerId, teamId);
    if (!availability.available) {
      feedback.push({
        kind: "unavailable",
        message: `${entry.playerId} is unavailable (${availability.label}) but has target minutes.`,
        playerId: entry.playerId,
      });
    }
    if (entry.targetMinutes > HIGH_WORKLOAD_MINUTES) {
      feedback.push({
        kind: "high_workload",
        message: `Unusually high workload (${entry.targetMinutes} target minutes).`,
        playerId: entry.playerId,
      });
    }
  }

  const activeCount = management.rotation.filter(
    (entry) => entry.rotationStatus === "active",
  ).length;
  if (activeCount < 7 && management.rotation.length > 0) {
    feedback.push({
      kind: "thin_bench",
      message: "Bench depth is insufficient for a sustainable rotation.",
    });
  }

  return feedback;
}

function playerOverall(player: Player): number {
  return calculatePlayerOverall(player.position, player.attributes);
}

function defaultPreferredPositions(player: Player): PlayerPosition[] {
  const primary = player.position;
  const index = PLAYER_POSITIONS.indexOf(primary);
  const eligible: PlayerPosition[] = [primary];
  if (index > 0) {
    eligible.push(PLAYER_POSITIONS[index - 1]!);
  }
  if (index < PLAYER_POSITIONS.length - 1) {
    eligible.push(PLAYER_POSITIONS[index + 1]!);
  }
  return [...new Set(eligible)];
}

function emptyInactiveEntry(
  playerId: PlayerId,
  preferredPositions: PlayerPosition[],
): RotationEntry {
  const template = ROLE_TEMPLATES.emergency;
  return {
    playerId,
    targetMinutes: 0,
    minimumMinutes: 0,
    normalMaximumMinutes: template.normalMax,
    absoluteMaximumMinutes: template.absoluteMax,
    rotationPriority: template.priority,
    rotationStatus: "inactive",
    role: "emergency",
    preferredPositions,
    secondaryPositions: [],
    minutePriorityBias: 0,
  };
}

function buildEntryFromTemplate(input: {
  playerId: PlayerId;
  role: RotationRole;
  targetMinutes: number;
  preferredPositions: PlayerPosition[];
  active: boolean;
}): RotationEntry {
  const template = ROLE_TEMPLATES[input.role];
  return {
    playerId: input.playerId,
    targetMinutes: input.targetMinutes,
    minimumMinutes: input.active ? template.min : 0,
    normalMaximumMinutes: Math.max(input.targetMinutes, template.normalMax),
    absoluteMaximumMinutes: Math.max(
      input.targetMinutes,
      template.absoluteMax,
    ),
    rotationPriority: template.priority,
    rotationStatus: input.active ? "active" : "inactive",
    role: input.role,
    preferredPositions: input.preferredPositions,
    secondaryPositions: [],
    minutePriorityBias: 0,
  };
}

/**
 * Distribute target minutes across an ordered candidate list for a philosophy/depth.
 */
export function buildRotationFromRoster(
  entries: Array<{
    playerId: PlayerId;
    isStarter: boolean;
    overall: number;
    preferredPositions: PlayerPosition[];
    /** Development boost: young / high potential. */
    developmentWeight?: number;
  }>,
  philosophy: RotationPhilosophy,
  depth: number,
  target: number = getRegulationTeamMinutesTarget(),
): RotationEntry[] {
  const size = Math.min(Math.max(depth, 5), entries.length);
  const active = entries.slice(0, size);
  if (active.length === 0) {
    return [];
  }

  // Role assignment by index within active pool
  const roleForIndex = (index: number, isStarter: boolean): RotationRole => {
    if (isStarter) {
      return "starter";
    }
    if (index === 5) {
      return "sixth_man";
    }
    if (index <= 7) {
      return "rotation";
    }
    if (index <= 9) {
      return "bench";
    }
    return "deep_bench";
  };

  const starters = active.filter((entry) => entry.isStarter);
  const bench = active.filter((entry) => !entry.isStarter);

  const starterShare =
    philosophy === "star_heavy"
      ? 0.8
      : philosophy === "deep" || philosophy === "development"
        ? 0.65
        : philosophy === "tight"
          ? 0.76
          : 0.72;
  const starterPool = Math.round(target * starterShare);
  const benchPool = target - starterPool;

  const result: RotationEntry[] = [];
  let assigned = 0;

  starters.forEach((entry, index) => {
    const remainingPlayers = starters.length - index;
    const remainingPool = starterPool - assigned;
    let minutes =
      remainingPlayers === 1
        ? remainingPool
        : Math.max(28, Math.floor(remainingPool / remainingPlayers));
    if (philosophy === "development" && (entry.developmentWeight ?? 0) > 0.5) {
      minutes = Math.max(24, minutes - 2);
    }
    assigned += minutes;
    result.push(
      buildEntryFromTemplate({
        playerId: entry.playerId,
        role: "starter",
        targetMinutes: minutes,
        preferredPositions: entry.preferredPositions,
        active: true,
      }),
    );
  });

  // Development: sort bench by development weight so prospects get more
  const benchOrdered =
    philosophy === "development"
      ? [...bench].sort(
          (a, b) =>
            (b.developmentWeight ?? 0) - (a.developmentWeight ?? 0) ||
            b.overall - a.overall,
        )
      : bench;

  let benchAssigned = 0;
  benchOrdered.forEach((entry, index) => {
    const globalIndex = starters.length + index;
    const role = roleForIndex(globalIndex, false);
    const remainingPlayers = benchOrdered.length - index;
    const remainingPool = benchPool - benchAssigned;
    let minutes =
      remainingPlayers === 1
        ? Math.max(0, remainingPool)
        : Math.max(0, Math.floor(remainingPool / remainingPlayers));
    if (philosophy === "development" && (entry.developmentWeight ?? 0) > 0.4) {
      minutes = Math.max(minutes, Math.min(18, minutes + 3));
    }
    benchAssigned += minutes;
    result.push(
      buildEntryFromTemplate({
        playerId: entry.playerId,
        role,
        targetMinutes: minutes,
        preferredPositions: entry.preferredPositions,
        active: minutes > 0,
      }),
    );
  });

  // Remaining roster: inactive / emergency
  for (const entry of entries.slice(size)) {
    result.push(
      emptyInactiveEntry(entry.playerId, entry.preferredPositions),
    );
  }

  // Fix rounding so targets sum to team target
  const activeResult = result.filter((e) => e.rotationStatus === "active");
  const sum = activeResult.reduce((s, e) => s + e.targetMinutes, 0);
  const delta = target - sum;
  if (delta !== 0 && activeResult.length > 0) {
    const adjust = activeResult[activeResult.length - 1]!;
    adjust.targetMinutes = Math.max(0, adjust.targetMinutes + delta);
    adjust.normalMaximumMinutes = Math.max(
      adjust.targetMinutes,
      adjust.normalMaximumMinutes,
    );
    adjust.absoluteMaximumMinutes = Math.max(
      adjust.targetMinutes,
      adjust.absoluteMaximumMinutes,
    );
  }

  return result;
}

export function resolvePhilosophyAndDepth(options: {
  rotationStyle?: RotationStyle;
  rotationPhilosophy?: RotationPhilosophy;
  rotationDepth?: number;
  rotationPreset?: RotationPreset;
  existing?: TeamRosterManagement;
}): {
  philosophy: RotationPhilosophy;
  depth: number;
  style: RotationStyle;
  preset: RotationPreset;
} {
  const preset = options.rotationPreset ?? options.existing?.rotationPreset ?? "balanced";
  let philosophy =
    options.rotationPhilosophy ??
    options.existing?.rotationPhilosophy ??
    (options.rotationStyle
      ? philosophyFromStyle(options.rotationStyle)
      : options.existing?.rotationStyle
        ? philosophyFromStyle(options.existing.rotationStyle)
        : "balanced");

  if (preset === "star_heavy") {
    philosophy = "star_heavy";
  } else if (preset === "deep") {
    philosophy = "deep";
  } else if (preset === "development") {
    philosophy = "development";
  } else if (preset === "balanced") {
    philosophy = "balanced";
  }

  const depth =
    options.rotationDepth ??
    options.existing?.rotationDepth ??
    depthForPhilosophy(philosophy);

  return {
    philosophy,
    depth,
    style: styleFromPhilosophy(philosophy),
    preset,
  };
}

/**
 * Position-aware recommended lineup / rotation from current roster + availability.
 * Used by both user Auto Optimize and AI teams.
 */
export function recommendRosterManagement(
  state: GameState,
  teamId: TeamId,
  options: {
    rotationStyle?: RotationStyle;
    rotationPhilosophy?: RotationPhilosophy;
    rotationDepth?: number;
    rotationPreset?: RotationPreset;
    configuredBy?: TeamRosterManagement["lastConfiguredBy"];
  } = {},
): TeamRosterManagement {
  const team = state.world.teams[teamId];
  if (team == null) {
    return emptyTeamRosterManagement();
  }

  const resolved = resolvePhilosophyAndDepth({
    ...options,
    existing: team.rosterManagement,
  });

  const players = team.roster
    .map((playerId) => state.world.players[playerId])
    .filter((player): player is Player => player != null)
    .sort((a, b) => playerOverall(b) - playerOverall(a));

  const available = players.filter(
    (player) => player.injury.kind === "healthy",
  );
  const injured = players.filter((player) => player.injury.kind === "injured");

  const used = new Set<string>();
  const startingLineup: LineupSlot[] = [];

  for (const slot of PLAYER_POSITIONS) {
    const candidate =
      available.find(
        (player) => player.position === slot && !used.has(player.id),
      ) ??
      available.find((player) => !used.has(player.id));
    if (candidate == null) {
      break;
    }
    used.add(candidate.id);
    startingLineup.push({ playerId: candidate.id, slot });
  }

  while (startingLineup.length < TRADE_ROSTER_RULES.startingLineupSize) {
    const candidate = available.find((player) => !used.has(player.id));
    if (candidate == null) {
      break;
    }
    const usedSlots = new Set(startingLineup.map((entry) => entry.slot));
    const slot =
      PLAYER_POSITIONS.find((position) => !usedSlots.has(position)) ?? "SF";
    used.add(candidate.id);
    startingLineup.push({ playerId: candidate.id, slot });
  }

  const bench: PlayerId[] = [];
  const inactive: PlayerId[] = [];

  for (const player of available) {
    if (used.has(player.id)) {
      continue;
    }
    bench.push(player.id);
    used.add(player.id);
  }

  for (const player of injured) {
    if (!used.has(player.id)) {
      inactive.push(player.id);
      used.add(player.id);
    }
  }

  for (const player of players) {
    if (!used.has(player.id)) {
      bench.push(player.id);
      used.add(player.id);
    }
  }

  const rotationCandidates = [
    ...startingLineup.map((slot) => {
      const player = state.world.players[slot.playerId]!;
      return {
        playerId: slot.playerId,
        isStarter: true,
        overall: playerOverall(player),
        preferredPositions: defaultPreferredPositions(player),
        developmentWeight: developmentWeight(player),
      };
    }),
    ...bench.map((playerId) => {
      const player = state.world.players[playerId]!;
      return {
        playerId,
        isStarter: false,
        overall: playerOverall(player),
        preferredPositions: defaultPreferredPositions(player),
        developmentWeight: developmentWeight(player),
      };
    }),
  ].sort((a, b) => {
    if (a.isStarter !== b.isStarter) {
      return a.isStarter ? -1 : 1;
    }
    return b.overall - a.overall;
  });

  // For depth ranking: overall order with starters first already
  const ranked = [
    ...rotationCandidates.filter((e) => e.isStarter),
    ...rotationCandidates
      .filter((e) => !e.isStarter)
      .sort((a, b) => {
        if (resolved.philosophy === "development") {
          return (
            (b.developmentWeight ?? 0) - (a.developmentWeight ?? 0) ||
            b.overall - a.overall
          );
        }
        return b.overall - a.overall;
      }),
  ];

  const rotation = buildRotationFromRoster(
    ranked,
    resolved.philosophy,
    resolved.depth,
  );

  return {
    startingLineup,
    bench,
    inactive,
    rotation,
    rotationStyle: resolved.style,
    rotationPhilosophy: resolved.philosophy,
    rotationDepth: resolved.depth,
    rotationPreset: options.rotationPreset ?? resolved.preset,
    closingLineupPolicy: team.rosterManagement.closingLineupPolicy ?? "auto",
    closingLineupIds: [...(team.rosterManagement.closingLineupIds ?? [])],
    lastConfiguredBy: options.configuredBy ?? "default",
  };
}

function developmentWeight(player: Player): number {
  const age = player.age ?? 28;
  const potential = player.potential.overall;
  const youth = age <= 23 ? 1 : age <= 25 ? 0.6 : age <= 27 ? 0.3 : 0;
  const pot = Math.max(0, (potential - 55) / 40);
  return youth * 0.6 + pot * 0.4;
}

/** Alias used by UI Auto Optimize — same pipeline as AI. */
export function optimizeRotationFromRoster(
  state: GameState,
  teamId: TeamId,
  options: Parameters<typeof recommendRosterManagement>[2] = {},
): TeamRosterManagement {
  return recommendRosterManagement(state, teamId, {
    ...options,
    configuredBy: options?.configuredBy ?? "user",
  });
}

/**
 * After roster membership changes: drop departed players, add newcomers, repair if invalid.
 */
export function reconcileRosterManagement(
  state: GameState,
  teamId: TeamId,
): GameState {
  const team = state.world.teams[teamId];
  if (team == null) {
    return state;
  }

  const rosterSet = new Set(team.roster.map(String));
  const previous = cloneTeamRosterManagement(team.rosterManagement);

  const startingLineup = previous.startingLineup.filter((slot) =>
    rosterSet.has(slot.playerId),
  );
  const bench = previous.bench.filter((playerId) => rosterSet.has(playerId));
  const inactive = previous.inactive.filter((playerId) =>
    rosterSet.has(playerId),
  );
  const rotation = previous.rotation.filter((entry) =>
    rosterSet.has(entry.playerId),
  );

  const assigned = new Set<string>([
    ...startingLineup.map((slot) => slot.playerId),
    ...bench,
    ...inactive,
  ]);

  for (const playerId of team.roster) {
    if (!assigned.has(playerId)) {
      const player = state.world.players[playerId];
      if (player?.injury.kind === "injured") {
        inactive.push(playerId);
      } else {
        bench.push(playerId);
        rotation.push(
          emptyInactiveEntry(
            playerId,
            player ? defaultPreferredPositions(player) : ["SF"],
          ),
        );
      }
      assigned.add(playerId);
    }
  }

  let next: TeamRosterManagement = {
    startingLineup,
    bench,
    inactive,
    rotation,
    rotationStyle: previous.rotationStyle,
    rotationPhilosophy: previous.rotationPhilosophy,
    rotationDepth: previous.rotationDepth,
    rotationPreset: previous.rotationPreset,
    closingLineupPolicy: previous.closingLineupPolicy,
    closingLineupIds: previous.closingLineupIds.filter((id) =>
      rosterSet.has(id),
    ),
    lastConfiguredBy: previous.lastConfiguredBy,
  };

  const issues = validateRosterManagementShape(
    withTeamRosterManagement(state, teamId, next),
    teamId,
    next,
  );
  const needsRecommend =
    issues.some(
      (issue) =>
        issue.code === "starter_count" ||
        issue.code === "unavailable_starter" ||
        issue.code === "duplicate_group" ||
        issue.code === "unassigned" ||
        issue.code === "duplicate_slots",
    ) ||
    startingLineup.length < TRADE_ROSTER_RULES.startingLineupSize;

  if (needsRecommend) {
    next = recommendRosterManagement(state, teamId, {
      rotationStyle: previous.rotationStyle,
      rotationPhilosophy: previous.rotationPhilosophy,
      rotationDepth: previous.rotationDepth,
      configuredBy: "default",
    });
  }

  return withTeamRosterManagement(state, teamId, next);
}

/**
 * Never crashes simulation. Marks emergency when fewer than 5 healthy/available.
 */
export function getEmergencyLineup(
  state: GameState,
  teamId: TeamId,
): EmergencyLineupResult {
  const team = state.world.teams[teamId];
  if (team == null) {
    return { players: [], slots: [], emergency: true };
  }

  const management = team.rosterManagement;
  const size = TRADE_ROSTER_RULES.startingLineupSize;
  const availableIds = listAvailableRosterPlayerIds(state, teamId);

  const savedValid =
    management.startingLineup.length === size &&
    management.startingLineup.every((slot) =>
      isPlayerAvailable(state, slot.playerId, teamId),
    ) &&
    new Set(management.startingLineup.map((slot) => slot.slot)).size === size;

  if (savedValid && availableIds.length >= size) {
    const players = management.startingLineup.map(
      (slot) => state.world.players[slot.playerId]!,
    );
    return {
      players,
      slots: management.startingLineup.map((slot) => ({ ...slot })),
      emergency: false,
    };
  }

  if (availableIds.length >= size) {
    const recommended = recommendRosterManagement(state, teamId);
    const players = recommended.startingLineup.map(
      (slot) => state.world.players[slot.playerId]!,
    );
    return {
      players,
      slots: recommended.startingLineup.map((slot) => ({ ...slot })),
      emergency: false,
    };
  }

  const rosterPlayers = team.roster
    .map((playerId) => state.world.players[playerId])
    .filter((player): player is Player => player != null)
    .sort((a, b) => {
      const aAvail = isPlayerAvailable(state, a.id, teamId) ? 1 : 0;
      const bAvail = isPlayerAvailable(state, b.id, teamId) ? 1 : 0;
      if (aAvail !== bAvail) {
        return bAvail - aAvail;
      }
      return playerOverall(b) - playerOverall(a);
    });

  const selected = rosterPlayers.slice(0, Math.min(size, rosterPlayers.length));
  const slots: LineupSlot[] = selected.map((player, index) => ({
    playerId: player.id,
    slot: PLAYER_POSITIONS[index] ?? "SF",
  }));

  return {
    players: selected,
    slots,
    emergency: true,
  };
}

export function applyRosterManagement(
  state: GameState,
  teamId: TeamId,
  management: TeamRosterManagement,
): GameState {
  const issues = validateRosterManagementShape(state, teamId, management);
  const blocking = issues.filter(
    (issue) =>
      issue.code === "not_on_roster" ||
      issue.code === "duplicate_group" ||
      issue.code === "unavailable_starter" ||
      issue.code === "inactive_minutes",
  );
  if (blocking.length > 0) {
    throw new Error(blocking.map((issue) => issue.message).join(" "));
  }
  return withTeamRosterManagement(state, teamId, {
    ...cloneTeamRosterManagement(management),
    lastConfiguredBy: management.lastConfiguredBy,
  });
}
