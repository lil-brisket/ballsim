/**
 * Injury domain types — medical events separate from floor availability status.
 * Severity ≠ status. Multiple active injuries are supported.
 */

import type { PlayerAttributes, PlayerPosition } from "@/domain/entities/player";

/** Calendar date as YYYY-MM-DD. */
export type InjuryCalendarDate = string;

export type BodyPart =
  | "ankle"
  | "knee"
  | "hamstring"
  | "quad"
  | "calf"
  | "hip"
  | "back"
  | "shoulder"
  | "elbow"
  | "wrist"
  | "hand"
  | "finger"
  | "foot"
  | "achilles"
  | "groin"
  | "neck"
  | "head"
  | "abdomen"
  | "unknown";

export const BODY_PARTS: readonly BodyPart[] = [
  "ankle",
  "knee",
  "hamstring",
  "quad",
  "calf",
  "hip",
  "back",
  "shoulder",
  "elbow",
  "wrist",
  "hand",
  "finger",
  "foot",
  "achilles",
  "groin",
  "neck",
  "head",
  "abdomen",
  "unknown",
] as const;

/** Severity is a property of the injury — independent of availability status. */
export type InjurySeverity = "minor" | "moderate" | "major" | "severe";

export const INJURY_SEVERITIES: readonly InjurySeverity[] = [
  "minor",
  "moderate",
  "major",
  "severe",
] as const;

/** @deprecated Prefer InjurySeverity; kept for legacy save migration. */
export type LegacyInjurySeverity = InjurySeverity | "unknown";

export type PracticeRestriction = "full" | "modified" | "rehab" | "none";

export const PRACTICE_RESTRICTIONS: readonly PracticeRestriction[] = [
  "full",
  "modified",
  "rehab",
  "none",
] as const;

export type GameRestriction = "none" | "monitor" | "limited" | "out";

export const GAME_RESTRICTIONS: readonly GameRestriction[] = [
  "none",
  "monitor",
  "limited",
  "out",
] as const;

export type ExposureSource =
  | "game_acute"
  | "game_overuse"
  | "practice"
  | "rehab"
  | "offseason_training"
  | "off_court";

export const EXPOSURE_SOURCES: readonly ExposureSource[] = [
  "game_acute",
  "game_overuse",
  "practice",
  "rehab",
  "offseason_training",
  "off_court",
] as const;

export type InjuryAttributeKey = keyof PlayerAttributes;

export type InjuryAttributeEffect = {
  attribute: InjuryAttributeKey;
  /** Negative = penalty. Scaled by (1 - recoveryProgress) when applied. */
  delta: number;
};

export type ExpectedReturnWindow = {
  earliest: InjuryCalendarDate;
  latest: InjuryCalendarDate;
};

/**
 * Single medical injury instance.
 * recoveryProgress: 0 = newly injured, 0.5 ≈ halfway, 1 = medically recovered.
 * Progress alone does NOT determine availability.
 */
export type PlayerInjury = {
  injuryId: string;
  catalogKey: string;
  type: string;
  bodyPart: BodyPart;
  severity: InjurySeverity;
  injuredOn: InjuryCalendarDate;
  expectedReturnWindow: ExpectedReturnWindow | null;
  recoveryProgress: number;
  practiceRestriction: PracticeRestriction;
  gameRestriction: GameRestriction;
  minutesRestriction: number | null;
  recommendedWorkloadMpg: number | null;
  maximumWorkloadMpg: number | null;
  reinjuryRisk: number;
  temporaryEffects: InjuryAttributeEffect[];
  /** Injury-derived morale proxy — not persistent player wellness. */
  temporaryFrustration: number;
  isReinjury: boolean;
  isAggravation: boolean;
  priorInjuryId: string | null;
  chronic: boolean;
  isLegacyData?: boolean;
  exposureSource: ExposureSource;
};

export type InjuryHistoryEntry = {
  injuryId: string;
  catalogKey: string;
  type: string;
  bodyPart: BodyPart;
  severity: InjurySeverity;
  injuredOn: InjuryCalendarDate;
  recoveredOn: InjuryCalendarDate | null;
  gamesMissed: number;
  recoveryDays: number;
  isReinjury: boolean;
  isAggravation: boolean;
  exposureSource: ExposureSource;
  hadLongTermEffect: boolean;
};

export type PlayerPhysicalProfile = {
  /** 1–99; relatively stable. Ordinary injuries do not noticeably reduce it. */
  durability: number;
};

export type PlayerConditioning = {
  /** 0–100; drops during inactivity, recovers with play/practice. */
  conditioning: number;
};

export const DURABILITY_MIN = 20;
export const DURABILITY_MAX = 95;
export const CONDITIONING_MIN = 0;
export const CONDITIONING_MAX = 100;
export const INJURY_HISTORY_MAX = 20;

export const AVAILABILITY_RESTRICTIVENESS: Record<string, number> = {
  available: 0,
  minor: 1,
  questionable: 2,
  limited: 3,
  recovery: 4,
  out: 5,
  suspended: 6,
};

export function isBodyPart(value: string): value is BodyPart {
  return (BODY_PARTS as readonly string[]).includes(value);
}

export function isInjurySeverity(value: string): value is InjurySeverity {
  return (INJURY_SEVERITIES as readonly string[]).includes(value);
}

export function isPracticeRestriction(
  value: string,
): value is PracticeRestriction {
  return (PRACTICE_RESTRICTIONS as readonly string[]).includes(value);
}

export function isGameRestriction(value: string): value is GameRestriction {
  return (GAME_RESTRICTIONS as readonly string[]).includes(value);
}

export function isExposureSource(value: string): value is ExposureSource {
  return (EXPOSURE_SOURCES as readonly string[]).includes(value);
}

export function migrateLegacySeverity(
  value: string | undefined | null,
): InjurySeverity {
  if (value === "minor" || value === "moderate" || value === "major" || value === "severe") {
    return value;
  }
  if (value === "unknown") {
    return "moderate";
  }
  return "moderate";
}

/** Catalog definition — config-driven, not a fixed status progression. */
export type InjuryDefinition = {
  catalogKey: string;
  displayName: string;
  bodyPart: BodyPart;
  applicablePositions?: PlayerPosition[];
  severityDistribution: Record<InjurySeverity, number>;
  recoveryDaysRange: Record<InjurySeverity, { min: number; max: number }>;
  gameRestriction: Record<InjurySeverity, GameRestriction>;
  practiceRestriction: Record<InjurySeverity, PracticeRestriction>;
  temporaryEffects: Record<InjurySeverity, InjuryAttributeEffect[]>;
  reinjuryModifier: Record<InjurySeverity, number>;
  chronicModifier: number;
  longTermEffectChance: Record<InjurySeverity, number>;
  typicalExposure: ExposureSource[];
};
