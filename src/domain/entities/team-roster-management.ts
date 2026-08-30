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

/** Descriptive rotation label — ordering uses rotationPriority. */
export type RotationRole =
  | "starter"
  | "sixth_man"
  | "rotation"
  | "bench"
  | "deep_bench"
  | "emergency";

/** Rotation pool membership — distinct from player availability. */
export type RotationStatus = "active" | "inactive" | "emergency";

export type RotationPriority = 1 | 2 | 3 | 4 | 5;

/** UI "Play Less / Normal / Play More" — scoring bias, not hard assignment. */
export type MinutePriorityBias = -1 | 0 | 1;

export type RotationEntry = {
  playerId: PlayerId;
  /** User planning target — never conflate with actual played minutes. */
  targetMinutes: number;
  minimumMinutes: number;
  /** What the AI normally tries not to exceed. */
  normalMaximumMinutes: number;
  /** True hard ceiling (may be used in playoffs / OT / close games). */
  absoluteMaximumMinutes: number;
  /** Primary ordering mechanism for substitution candidacy (1 = highest). */
  rotationPriority: RotationPriority;
  rotationStatus: RotationStatus;
  role: RotationRole;
  preferredPositions: PlayerPosition[];
  secondaryPositions: PlayerPosition[];
  minutePriorityBias: MinutePriorityBias;
  /**
   * When true, user accepts risk of exceeding medical recommended/maximum workload.
   * Default false — engine respects maximumWorkloadMpg as a hard cap.
   */
  overrideMedicalRecommendation?: boolean;
};

export type RotationPhilosophy =
  | "deep"
  | "balanced"
  | "tight"
  | "star_heavy"
  | "development";

/** Legacy alias kept for coaching presets; maps to philosophy + depth. */
export type RotationStyle = "tight" | "balanced" | "deep";

export type RotationPreset =
  | "auto"
  | "balanced"
  | "star_heavy"
  | "deep"
  | "development"
  | "custom";

export type ClosingLineupPolicy =
  | "auto"
  | "best_five"
  | "starters"
  | "custom";

export type RosterConfiguredBy = "default" | "user" | "ai";

export type TeamRosterManagement = {
  startingLineup: LineupSlot[];
  bench: PlayerId[];
  inactive: PlayerId[];
  rotation: RotationEntry[];
  /** @deprecated Prefer rotationPhilosophy; kept for coaching preset sync. */
  rotationStyle: RotationStyle;
  rotationPhilosophy: RotationPhilosophy;
  /** Concrete man-count for the active rotation pool. */
  rotationDepth: number;
  rotationPreset: RotationPreset;
  closingLineupPolicy: ClosingLineupPolicy;
  closingLineupIds: PlayerId[];
  /** Audit hint only — management-policy / delegation is authoritative for AI. */
  lastConfiguredBy: RosterConfiguredBy;
};

export const ROTATION_ROLES: readonly RotationRole[] = [
  "starter",
  "sixth_man",
  "rotation",
  "bench",
  "deep_bench",
  "emergency",
] as const;

export const ROTATION_STATUSES: readonly RotationStatus[] = [
  "active",
  "inactive",
  "emergency",
] as const;

export const ROTATION_PHILOSOPHIES: readonly RotationPhilosophy[] = [
  "deep",
  "balanced",
  "tight",
  "star_heavy",
  "development",
] as const;

export const ROTATION_STYLES: readonly RotationStyle[] = [
  "tight",
  "balanced",
  "deep",
] as const;

export const ROTATION_PRESETS: readonly RotationPreset[] = [
  "auto",
  "balanced",
  "star_heavy",
  "deep",
  "development",
  "custom",
] as const;

export const CLOSING_LINEUP_POLICIES: readonly ClosingLineupPolicy[] = [
  "auto",
  "best_five",
  "starters",
  "custom",
] as const;

export const ROSTER_CONFIGURED_BY: readonly RosterConfiguredBy[] = [
  "default",
  "user",
  "ai",
] as const;

export const DEFAULT_ROTATION_STYLE: RotationStyle = "balanced";
export const DEFAULT_ROTATION_PHILOSOPHY: RotationPhilosophy = "balanced";
export const DEFAULT_ROTATION_DEPTH = 12;
export const DEFAULT_ROTATION_PRESET: RotationPreset = "balanced";
export const DEFAULT_CLOSING_LINEUP_POLICY: ClosingLineupPolicy = "auto";

export function isRotationRole(value: string): value is RotationRole {
  return (ROTATION_ROLES as readonly string[]).includes(value);
}

export function isRotationStatus(value: string): value is RotationStatus {
  return (ROTATION_STATUSES as readonly string[]).includes(value);
}

export function isRotationPhilosophy(
  value: string,
): value is RotationPhilosophy {
  return (ROTATION_PHILOSOPHIES as readonly string[]).includes(value);
}

export function isRotationStyle(value: string): value is RotationStyle {
  return (ROTATION_STYLES as readonly string[]).includes(value);
}

export function isRotationPreset(value: string): value is RotationPreset {
  return (ROTATION_PRESETS as readonly string[]).includes(value);
}

