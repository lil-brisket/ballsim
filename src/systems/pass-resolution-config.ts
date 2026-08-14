/**
 * Tunable coefficients for the v1 pass-resolution formula.
 *
 * These are gameplay tuning constants, not basketball-realism constants.
 * They are not empirical NBA completion or assist rates.
 *
 * Formula summary:
 *   passSuccess = clamp(
 *     baselinePassSuccess
 *     + (passing / RATING_MAX) * passingImpact
 *     + (ballHandling / RATING_MAX) * ballHandlingImpact
 *     - (defensivePressure / RATING_MAX) * defensivePressureImpact,
 *     minPassSuccess,
 *     maxPassSuccess,
 *   )
 *   turnover = 1 - passSuccess
 *
 *   assistOpportunityProbability = clamp(
 *     baselineAssist + (passing / RATING_MAX) * assistPassingImpact,
 *     minAssist,
 *     maxAssist,
 *   )
 *
 * assistOpportunityProbability is P(assist opportunity | completed pass).
 * It is not a box-score assist rate.
 */

export const PASS_RESOLUTION_CONFIG = {
  minPassSuccess: 0.45,
  maxPassSuccess: 0.97,
  baselinePassSuccess: 0.72,
  passingImpact: 0.22,
  ballHandlingImpact: 0.1,
  defensivePressureImpact: 0.18,
  minAssist: 0.05,
  maxAssist: 0.5,
  baselineAssist: 0.08,
  assistPassingImpact: 0.35,
} as const;
