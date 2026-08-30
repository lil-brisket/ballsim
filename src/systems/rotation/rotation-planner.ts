/**
 * Pre-game and in-game rotation plan from team settings.
 */

import type { Player } from "@/domain/entities/player";
import type {
  ClosingLineupPolicy,
  RotationEntry,
  RotationPhilosophy,
  TeamRosterManagement,
} from "@/domain/entities/team-roster-management";
import type { PlayerId } from "@/domain/ids";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";

export type StaggerWindow = {
  periodNumber: number;
  clockRangeStart: number;
  clockRangeEnd: number;
};

export type OvertimeRotationContext = {
  targetMinutesAdjustment: number;
  fatigueWeight: number;
  closingLineupWeight: number;
  maximumOverridePolicy: "normal" | "absolute";
};

export type RotationPlan = {
  teamId: string;
  activePlayerIds: PlayerId[];
  emergencyPlayerIds: PlayerId[];
  rotationDepth: number;
  staggerWindows: StaggerWindow[];
  closingLineupIds: PlayerId[];
  closingLineupPolicy: ClosingLineupPolicy;
  philosophy: RotationPhilosophy;
  otContext: OvertimeRotationContext;
  rotationByPlayerId: Map<string, RotationEntry>;
};

function overall(player: Player): number {
  return calculatePlayerOverall(player.position, player.attributes);
}

function buildStaggerWindows(
  regulationPeriodCount: number,
): StaggerWindow[] {
  const windows: StaggerWindow[] = [];
  for (let period = 1; period <= regulationPeriodCount + 2; period += 1) {
    for (const range of ROTATION_CONFIG.quarterWindows) {
      windows.push({
        periodNumber: period,
        clockRangeStart: range.clockRangeStart,
        clockRangeEnd: range.clockRangeEnd,
      });
    }
  }
  return windows;
}

function resolveClosingLineup(input: {
  management: TeamRosterManagement;
  playersById: ReadonlyMap<string, Player>;
  activeIds: PlayerId[];
}): PlayerId[] {
  const { management, playersById, activeIds } = input;

  const fillFromOverall = (seed: PlayerId[]): PlayerId[] => {
    const sorted = [...activeIds]
      .map((id) => playersById.get(id))
      .filter((p): p is Player => p != null)
      .sort((a, b) => overall(b) - overall(a))
      .map((p) => p.id);
    const filled = [...seed];
    for (const id of sorted) {
      if (filled.length >= 5) break;
      if (!filled.includes(id)) filled.push(id);
    }
    return filled.slice(0, 5);
  };

  if (
    management.closingLineupPolicy === "custom" &&
    management.closingLineupIds.length === 5
  ) {
    const custom = management.closingLineupIds.filter((id) =>
      activeIds.includes(id),
    );
    if (custom.length === 5) return custom;
    return fillFromOverall(custom);
  }

  if (management.closingLineupPolicy === "best_five") {
    return fillFromOverall([]);
  }

  if (
    management.closingLineupPolicy === "starters" ||
    management.closingLineupPolicy === "auto" ||
    management.closingLineupPolicy === "custom"
  ) {
    const starters = management.startingLineup
      .map((slot) => slot.playerId)
      .filter((id) => activeIds.includes(id));
    if (starters.length === 5) return starters;
    return fillFromOverall(starters);
  }

  return fillFromOverall([]);
}

/**
 * Build a rotation plan for one team. Team-agnostic (user or AI).
 */
export function buildRotationPlan(input: {
  teamId: string;
  management: TeamRosterManagement;
  rosterPlayers: readonly Player[];
  availablePlayerIds: ReadonlySet<string>;
  regulationPeriodCount?: number;
}): RotationPlan {
  const regulationPeriodCount = input.regulationPeriodCount ?? 4;
  const playersById = new Map(
    input.rosterPlayers.map((player) => [player.id as string, player]),
  );
  const rotationByPlayerId = new Map(
    input.management.rotation.map((entry) => [
      entry.playerId as string,
      entry,
    ]),
  );

  const depth = Math.max(
    5,
    input.management.rotationDepth ||
      ROTATION_CONFIG.playersOnCourt,
  );

  const rankedActive = input.management.rotation
    .filter((entry) => entry.rotationStatus === "active")
    .filter((entry) => input.availablePlayerIds.has(entry.playerId))
    .sort((a, b) => {
      if (a.rotationPriority !== b.rotationPriority) {
        return a.rotationPriority - b.rotationPriority;
      }
      return b.targetMinutes - a.targetMinutes;
    })
    .slice(0, depth);

  let activePlayerIds = rankedActive.map((entry) => entry.playerId);

  // Ensure at least 5 available
  if (activePlayerIds.length < 5) {
    const extras = input.rosterPlayers
      .filter((player) => input.availablePlayerIds.has(player.id))
      .filter((player) => !activePlayerIds.includes(player.id))
      .sort((a, b) => overall(b) - overall(a));
    for (const player of extras) {
      if (activePlayerIds.length >= 5) {
        break;
      }
      activePlayerIds.push(player.id);
    }
  }

  const emergencyPlayerIds = input.management.rotation
    .filter((entry) => entry.rotationStatus === "emergency")
    .filter((entry) => input.availablePlayerIds.has(entry.playerId))
    .map((entry) => entry.playerId);

  const closingLineupIds = resolveClosingLineup({
    management: input.management,
    playersById,
    activeIds: activePlayerIds,
  });

  return {
    teamId: input.teamId,
    activePlayerIds,
    emergencyPlayerIds,
    rotationDepth: depth,
    staggerWindows: buildStaggerWindows(regulationPeriodCount),
    closingLineupIds,
    closingLineupPolicy: input.management.closingLineupPolicy,
    philosophy: input.management.rotationPhilosophy,
    otContext: {
      targetMinutesAdjustment: ROTATION_CONFIG.overtimePeriodMinutes,
      fatigueWeight: 1.35,
      closingLineupWeight: 2.5,
      maximumOverridePolicy: "absolute",
    },
    rotationByPlayerId,
  };
}

export function isPlayerInActivePool(
  plan: RotationPlan,
  playerId: PlayerId,
): boolean {
  return (
    plan.activePlayerIds.includes(playerId) ||
    plan.emergencyPlayerIds.includes(playerId)
  );
}
