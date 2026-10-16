import type { PlayerPosition } from "@/domain/entities/player";

/**
 * Tunable coefficients for the v1 rebound-resolution formula.
 *
 * Formula summary:
 *   baseStrength(player)
 *       = rebounding + POSITION_REBOUND_MODIFIERS[position]
 *
 *   variance ∈ [-varianceAmplitude, +varianceAmplitude)
 *       via (rng.next() * 2 - 1) * varianceAmplitude
 *
 *   effectiveStrength = max(minStrength, baseStrength + variance)
 *
 *   offensiveTeamStrength = sum(offensive effective strengths)
 *   defensiveTeamStrength = sum(defensive effective strengths)
 *                         * defensivePositioningMultiplier
 *
 *   P(offensive) = offensiveTeamStrength
 *                / (offensiveTeamStrength + defensiveTeamStrength)
 *
 * Then: Bernoulli team contest, then weighted pick among the winning
 * side by effectiveStrength.
 *
 * Position modifiers are in the same units as the 1–99 rebound rating.
 * They are small enough that a highly-rated guard can still beat a
 * poorly-rated center (e.g. 90 PG → 82 vs 50 C → 58).
 *
 * With equal talent, defensivePositioningMultiplier = 3.1 yields
 * P(OREB) ≈ 0.24 before variance (NBA teams rebound ~24% of their misses).
 * The box score uses the same contest to project offensive rebounds.
 */

export const REBOUND_RESOLUTION_CONFIG = {
  /** Half-width of per-player variance band. */
  varianceAmplitude: 8,
  /** Structural defensive positioning advantage at the team-contest stage. */
  defensivePositioningMultiplier: 3.1,
  /** Floor for effective strength so every candidate keeps a positive weight. */
  minStrength: 1,
} as const;

/**
 * Position influence on rebounding (same units as rebound rating).
 * Conservatively sized so position matters but does not dominate ratings.
 */
export const POSITION_REBOUND_MODIFIERS: Readonly<
  Record<PlayerPosition, number>
> = {
  PG: -8,
  SG: -5,
  SF: 0,
  PF: 5,
  C: 8,
};