export function isClosingLineupPolicy(
  value: string,
): value is ClosingLineupPolicy {
  return (CLOSING_LINEUP_POLICIES as readonly string[]).includes(value);
}

export function isRosterConfiguredBy(
  value: string,
): value is RosterConfiguredBy {
  return (ROSTER_CONFIGURED_BY as readonly string[]).includes(value);
}

export function isPlayerPosition(value: string): value is PlayerPosition {
  return (PLAYER_POSITIONS as readonly string[]).includes(value);
}

export function isRotationPriority(value: number): value is RotationPriority {
  return (
    Number.isInteger(value) && value >= 1 && value <= 5
  );
}

export function isMinutePriorityBias(
  value: number,
): value is MinutePriorityBias {
  return value === -1 || value === 0 || value === 1;
}

/** Map legacy style → philosophy (star_heavy / development are new). */
export function philosophyFromStyle(style: RotationStyle): RotationPhilosophy {
  return style;
}

/** Map philosophy → legacy style for coaching preset compatibility. */
export function styleFromPhilosophy(
  philosophy: RotationPhilosophy,
): RotationStyle {
  if (philosophy === "tight") {
    return "tight";
  }
  if (philosophy === "deep" || philosophy === "development") {
    return "deep";
  }
  return "balanced";
}

export function depthForPhilosophy(
  philosophy: RotationPhilosophy,
): number {
  switch (philosophy) {
    case "tight":
    case "star_heavy":
      return 10;
    case "deep":
    case "development":
      return 12;
    case "balanced":
    default:
      return 12;
  }
}

export function emptyTeamRosterManagement(): TeamRosterManagement {
  return {
    startingLineup: [],
    bench: [],
    inactive: [],
    rotation: [],
    rotationStyle: DEFAULT_ROTATION_STYLE,
    rotationPhilosophy: DEFAULT_ROTATION_PHILOSOPHY,
    rotationDepth: DEFAULT_ROTATION_DEPTH,
    rotationPreset: DEFAULT_ROTATION_PRESET,
    closingLineupPolicy: DEFAULT_CLOSING_LINEUP_POLICY,
    closingLineupIds: [],
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
      preferredPositions: [...entry.preferredPositions],
      secondaryPositions: [...entry.secondaryPositions],
    })),
    rotationStyle: management.rotationStyle,
    rotationPhilosophy: management.rotationPhilosophy,
    rotationDepth: management.rotationDepth,
    rotationPreset: management.rotationPreset,
    closingLineupPolicy: management.closingLineupPolicy,
    closingLineupIds: [...management.closingLineupIds],
    lastConfiguredBy: management.lastConfiguredBy,
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositionArray(value: unknown): value is PlayerPosition[] {
  if (!Array.isArray(value)) {
    return false;
  }
  for (const position of value) {
    if (typeof position !== "string" || !isPlayerPosition(position)) {
      return false;
    }
  }
  return true;
}

export function isRotationEntry(value: unknown): value is RotationEntry {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  if (typeof entry.playerId !== "string" || entry.playerId.length === 0) {
    return false;
  }
  if (!isNonNegativeInteger(entry.targetMinutes)) {
    return false;
  }
  if (!isNonNegativeInteger(entry.minimumMinutes)) {
    return false;
  }
  if (!isNonNegativeInteger(entry.normalMaximumMinutes)) {
    return false;
  }
  if (!isNonNegativeInteger(entry.absoluteMaximumMinutes)) {
    return false;
  }
  if (
    typeof entry.rotationPriority !== "number" ||
    !isRotationPriority(entry.rotationPriority)
  ) {
    return false;
  }
  if (
    typeof entry.rotationStatus !== "string" ||
    !isRotationStatus(entry.rotationStatus)
  ) {
    return false;
  }
  if (typeof entry.role !== "string" || !isRotationRole(entry.role)) {
    return false;
  }
  if (!isPositionArray(entry.preferredPositions)) {
    return false;
  }
  if (!isPositionArray(entry.secondaryPositions)) {
    return false;
  }
  if (
    typeof entry.minutePriorityBias !== "number" ||
    !isMinutePriorityBias(entry.minutePriorityBias)
  ) {
    return false;
  }
  return true;
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
    typeof record.rotationPhilosophy !== "string" ||
    !isRotationPhilosophy(record.rotationPhilosophy)
  ) {
    return false;
  }
  if (
    typeof record.rotationDepth !== "number" ||
    !Number.isInteger(record.rotationDepth) ||
    record.rotationDepth < 5
  ) {
    return false;
  }
  if (
    typeof record.rotationPreset !== "string" ||
    !isRotationPreset(record.rotationPreset)
  ) {
    return false;
  }
  if (
    typeof record.closingLineupPolicy !== "string" ||
    !isClosingLineupPolicy(record.closingLineupPolicy)
  ) {
    return false;
  }
  if (!Array.isArray(record.closingLineupIds)) {
    return false;
  }
  for (const id of record.closingLineupIds) {
    if (typeof id !== "string" || id.length === 0) {
      return false;
    }
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
    if (!isRotationEntry(entry)) {
      return false;
    }
  }
  return true;
}
