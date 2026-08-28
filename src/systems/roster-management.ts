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
  emptyTeamRosterManagement,
  type LineupSlot,
  type RotationEntry,
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
    | "thin_bench";
  message: string;
  playerId?: PlayerId;
};

export type EmergencyLineupResult = {
  players: Player[];
  slots: LineupSlot[];
  emergency: boolean;
};

const HIGH_WORKLOAD_MINUTES = 38;
const TIGHT_ROTATION_SIZE = 7;
const BALANCED_ROTATION_SIZE = 8;
const DEEP_ROTATION_SIZE = 10;

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
      // inactive check is via group membership; injured still invalid as starter
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
    if (inactiveSet.has(entry.playerId) && entry.plannedMinutes > 0) {
      issues.push({
        code: "inactive_minutes",
        message: `Inactive player ${entry.playerId} cannot have planned minutes > 0.`,
      });
    }
    if (entry.eligiblePositions.length === 0) {
      issues.push({
        code: "no_eligible_positions",
        message: `Rotation entry ${entry.playerId} needs at least one eligible position.`,
      });
    }
  }

  for (const playerId of management.inactive) {
    const rotationEntry = management.rotation.find(
      (entry) => entry.playerId === playerId,
    );
    if (rotationEntry != null && rotationEntry.plannedMinutes > 0) {
      issues.push({
        code: "inactive_minutes",
        message: `Inactive player ${playerId} cannot have planned minutes > 0.`,
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
    (sum, entry) => sum + entry.plannedMinutes,
    0,
  );
  const delta = totalPlanned - target;
  const issues: RosterManagementValidationIssue[] = [];
  if (delta !== 0) {
    issues.push({
      code: delta > 0 ? "too_many_minutes" : "not_enough_minutes",
      message:
        delta > 0
          ? `Planned minutes (${totalPlanned}) exceed target (${target}) by ${delta}.`
          : `Planned minutes (${totalPlanned}) are ${-delta} under target (${target}).`,
    });
  }
  for (const entry of management.rotation) {
    if (entry.plannedMinutes > HIGH_WORKLOAD_MINUTES) {
      issues.push({
        code: "high_workload",
        message: `Player ${entry.playerId} has an unusually high workload (${entry.plannedMinutes} minutes).`,
      });
    }
  }
  return {
    totalPlanned,
    target,
    delta,
    valid: delta === 0,
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
  if (minutes.delta === 0) {
    feedback.push({
      kind: "balanced",
      message: "Minutes are balanced.",
    });
  } else if (minutes.delta > 0) {
    feedback.push({
      kind: "too_many",
      message: `Too many minutes assigned (${minutes.totalPlanned} / ${minutes.target}).`,
    });
  } else {
    feedback.push({
      kind: "not_enough",
      message: `Not enough minutes assigned (${minutes.totalPlanned} / ${minutes.target}).`,
    });
  }

  for (const entry of management.rotation) {
    if (entry.plannedMinutes <= 0) {
      continue;
    }
    const availability = getPlayerAvailability(state, entry.playerId, teamId);
    if (!availability.available) {
      feedback.push({
        kind: "unavailable",
        message: `${entry.playerId} is unavailable (${availability.label}) but has planned minutes.`,
        playerId: entry.playerId,
      });
    }
    if (entry.plannedMinutes > HIGH_WORKLOAD_MINUTES) {
      feedback.push({
        kind: "high_workload",
        message: `Unusually high workload (${entry.plannedMinutes} planned minutes).`,
        playerId: entry.playerId,
      });
    }
  }

  const activeWithMinutes = management.rotation.filter(
    (entry) => entry.plannedMinutes > 0,
  ).length;
  if (activeWithMinutes < TIGHT_ROTATION_SIZE && management.rotation.length > 0) {
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

function defaultEligiblePositions(player: Player): PlayerPosition[] {
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

function rotationSizeForStyle(style: RotationStyle): number {
  if (style === "tight") {
    return TIGHT_ROTATION_SIZE;
  }
  if (style === "deep") {
    return DEEP_ROTATION_SIZE;
  }
  return BALANCED_ROTATION_SIZE;
}

function distributePlannedMinutes(
  entries: Array<{ playerId: PlayerId; role: "starter" | "bench"; overall: number }>,
  style: RotationStyle,
  target: number = getRegulationTeamMinutesTarget(),
): RotationEntry[] {
  const size = Math.min(rotationSizeForStyle(style), entries.length);
  const active = entries.slice(0, size);
  if (active.length === 0) {
    return [];
  }

  const starterCount = active.filter((entry) => entry.role === "starter").length;
  const benchCount = active.length - starterCount;
  const starterShare = starterCount > 0 ? 0.72 : 0;
  const benchShare = 1 - starterShare;

  const starterPool = Math.round(target * starterShare);
  const benchPool = target - starterPool;

  const result: RotationEntry[] = [];
  const starters = active.filter((entry) => entry.role === "starter");
  const bench = active.filter((entry) => entry.role === "bench");

  let assigned = 0;
  starters.forEach((entry, index) => {
    const remainingPlayers = starters.length - index;
    const remainingPool = starterPool - assigned;
    const minutes =
      remainingPlayers === 1
        ? remainingPool
        : Math.max(18, Math.floor(remainingPool / remainingPlayers));
    assigned += minutes;
    result.push({
      playerId: entry.playerId,
      plannedMinutes: minutes,
      eligiblePositions: [],
      role: "starter",
    });
  });

  let benchAssigned = 0;
  bench.forEach((entry, index) => {
    const remainingPlayers = bench.length - index;
    const remainingPool = benchPool - benchAssigned;
    const minutes =
      remainingPlayers === 1
        ? Math.max(0, remainingPool)
        : Math.max(0, Math.floor(remainingPool / remainingPlayers));
    benchAssigned += minutes;
    result.push({
      playerId: entry.playerId,
      plannedMinutes: minutes,
      eligiblePositions: [],
      role: "bench",
    });
  });

  // Include remaining roster players with 0 planned minutes (bench depth / inactive handled elsewhere)
  for (const entry of entries.slice(size)) {
    result.push({
      playerId: entry.playerId,
      plannedMinutes: 0,
      eligiblePositions: [],
      role: entry.role,
    });
  }

  return result;
}

/**
 * Position-aware recommended lineup / rotation from current roster + availability.
 */
export function recommendRosterManagement(
  state: GameState,
  teamId: TeamId,
  options: {
    rotationStyle?: RotationStyle;
    configuredBy?: TeamRosterManagement["lastConfiguredBy"];
  } = {},
): TeamRosterManagement {
  const team = state.world.teams[teamId];
  if (team == null) {
    return emptyTeamRosterManagement();
  }

  const rotationStyle =
    options.rotationStyle ??
    team.rosterManagement.rotationStyle ??
    "balanced";
  const players = team.roster
    .map((playerId) => state.world.players[playerId])
    .filter((player): player is Player => player != null)
    .sort((a, b) => playerOverall(b) - playerOverall(a));

  const available = players.filter((player) =>
    // Ignore current inactive list when recommending — use injury only
    player.injury.kind === "healthy",
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

  // Fill remaining starter slots if < 5 (positional mismatch OK for recommend)
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

  // Injured players default to inactive (0 minutes)
  for (const player of injured) {
    if (!used.has(player.id)) {
      inactive.push(player.id);
      used.add(player.id);
    }
  }

  // Any remaining (shouldn't happen) go to bench
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
        role: "starter" as const,
        overall: playerOverall(player),
      };
    }),
    ...bench.map((playerId) => {
      const player = state.world.players[playerId]!;
      return {
        playerId,
        role: "bench" as const,
        overall: playerOverall(player),
      };
    }),
  ].sort((a, b) => b.overall - a.overall);

  const rotation = distributePlannedMinutes(rotationCandidates, rotationStyle).map(
    (entry) => {
      const player = state.world.players[entry.playerId]!;
      return {
        ...entry,
        eligiblePositions: defaultEligiblePositions(player),
      };
    },
  );

  return {
    startingLineup,
    bench,
    inactive,
    rotation,
    rotationStyle,
    lastConfiguredBy: options.configuredBy ?? "default",
  };
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
        rotation.push({
          playerId,
          plannedMinutes: 0,
          eligiblePositions: player
            ? defaultEligiblePositions(player)
            : ["SF"],
          role: "bench",
        });
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

  // Emergency: use all available, then fill with best remaining (including injured)
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
