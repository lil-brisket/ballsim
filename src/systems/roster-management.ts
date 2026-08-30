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
  listPlayableRosterPlayerIds,
} from "@/systems/player-availability";
import { GAME_SIMULATION_CONFIG } from "@/systems/game-simulation-config";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";
import { deriveRotationConstraints } from "@/systems/rotation/derive-rotation-constraints";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";
import { analyzeRotationHealth } from "@/systems/rotation/rotation-health";
import { redistributeRotationForInjuries } from "@/systems/rotation/rotation-injury-response";
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
  const health = analyzeRotationHealth(state, teamId, management);
  const feedback: RotationFeedback[] = [];

  for (const issue of health.issues) {
    let kind: RotationFeedback["kind"] = "balanced";
    if (issue.code === "too_many") kind = "too_many";
    else if (issue.code === "not_enough") kind = "not_enough";
    else if (issue.code === "unavailable_minutes") kind = "unavailable";
    else if (issue.code === "thin_rotation") kind = "thin_bench";
    else if (issue.code === "workload_exceeded") kind = "high_workload";
    else if (issue.severity === "error") kind = "infeasible";
    feedback.push({ kind, message: issue.message });
  }

  if (health.level === "healthy") {
    feedback.push({
      kind: "balanced",
      message: health.availabilitySummary,
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
  return deriveRotationConstraints({
    playerId,
    targetMinutes: 0,
    role: "emergency",
    preferredPositions,
    canPlay: false,
  });
}

function buildEntryFromTemplate(input: {
  playerId: PlayerId;
  role: RotationRole;
  targetMinutes: number;
  preferredPositions: PlayerPosition[];
  active: boolean;
  recommendedWorkloadMpg?: number | null;
  maximumWorkloadMpg?: number | null;
}): RotationEntry {
  return deriveRotationConstraints({
    playerId: input.playerId,
    targetMinutes: input.active ? input.targetMinutes : 0,
    role: input.role,
    preferredPositions: input.preferredPositions,
    canPlay: input.active,
    recommendedWorkloadMpg: input.recommendedWorkloadMpg,
    maximumWorkloadMpg: input.maximumWorkloadMpg,
  });
}

/**
 * Distribute target minutes across an ordered candidate list for a philosophy/depth.
 * Uses desiredRotationSize = min(12, playable) and tiered meaningful minutes.
 */
export function buildRotationFromRoster(
  entries: Array<{
    playerId: PlayerId;
    isStarter: boolean;
    overall: number;
    preferredPositions: PlayerPosition[];
    /** Development boost: young / high potential. */
    developmentWeight?: number;
    availability?: "available" | "questionable" | "limited" | "out" | "suspended";
    recommendedWorkloadMpg?: number | null;
    maximumWorkloadMpg?: number | null;
    injurySeverity?: "minor" | "moderate" | "major" | "unknown" | null;
  }>,
  philosophy: RotationPhilosophy,
  depth: number,
  target: number = getRegulationTeamMinutesTarget(),
): RotationEntry[] {
  const playable = entries.filter(
    (e) =>
      e.availability !== "out" &&
      e.availability !== "suspended" &&
      (e.availability == null ||
        e.availability === "available" ||
        e.availability === "questionable" ||
        e.availability === "limited"),
  );
  const desiredSize = Math.min(
    Math.max(depth, 5),
    ROTATION_CONFIG.targetRotationPlayerCount,
    playable.length,
  );
  const size = Math.min(Math.max(desiredSize, 5), playable.length);
  const active = playable.slice(0, size);
  if (active.length === 0) {
    return entries.map((e) =>
      emptyInactiveEntry(e.playerId, e.preferredPositions),
    );
  }

  const roleForIndex = (index: number, isStarter: boolean): RotationRole => {
    if (isStarter) return "starter";
    if (index === 5) return "sixth_man";
    if (index <= 7) return "rotation";
    if (index <= 9) return "bench";
    return "bench";
  };

  const starters = active.filter((entry) => entry.isStarter);
  const bench = active.filter((entry) => !entry.isStarter);

  // Starter share — slightly lower than before so depth can receive meaningful minutes
  const starterShare =
    philosophy === "star_heavy"
      ? 0.72
      : philosophy === "deep" || philosophy === "development"
        ? 0.58
        : philosophy === "tight"
          ? 0.68
          : 0.64;
  const starterPool = Math.round(target * starterShare);
  const benchPool = target - starterPool;

  const result: RotationEntry[] = [];
  let assigned = 0;

  // Weight starters by overall
  const starterWeights = starters.map((e) => Math.max(1, e.overall));
  const starterWeightSum = starterWeights.reduce((a, b) => a + b, 0) || 1;

  starters.forEach((entry, index) => {
    let minutes = Math.round(
      (starterPool * starterWeights[index]!) / starterWeightSum,
    );
    minutes = Math.max(26, Math.min(34, minutes));
    if (philosophy === "development" && (entry.developmentWeight ?? 0) > 0.5) {
      minutes = Math.max(24, minutes - 2);
    }
    // Injury risk: pull toward recommended workload
    if (entry.recommendedWorkloadMpg != null) {
      const riskPull =
        entry.injurySeverity === "minor"
          ? 0.7
          : entry.injurySeverity === "moderate"
            ? 0.9
            : 0.5;
      minutes = Math.round(
        minutes * (1 - riskPull) + entry.recommendedWorkloadMpg * riskPull,
      );
    }
    if (
      entry.maximumWorkloadMpg != null &&
      minutes > entry.maximumWorkloadMpg
    ) {
      minutes = entry.maximumWorkloadMpg;
    }
    if (entry.availability === "questionable") {
      minutes = Math.max(
        ROTATION_CONFIG.meaningfulRotationMinutes,
        Math.round(minutes * 0.9),
      );
    }
    assigned += minutes;
    result.push(
      buildEntryFromTemplate({
        playerId: entry.playerId,
        role: "starter",
        targetMinutes: minutes,
        preferredPositions: entry.preferredPositions,
        active: true,
        recommendedWorkloadMpg: entry.recommendedWorkloadMpg,
        maximumWorkloadMpg: entry.maximumWorkloadMpg,
      }),
    );
  });

  // Fix starter pool rounding — redistribute leftover into bench pool
  let effectiveBenchPool = benchPool + (starterPool - assigned);
  if (effectiveBenchPool < 0) {
    // Scale starters down proportionally
    const scale = starterPool / Math.max(assigned, 1);
    let rescaleAssigned = 0;
    for (let i = 0; i < result.length; i++) {
      const scaled = Math.max(
        24,
        Math.round(result[i]!.targetMinutes * scale),
      );
      result[i] = buildEntryFromTemplate({
        playerId: result[i]!.playerId,
        role: "starter",
        targetMinutes: scaled,
        preferredPositions: result[i]!.preferredPositions,
        active: true,
      });
      rescaleAssigned += scaled;
    }
    effectiveBenchPool = target - rescaleAssigned;
  }

  const benchOrdered =
    philosophy === "development"
      ? [...bench].sort(
          (a, b) =>
            (b.developmentWeight ?? 0) - (a.developmentWeight ?? 0) ||
            b.overall - a.overall,
        )
      : bench;

  // Tiered bench: primary (15-24), secondary (6-15), remainder meaningful floor
  const primaryCount = Math.min(4, Math.max(0, benchOrdered.length));
  const secondaryCount = Math.min(
    3,
    Math.max(0, benchOrdered.length - primaryCount),
  );

  const primaryShare = 0.62;
  const secondaryShare = 0.3;
  const primaryPool = Math.round(effectiveBenchPool * primaryShare);
  const secondaryPool = Math.round(effectiveBenchPool * secondaryShare);
  const restPool = effectiveBenchPool - primaryPool - secondaryPool;

  let benchAssigned = 0;

  const assignBenchSlice = (
    slice: typeof benchOrdered,
    pool: number,
    minMpg: number,
    maxMpg: number,
    startIndex: number,
  ) => {
    if (slice.length === 0 || pool <= 0) return;
    const weights = slice.map((e) => Math.max(1, e.overall));
    const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
    slice.forEach((entry, index) => {
      const globalIndex = startIndex + index;
      const role = roleForIndex(globalIndex, false);
      let minutes = Math.round((pool * weights[index]!) / weightSum);
      minutes = Math.max(minMpg, Math.min(maxMpg, minutes));
      if (philosophy === "development" && (entry.developmentWeight ?? 0) > 0.4) {
        minutes = Math.max(minutes, Math.min(18, minutes + 3));
      }
      if (entry.recommendedWorkloadMpg != null) {
        minutes = Math.min(minutes, entry.recommendedWorkloadMpg);
      }
      if (
        entry.maximumWorkloadMpg != null &&
        minutes > entry.maximumWorkloadMpg
      ) {
        minutes = entry.maximumWorkloadMpg;
      }
      // Ensure meaningful minutes — no 1–2 MPG tokens
      if (
        minutes > 0 &&
        minutes < ROTATION_CONFIG.meaningfulRotationMinutes
      ) {
        minutes = ROTATION_CONFIG.meaningfulRotationMinutes;
      }
      benchAssigned += minutes;
      result.push(
        buildEntryFromTemplate({
          playerId: entry.playerId,
          role,
          targetMinutes: minutes,
          preferredPositions: entry.preferredPositions,
          active: minutes > 0,
          recommendedWorkloadMpg: entry.recommendedWorkloadMpg,
          maximumWorkloadMpg: entry.maximumWorkloadMpg,
        }),
      );
    });
  };

  assignBenchSlice(
    benchOrdered.slice(0, primaryCount),
    primaryPool,
    15,
    24,
    starters.length,
  );
  assignBenchSlice(
    benchOrdered.slice(primaryCount, primaryCount + secondaryCount),
    secondaryPool,
    6,
    15,
    starters.length + primaryCount,
  );
  assignBenchSlice(
    benchOrdered.slice(primaryCount + secondaryCount),
    restPool,
    ROTATION_CONFIG.meaningfulRotationMinutes,
    10,
    starters.length + primaryCount + secondaryCount,
  );

  // Remaining roster: inactive / emergency
  const activeIds = new Set(result.map((e) => e.playerId));
  for (const entry of entries) {
    if (activeIds.has(entry.playerId)) continue;
    result.push(
      emptyInactiveEntry(entry.playerId, entry.preferredPositions),
    );
  }

  // Normalize to team target
  const activeResult = result.filter((e) => e.rotationStatus === "active");
  const sum = activeResult.reduce((s, e) => s + e.targetMinutes, 0);
  const delta = target - sum;
  if (delta !== 0 && activeResult.length > 0) {
    // Prefer adjusting middle of bench, not dumping on last player
    const adjustIndex = Math.min(
      activeResult.length - 1,
      Math.max(5, Math.floor(activeResult.length / 2)),
    );
    const adjust = activeResult[adjustIndex]!;
    const nextTarget = Math.max(
      ROTATION_CONFIG.meaningfulRotationMinutes,
      adjust.targetMinutes + delta,
    );
    const idx = result.findIndex((e) => e.playerId === adjust.playerId);
    if (idx >= 0) {
      result[idx] = buildEntryFromTemplate({
        playerId: adjust.playerId,
        role: adjust.role,
        targetMinutes: nextTarget,
        preferredPositions: adjust.preferredPositions,
        active: true,
      });
    }
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

  const available = players.filter((player) =>
    player.availability === "available" ||
    player.availability === "questionable" ||
    player.availability === "limited",
  );
  const injured = players.filter(
    (player) =>
      player.availability === "out" || player.availability === "suspended",
  );

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
        availability: player.availability,
        recommendedWorkloadMpg: player.injury?.recommendedWorkloadMpg ?? null,
        maximumWorkloadMpg: player.injury?.maximumWorkloadMpg ?? null,
        injurySeverity: player.injury?.severity ?? null,
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
        availability: player.availability,
        recommendedWorkloadMpg: player.injury?.recommendedWorkloadMpg ?? null,
        maximumWorkloadMpg: player.injury?.maximumWorkloadMpg ?? null,
        injurySeverity: player.injury?.severity ?? null,
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

  // Depth = min(philosophy depth, playable count, 12)
  const playableCount = listPlayableRosterPlayerIds(state, teamId).length;
  const effectiveDepth = Math.min(
    resolved.depth,
    ROTATION_CONFIG.targetRotationPlayerCount,
    Math.max(playableCount, 5),
  );

  let rotation = buildRotationFromRoster(
    ranked,
    resolved.philosophy,
    effectiveDepth,
  );

  // Also include inactive injured players as emergency entries
  for (const playerId of inactive) {
    if (!rotation.some((e) => e.playerId === playerId)) {
      const player = state.world.players[playerId];
      rotation.push(
        emptyInactiveEntry(
          playerId,
          player ? defaultPreferredPositions(player) : ["SF"],
        ),
      );
    }
  }

  const baseManagement: TeamRosterManagement = {
    startingLineup,
    bench,
    inactive,
    rotation,
    rotationStyle: resolved.style,
    rotationPhilosophy: resolved.philosophy,
    rotationDepth: effectiveDepth,
    rotationPreset: resolved.preset,
    closingLineupPolicy: team.rosterManagement.closingLineupPolicy,
    closingLineupIds: [...team.rosterManagement.closingLineupIds],
    lastConfiguredBy: options.configuredBy ?? "ai",
  };

  const redistributed = redistributeRotationForInjuries(
    state,
    teamId,
    baseManagement,
  );

  return {
    ...redistributed.management,
    lastConfiguredBy: options.configuredBy ?? "ai",
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

export type OptimizeChange = {
  kind:
    | "minutes"
    | "role"
    | "added"
    | "removed"
    | "depth"
    | "coverage"
    | "other";
  message: string;
  playerId?: PlayerId;
};

/**
 * Preview Auto Optimize without persisting — returns changelog for UI undo/summary.
 */
export function previewOptimizeRotation(
  state: GameState,
  teamId: TeamId,
  options: Parameters<typeof recommendRosterManagement>[2] = {},
): {
  management: TeamRosterManagement;
  changelog: OptimizeChange[];
} {
  const before = getTeamRosterManagement(state, teamId);
  const management = optimizeRotationFromRoster(state, teamId, options);
  const changelog: OptimizeChange[] = [];

  const beforeById = new Map(
    before.rotation.map((e) => [e.playerId as string, e]),
  );
  const afterById = new Map(
    management.rotation.map((e) => [e.playerId as string, e]),
  );

  let beforeMeaningful = 0;
  let afterMeaningful = 0;

  for (const [playerId, after] of afterById) {
    const prev = beforeById.get(playerId);
    const player = state.world.players[playerId as PlayerId];
    const name = player
      ? `${player.firstName} ${player.lastName}`
      : playerId;
    if (after.targetMinutes >= ROTATION_CONFIG.meaningfulRotationMinutes) {
      afterMeaningful += 1;
    }
    if (prev == null) {
      if (after.targetMinutes > 0) {
        changelog.push({
          kind: "added",
          message: `Added ${name} to meaningful rotation`,
          playerId: after.playerId,
        });
      }
      continue;
    }
    if (prev.targetMinutes >= ROTATION_CONFIG.meaningfulRotationMinutes) {
      beforeMeaningful += 1;
    }
    if (prev.targetMinutes !== after.targetMinutes) {
      changelog.push({
        kind: "minutes",
        message: `${prev.targetMinutes < after.targetMinutes ? "Increased" : "Reduced"} ${name}: ${prev.targetMinutes} → ${after.targetMinutes} MPG`,
        playerId: after.playerId,
      });
    }
    if (prev.role !== after.role) {
      changelog.push({
        kind: "role",
        message: `Changed ${name} role: ${prev.role} → ${after.role}`,
        playerId: after.playerId,
      });
    }
  }

  if (beforeMeaningful !== afterMeaningful) {
    changelog.push({
      kind: "depth",
      message: `Expanded rotation from ${beforeMeaningful} → ${afterMeaningful} players`,
    });
  }

  if (changelog.length === 0) {
    changelog.push({
      kind: "other",
      message: "Rotation already optimized — no changes needed",
    });
  }

  return { management, changelog };
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
      if (
        player?.availability === "out" ||
        player?.availability === "suspended"
      ) {
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
