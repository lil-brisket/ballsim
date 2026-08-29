/**
 * Migrate a legacy v46 RotationEntry shape into the v47 RotationEntry.
 */

import type { PlayerPosition } from "@/domain/entities/player";
import type {
  RotationEntry,
  RotationRole,
} from "@/domain/entities/team-roster-management";
import type { PlayerId } from "@/domain/ids";
import {
  applyTemplateToMinutes,
  inferRoleFromLegacy,
  ROLE_TEMPLATES,
} from "@/systems/rotation/rotation-role-templates";

export type LegacyRotationEntryV46 = {
  playerId: string;
  plannedMinutes: number;
  eligiblePositions: string[];
  role: "starter" | "bench";
};

export function migrateLegacyRotationEntry(
  legacy: LegacyRotationEntryV46,
): RotationEntry {
  const plannedMinutes = Math.max(
    0,
    Math.floor(legacy.plannedMinutes ?? 0),
  );
  const role: RotationRole = inferRoleFromLegacy(
    legacy.role === "starter" ? "starter" : "bench",
    plannedMinutes,
  );
  const template = ROLE_TEMPLATES[role];
  const scaled = applyTemplateToMinutes(role, plannedMinutes);

  const preferredPositions = (
    Array.isArray(legacy.eligiblePositions)
      ? legacy.eligiblePositions
      : []
  ).filter((p): p is PlayerPosition => typeof p === "string") as PlayerPosition[];

  return {
    playerId: legacy.playerId as PlayerId,
    targetMinutes: plannedMinutes,
    minimumMinutes: plannedMinutes > 0 ? scaled.min : 0,
    normalMaximumMinutes:
      plannedMinutes > 0
        ? Math.max(plannedMinutes, scaled.normalMax)
        : template.normalMax,
    absoluteMaximumMinutes:
      plannedMinutes > 0
        ? Math.max(plannedMinutes, scaled.absoluteMax)
        : template.absoluteMax,
    rotationPriority: scaled.priority,
    // Conservative: only active if they had planned minutes
    rotationStatus: plannedMinutes > 0 ? "active" : "inactive",
    role,
    preferredPositions:
      preferredPositions.length > 0 ? preferredPositions : [],
    secondaryPositions: [],
    minutePriorityBias: 0,
  };
}
