/**
 * Derive internal Min / NMax / AMax from Target MPG + Role.
 * Users only set targetMinutes; the engine keeps soft/hard ceilings.
 */

import type {
  MinutePriorityBias,
  RotationEntry,
  RotationPriority,
  RotationRole,
  RotationStatus,
} from "@/domain/entities/team-roster-management";
import type { PlayerPosition } from "@/domain/entities/player";
import type { PlayerId } from "@/domain/ids";

export type RoleConstraintTemplate = {
  floorRatio: number;
  headroom: number;
  otHeadroom: number;
  priority: RotationPriority;
};

export const ROLE_CONSTRAINT_TEMPLATES: Record<
  RotationRole,
  RoleConstraintTemplate
> = {
  starter: { floorRatio: 0.85, headroom: 6, otHeadroom: 6, priority: 1 },
  sixth_man: { floorRatio: 0.7, headroom: 6, otHeadroom: 6, priority: 2 },
  rotation: { floorRatio: 0.55, headroom: 6, otHeadroom: 6, priority: 3 },
  bench: { floorRatio: 0, headroom: 8, otHeadroom: 6, priority: 4 },
  deep_bench: { floorRatio: 0, headroom: 6, otHeadroom: 6, priority: 5 },
  emergency: { floorRatio: 0, headroom: 6, otHeadroom: 6, priority: 5 },
};

export type DeriveConstraintsInput = {
  playerId: PlayerId;
  targetMinutes: number;
  role: RotationRole;
  preferredPositions: PlayerPosition[];
  secondaryPositions?: PlayerPosition[];
  rotationPriority?: RotationPriority;
  minutePriorityBias?: MinutePriorityBias;
  overrideMedicalRecommendation?: boolean;
  /** Soft medical guidance — used for warnings, not hard clamp here. */
  recommendedWorkloadMpg?: number | null;
  /** Hard medical cap unless override. */
  maximumWorkloadMpg?: number | null;
  /** Player cannot play — forces inactive / zero targets. */
  canPlay?: boolean;
};

export function deriveRotationConstraints(
  input: DeriveConstraintsInput,
): RotationEntry {
  const template = ROLE_CONSTRAINT_TEMPLATES[input.role];
  const canPlay = input.canPlay !== false;
  let target = Math.max(0, Math.round(input.targetMinutes));

  if (!canPlay) {
    target = 0;
  } else if (
    input.maximumWorkloadMpg != null &&
    !input.overrideMedicalRecommendation &&
    target > input.maximumWorkloadMpg
  ) {
    target = Math.max(0, Math.round(input.maximumWorkloadMpg));
  }

  const minimumMinutes =
    target <= 0 ? 0 : Math.max(0, Math.round(target * template.floorRatio));
  const normalMaximumMinutes =
    target <= 0 ? template.headroom : target + template.headroom;
  const absoluteMaximumMinutes = normalMaximumMinutes + template.otHeadroom;

  let rotationStatus: RotationStatus;
  if (!canPlay) {
    rotationStatus = "inactive";
  } else if (target <= 0 || input.role === "emergency") {
    rotationStatus = target <= 0 ? "emergency" : "emergency";
  } else {
    rotationStatus = "active";
  }

  // Emergency role with 0 target stays emergency; positive target on emergency stays emergency pool
  if (input.role === "emergency") {
    rotationStatus = "emergency";
  }

  return {
    playerId: input.playerId,
    targetMinutes: target,
    minimumMinutes,
    normalMaximumMinutes: Math.max(target, normalMaximumMinutes),
    absoluteMaximumMinutes: Math.max(target, absoluteMaximumMinutes),
    rotationPriority: input.rotationPriority ?? template.priority,
    rotationStatus,
    role: input.role === "deep_bench" ? "bench" : input.role,
    preferredPositions: [...input.preferredPositions],
    secondaryPositions: [...(input.secondaryPositions ?? [])],
    minutePriorityBias: input.minutePriorityBias ?? 0,
    overrideMedicalRecommendation:
      input.overrideMedicalRecommendation === true,
  };
}

/** Re-derive constraints for an existing entry after target/role edit. */
export function rederiveRotationEntry(
  entry: RotationEntry,
  patch: Partial<
    Pick<
      DeriveConstraintsInput,
      | "targetMinutes"
      | "role"
      | "rotationPriority"
      | "minutePriorityBias"
      | "overrideMedicalRecommendation"
      | "recommendedWorkloadMpg"
      | "maximumWorkloadMpg"
      | "canPlay"
    >
  >,
): RotationEntry {
  const role = patch.role ?? entry.role;
  const roleChanged = patch.role != null && patch.role !== entry.role;
  return deriveRotationConstraints({
    playerId: entry.playerId,
    targetMinutes: patch.targetMinutes ?? entry.targetMinutes,
    role,
    preferredPositions: entry.preferredPositions,
    secondaryPositions: entry.secondaryPositions,
    rotationPriority: roleChanged
      ? patch.rotationPriority
      : (patch.rotationPriority ?? entry.rotationPriority),
    minutePriorityBias: patch.minutePriorityBias ?? entry.minutePriorityBias,
    overrideMedicalRecommendation:
      patch.overrideMedicalRecommendation ??
      entry.overrideMedicalRecommendation,
    recommendedWorkloadMpg: patch.recommendedWorkloadMpg,
    maximumWorkloadMpg: patch.maximumWorkloadMpg,
    canPlay: patch.canPlay,
  });
}
