/**
 * Named bounds for franchise AI preference influence.
 * Prefer bounded deltas/multipliers over compounding stacks.
 */

/** Preference values live in [0, 1]. */
export const PREFERENCE_MIN = 0;
export const PREFERENCE_MAX = 1;

/**
 * Organizational valuation multiplier band applied once:
 * objectiveValue * clamp(1 + signedDelta, 1-k, 1+k)
 */
export const PREFERENCE_VALUE_MODIFIER_BAND = 0.25;

/** Max absolute ticket price step per weekly AI decision. */
export const AI_TICKET_PRICE_STEP_MAX = 5;

/** Max absolute marketing budget step per weekly AI decision. */
export const AI_MARKETING_BUDGET_STEP_MAX = 750_000;

/** Minimum cash before AI considers facility upgrades. */
export const AI_FACILITY_MIN_CASH = 8_000_000;

/** Conservative orgs need more cash buffer before upgrading. */
export const AI_FACILITY_CONSERVATIVE_CASH = 20_000_000;

/** Cap space fraction for AI FA offers, scaled by spendWillingness. */
export const AI_FA_CAP_FRACTION_MIN = 0.08;
export const AI_FA_CAP_FRACTION_MAX = 0.22;

/** Age bands for youth vs established valuation. */
export const AI_YOUTH_AGE_MAX = 24;
export const AI_VETERAN_AGE_MIN = 29;

export function clampPreference(value: number): number {
  if (!Number.isFinite(value)) {
    return PREFERENCE_MIN;
  }
  return Math.max(PREFERENCE_MIN, Math.min(PREFERENCE_MAX, value));
}

/**
 * Single bounded multiplier from a 0–1 preference intensity around 0.5 neutral.
 * preference 0.5 → 1.0; 1.0 → 1+band; 0 → 1-band.
 */
export function boundedPreferenceMultiplier(
  preference01: number,
  band: number = PREFERENCE_VALUE_MODIFIER_BAND,
): number {
  const p = clampPreference(preference01);
  const signed = (p - 0.5) * 2; // -1..1
  const raw = 1 + signed * band;
  return Math.max(1 - band, Math.min(1 + band, raw));
}

/**
 * Bounded additive score contribution from a preference (for ranking sorts).
 * Returns roughly -weight..+weight.
 */
export function boundedPreferenceDelta(
  preference01: number,
  weight: number,
): number {
  const p = clampPreference(preference01);
  return (p - 0.5) * 2 * weight;
}
