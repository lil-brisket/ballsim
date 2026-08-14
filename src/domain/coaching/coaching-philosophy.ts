/**
 * Team coaching philosophy: discrete strategic tendencies.
 * Independent of Team.playStyle (1–99 numeric bag); simulation consumes this.
 */

export type PacePhilosophy = "fast" | "balanced" | "halfCourt";

export type OffensiveEmphasis =
  | "threePointHeavy"
  | "balanced"
  | "inside";

export type DefensiveApproach =
  | "aggressive"
  | "balanced"
  | "conservative";

export type CoachingPhilosophy = {
  pace: PacePhilosophy;
  offensiveEmphasis: OffensiveEmphasis;
  defensiveApproach: DefensiveApproach;
};

export const PACE_PHILOSOPHIES: readonly PacePhilosophy[] = [
  "fast",
  "balanced",
  "halfCourt",
] as const;

export const OFFENSIVE_EMPHASES: readonly OffensiveEmphasis[] = [
  "threePointHeavy",
  "balanced",
  "inside",
] as const;

export const DEFENSIVE_APPROACHES: readonly DefensiveApproach[] = [
  "aggressive",
  "balanced",
  "conservative",
] as const;

/** Neutral defaults. Spread at call sites: `{ ...DEFAULT_COACHING_PHILOSOPHY }`. */
export const DEFAULT_COACHING_PHILOSOPHY: Readonly<CoachingPhilosophy> = {
  pace: "balanced",
  offensiveEmphasis: "balanced",
  defensiveApproach: "balanced",
} as const;

export function isPacePhilosophy(value: string): value is PacePhilosophy {
  return (PACE_PHILOSOPHIES as readonly string[]).includes(value);
}

export function isOffensiveEmphasis(value: string): value is OffensiveEmphasis {
  return (OFFENSIVE_EMPHASES as readonly string[]).includes(value);
}

export function isDefensiveApproach(value: string): value is DefensiveApproach {
  return (DEFENSIVE_APPROACHES as readonly string[]).includes(value);
}

export function isCoachingPhilosophy(
  value: unknown,
): value is CoachingPhilosophy {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const philosophy = value as Record<string, unknown>;
  return (
    typeof philosophy.pace === "string" &&
    isPacePhilosophy(philosophy.pace) &&
    typeof philosophy.offensiveEmphasis === "string" &&
    isOffensiveEmphasis(philosophy.offensiveEmphasis) &&
    typeof philosophy.defensiveApproach === "string" &&
    isDefensiveApproach(philosophy.defensiveApproach)
  );
}
