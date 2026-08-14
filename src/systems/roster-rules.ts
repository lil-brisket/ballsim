import {
  PLAYER_POSITIONS,
  type Player,
  type PlayerPosition,
} from "@/domain/entities/player";
import type { PlayerId } from "@/domain/ids";

/**
 * Roster rules are a pure validation building block.
 *
 * A roster is a flat collection of players. A fully assigned roster partitions
 * those players into starting lineup, bench, and inactive groups:
 *
 *   players.length === startingLineupSize + benchSize + inactiveSize
 *
 * minRosterSize / maxRosterSize bound how many players may be on a roster
 * (for signing, waiving, and similar flows). They are independent of the
 * composition sum: a roster can be size-valid without being fully assignable
 * under a fixed group configuration. Configurations are rejected when the
 * composition sum cannot sit inside [minRosterSize, maxRosterSize].
 *
 * This module does not read Team.roster, look up GameState, or mutate inputs.
 */

export type RosterRulesConfigInput = {
  minRosterSize: number;
  maxRosterSize: number;
  startingLineupSize: number;
  benchSize: number;
  inactiveSize: number;
  allowedPositions: readonly PlayerPosition[];
};

export type RosterRulesConfig = {
  minRosterSize: number;
  maxRosterSize: number;
  startingLineupSize: number;
  benchSize: number;
  inactiveSize: number;
  allowedPositions: PlayerPosition[];
};

export type RosterAssignment = {
  players: readonly Player[];
  startingLineup: readonly PlayerId[];
  bench: readonly PlayerId[];
  inactive: readonly PlayerId[];
};

type RosterGroupName = "startingLineup" | "bench" | "inactive";

const GROUP_LABELS: Record<RosterGroupName, string> = {
  startingLineup: "starting lineup",
  bench: "bench",
  inactive: "inactive",
};

export function createRosterRulesConfig(
  input: RosterRulesConfigInput,
): RosterRulesConfig {
  validateRosterRulesConfig(input);
  return {
    minRosterSize: input.minRosterSize,
    maxRosterSize: input.maxRosterSize,
    startingLineupSize: input.startingLineupSize,
    benchSize: input.benchSize,
    inactiveSize: input.inactiveSize,
    allowedPositions: [...input.allowedPositions],
  };
}

export function validateRosterRulesConfig(
  rules: RosterRulesConfigInput | RosterRulesConfig,
): void {
  assertIntegerAtLeast(rules.minRosterSize, "minRosterSize", 1);
  if (
    !Number.isInteger(rules.maxRosterSize) ||
    rules.maxRosterSize < rules.minRosterSize
  ) {
    throw new Error(
      "Roster rules maxRosterSize must be an integer >= minRosterSize.",
    );
  }
  assertIntegerAtLeast(rules.startingLineupSize, "startingLineupSize", 1);
  assertIntegerAtLeast(rules.benchSize, "benchSize", 0);
  assertIntegerAtLeast(rules.inactiveSize, "inactiveSize", 0);
  assertAllowedPositions(rules.allowedPositions);

  const composition = compositionSum(rules);
  if (composition < rules.minRosterSize) {
    throw new Error(
      "Roster rules composition must be at least minRosterSize.",
    );
  }
  if (composition > rules.maxRosterSize) {
    throw new Error(
      "Roster rules composition must be at most maxRosterSize.",
    );
  }
}

export function validateRosterSize(
  playerCount: number,
  rules: RosterRulesConfig,
): void {
  validateRosterRulesConfig(rules);
  if (!Number.isInteger(playerCount) || playerCount < 0) {
    throw new Error("Roster playerCount must be an integer >= 0.");
  }
  if (playerCount < rules.minRosterSize) {
    throw new Error(
      `Roster size must be at least ${rules.minRosterSize}.`,
    );
  }
  if (playerCount > rules.maxRosterSize) {
    throw new Error(
      `Roster size must be at most ${rules.maxRosterSize}.`,
    );
  }
}

export function validateStartingLineup(
  assignment: RosterAssignment,
  rules: RosterRulesConfig,
): void {
  validateRosterGroup(assignment, rules, "startingLineup");
}

export function validateBench(
  assignment: RosterAssignment,
  rules: RosterRulesConfig,
): void {
  validateRosterGroup(assignment, rules, "bench");
}

export function validateInactivePlayers(
  assignment: RosterAssignment,
  rules: RosterRulesConfig,
): void {
  validateRosterGroup(assignment, rules, "inactive");
}

export function validateRoster(
  assignment: RosterAssignment,
  rules: RosterRulesConfig,
): void {
  validateRosterSize(assignment.players.length, rules);
  assertUniquePlayerIds(assignment.players);
  assertAllowedPlayerPositions(assignment.players, rules.allowedPositions);

  const expectedSize = compositionSum(rules);
  if (assignment.players.length !== expectedSize) {
    throw new Error(
      `Roster must contain exactly ${expectedSize} players to be fully assigned.`,
    );
  }

  validateStartingLineup(assignment, rules);
  validateBench(assignment, rules);
  validateInactivePlayers(assignment, rules);
  assertExactPartition(assignment);
}

