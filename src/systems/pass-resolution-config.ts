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
  baselinePassSuccess: 0.76,
  passingImpact: 0.22,
  ballHandlingImpact: 0.1,
  defensivePressureImpact: 0.18,
  minAssist: 0.22,
  maxAssist: 0.75,
  baselineAssist: 0.42,
  assistPassingImpact: 0.42,
} as const;

/**
 * Chance a turnover is credited to a defender as a steal. NBA teams record
 * roughly one steal per two turnovers.
 *
 *   stealChance = clamp(
 *     base + ((defender.steal - ballHandler.ballHandling) / RATING_MAX) * skillImpact,
 *     minChance,
 *     maxChance,
 *   )
 *
 * Pass turnovers are mostly live balls and use `passTurnoverBase` with the
 * matched-up defender. Standalone turnovers (lost handles, travels, offensive
 * errors) use `standaloneTurnoverBase` and credit a random on-court defender.
 */
/**
 * Assists on made shots from the `shot` action, which stands in for ball
 * movement the possession loop does not step through. Same-step pass-and-shot
 * assists are credited by the pass branch and are not affected.
 *
 * With `directShotChance` a made direct shot is assisted. The assister is the
 * passer of the completed pass that kept the ball on the previous step when
 * that passer is an on-court teammate other than the shooter, otherwise a
 * teammate picked by pass weight. Tuned so ~60% of made field goals are
 * assisted (NBA ~60-63%).
 */
export const DIRECT_SHOT_ASSIST_CONFIG = {
  directShotChance: 0.3,
} as const;

export const STEAL_CREDIT_CONFIG = {
  passTurnoverBase: 0.7,
  standaloneTurnoverBase: 0.4,
  skillImpact: 0.6,
  minChance: 0.1,
  maxChance: 0.85,
} as const;
