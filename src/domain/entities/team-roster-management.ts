/**
 * Lineup / rotation configuration layered on Team.roster membership.
 * Does NOT own roster membership — Team.roster + Player.teamId are canonical.
 */

import {
  PLAYER_POSITIONS,
  type PlayerPosition,
} from "@/domain/entities/player";
import type { PlayerId } from "@/domain/ids";

export type LineupSlot = {
  playerId: PlayerId;
  slot: PlayerPosition;
};

export type RotationRole = "starter" | "bench";

export type RotationEntry = {
  playerId: PlayerId;
  /** User planning target — never conflate with actual played minutes. */
  plannedMinutes: number;
  eligiblePositions: PlayerPosition[];
  role: RotationRole;
};

export type RotationStyle = "tight" | "balanced" | "deep";

export type RosterConfiguredBy = "default" | "user" | "ai";

export type TeamRosterManagement = {
  startingLineup: LineupSlot[];
  bench: PlayerId[];
  inactive: PlayerId[];
  rotation: RotationEntry[];
  rotationStyle: RotationStyle;
  /** Audit hint only — management-policy / delegation is authoritative for AI. */
  lastConfiguredBy: RosterConfiguredBy;
};

export const ROTATION_STYLES: readonly RotationStyle[] = [
  "tight",
  "balanced",
  "deep",
] as const;

export const ROSTER_CONFIGURED_BY: readonly RosterConfiguredBy[] = [
  "default",
  "user",
  "ai",
] as const;

export const DEFAULT_ROTATION_STYLE: RotationStyle = "balanced";

export function isRotationStyle(value: string): value is RotationStyle {
  return (ROTATION_STYLES as readonly string[]).includes(value);
}

export function isRosterConfiguredBy(
  value: string,
): value is RosterConfiguredBy {
  return (ROSTER_CONFIGURED_BY as readonly string[]).includes(value);
}

export function isPlayerPosition(value: string): value is PlayerPosition {
  return (PLAYER_POSITIONS as readonly string[]).includes(value);
}

export function emptyTeamRosterManagement(): TeamRosterManagement {
  return {
    startingLineup: [],
    bench: [],
    inactive: [],
    rotation: [],
    rotationStyle: DEFAULT_ROTATION_STYLE,
    lastConfiguredBy: "default",
  };
}

export function cloneTeamRosterManagement(
  management: TeamRosterManagement,
): TeamRosterManagement {
  return {
    startingLineup: management.startingLineup.map((slot) => ({ ...slot })),
    bench: [...management.bench],
    inactive: [...management.inactive],
    rotation: management.rotation.map((entry) => ({
      ...entry,
      eligiblePositions: [...entry.eligiblePositions],
    })),
    rotationStyle: management.rotationStyle,
    lastConfiguredBy: management.lastConfiguredBy,
  };
}

export function isTeamRosterManagement(
  value: unknown,
): value is TeamRosterManagement {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.startingLineup)) {
    return false;
  }
  if (!Array.isArray(record.bench) || !Array.isArray(record.inactive)) {
    return false;
  }
  if (!Array.isArray(record.rotation)) {
    return false;
  }
  if (
    typeof record.rotationStyle !== "string" ||
    !isRotationStyle(record.rotationStyle)
  ) {
    return false;
  }
  if (
    typeof record.lastConfiguredBy !== "string" ||
    !isRosterConfiguredBy(record.lastConfiguredBy)
  ) {
    return false;
  }
  for (const slot of record.startingLineup) {
    if (slot === null || typeof slot !== "object" || Array.isArray(slot)) {
      return false;
    }
    const lineupSlot = slot as Record<string, unknown>;
    if (
      typeof lineupSlot.playerId !== "string" ||
      lineupSlot.playerId.length === 0
    ) {
      return false;
    }
    if (
      typeof lineupSlot.slot !== "string" ||
      !isPlayerPosition(lineupSlot.slot)
    ) {
      return false;
    }
  }
  for (const id of [...record.bench, ...record.inactive]) {
    if (typeof id !== "string" || id.length === 0) {
      return false;
    }
  }
  for (const entry of record.rotation) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return false;
    }
    const rotationEntry = entry as Record<string, unknown>;
    if (
      typeof rotationEntry.playerId !== "string" ||
      rotationEntry.playerId.length === 0
    ) {
      return false;
    }
    if (
      typeof rotationEntry.plannedMinutes !== "number" ||
      !Number.isInteger(rotationEntry.plannedMinutes) ||
      rotationEntry.plannedMinutes < 0
    ) {
      return false;
    }
    if (
      rotationEntry.role !== "starter" &&
      rotationEntry.role !== "bench"
    ) {
      return false;
    }
    if (!Array.isArray(rotationEntry.eligiblePositions)) {
      return false;
    }
    for (const position of rotationEntry.eligiblePositions) {
      if (typeof position !== "string" || !isPlayerPosition(position)) {
        return false;
      }
    }
  }
  return true;
}