function compositionSum(
  rules: RosterRulesConfigInput | RosterRulesConfig,
): number {
  return rules.startingLineupSize + rules.benchSize + rules.inactiveSize;
}

function expectedGroupSize(
  rules: RosterRulesConfig,
  group: RosterGroupName,
): number {
  if (group === "startingLineup") {
    return rules.startingLineupSize;
  }
  if (group === "bench") {
    return rules.benchSize;
  }
  return rules.inactiveSize;
}

function validateRosterGroup(
  assignment: RosterAssignment,
  rules: RosterRulesConfig,
  group: RosterGroupName,
): void {
  validateRosterRulesConfig(rules);

  const ids = assignment[group];
  const expectedSize = expectedGroupSize(rules, group);
  const label = GROUP_LABELS[group];
  if (ids.length !== expectedSize) {
    throw new Error(
      `Roster ${label} must contain exactly ${expectedSize} players.`,
    );
  }

  const playersById = indexPlayersById(assignment.players);
  const seen = new Set<string>();
  for (const playerId of ids) {
    if (seen.has(playerId)) {
      throw new Error(
        `Roster ${label} contains duplicate player ${playerId}.`,
      );
    }
    seen.add(playerId);

    const player = playersById.get(playerId);
    if (player === undefined) {
      throw new Error(
        `Roster ${label} player ${playerId} is not on the roster.`,
      );
    }
    assertPlayerAllowedPosition(player, rules.allowedPositions);
    assertNotInOtherGroups(playerId, group, assignment);
  }
}

function indexPlayersById(players: readonly Player[]): Map<string, Player> {
  const playersById = new Map<string, Player>();
  for (const player of players) {
    if (!playersById.has(player.id)) {
      playersById.set(player.id, player);
    }
  }
  return playersById;
}

function assertNotInOtherGroups(
  playerId: PlayerId,
  group: RosterGroupName,
  assignment: RosterAssignment,
): void {
  const otherGroups: RosterGroupName[] =
    group === "startingLineup"
      ? ["bench", "inactive"]
      : group === "bench"
        ? ["startingLineup", "inactive"]
        : ["startingLineup", "bench"];

  for (const otherGroup of otherGroups) {
    if (assignment[otherGroup].includes(playerId)) {
      throw new Error(
        `Roster player ${playerId} cannot appear in multiple groups.`,
      );
    }
  }
}

function assertUniquePlayerIds(players: readonly Player[]): void {
  const seen = new Set<string>();
  for (const player of players) {
    if (seen.has(player.id)) {
      throw new Error(`Roster contains duplicate player ${player.id}.`);
    }
    seen.add(player.id);
  }
}

function assertAllowedPlayerPositions(
  players: readonly Player[],
  allowedPositions: readonly PlayerPosition[],
): void {
  for (const player of players) {
    assertPlayerAllowedPosition(player, allowedPositions);
  }
}

function assertPlayerAllowedPosition(
  player: Player,
  allowedPositions: readonly PlayerPosition[],
): void {
  if (!allowedPositions.includes(player.position)) {
    throw new Error(
      `Roster player ${player.id} has disallowed position ${player.position}.`,
    );
  }
}

function assertExactPartition(assignment: RosterAssignment): void {
  const assigned = new Set<string>();
  for (const playerId of [
    ...assignment.startingLineup,
    ...assignment.bench,
    ...assignment.inactive,
  ]) {
    assigned.add(playerId);
  }

  for (const player of assignment.players) {
    if (!assigned.has(player.id)) {
      throw new Error(
        `Roster player ${player.id} is not assigned to a roster group.`,
      );
    }
  }
}

function assertIntegerAtLeast(
  value: number,
  field: string,
  minimum: number,
): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(
      `Roster rules ${field} must be an integer >= ${minimum}.`,
    );
  }
}

function assertAllowedPositions(
  allowedPositions: readonly PlayerPosition[],
): void {
  if (!Array.isArray(allowedPositions)) {
    throw new Error("Roster rules allowedPositions must be an array.");
  }
  if (allowedPositions.length === 0) {
    throw new Error("Roster rules allowedPositions must not be empty.");
  }

  const seen = new Set<PlayerPosition>();
  for (const position of allowedPositions) {
    if (!PLAYER_POSITIONS.includes(position)) {
      throw new Error(
        `Roster rules allowedPositions contains invalid position ${String(position)}.`,
      );
    }
    if (seen.has(position)) {
      throw new Error(
        "Roster rules allowedPositions contains duplicate positions.",
      );
    }
    seen.add(position);
  }
}
