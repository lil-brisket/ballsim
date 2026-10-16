/**
 * Single source of truth for Lab/engine output identity.
 *
 * Bump this integer on any change that alters simulation output for a fixed
 * seed (RNG stream layout, possession resolution, rotation, box-score identity,
 * roster generation). Do not bump for harness-only changes (manifest fields,
 * report formatting, CLI flags).
 *
 * Version 1 is the first explicit engine version. It includes per-game Lab
 * seed streams (`{scenarioId}:roster` and `{scenarioId}:game:{n}`).
 *
 * Version 2: stored player minutes are conserved per team (largest-remainder
 * rounding of on-court seconds, `finalizeMinutesOnSimState`) instead of being
 * floored per player, which lost ~6 of 240 team minutes. Box-score projection
 * was also recalibrated to the possession engine (points, shot mix, rates,
 * counting-stat rates). Possession outcomes (scores, shots, RNG stream) are
 * unchanged.
 *
 * Version 3: facility-driven player development now uses the facility
 * levels from `FACILITY_DEVELOPMENT_LAG_SEASONS` seasons ago
 * (`laggedFacilityDevelopmentMultiplier`) instead of the current season's
 * levels, so facility investment pays off in roster development with a
 * real delay instead of the same season, with a larger effect size
 * (1.0-1.35 → 1.0-1.7). Franchise valuation also weights performance more
 * and has less inertia (`franchise-value-config.ts`).
 *
 * Version 4: box-score team points come from a fitted model of team shooting,
 * top-3 scorers, rebounding and opponent defense (`expectedTeamPoints`)
 * instead of a fixed 96-point base plus overall difference, and box-score make
 * rates / shot mix were re-fitted per player against the possession sim
 * across generated leagues (the old values were tuned on one Lab roster pair
 * and ran ~9 PPG and 1-3 shooting points high on league rosters). RNG draw
 * order is unchanged. Recommended lineups now fill five starters from
 * recovery/minor players when needed, and new franchises start with an arena
 * sized to their market.
 *
 * Version 5: offseason contracts start with the upcoming season, closing the
 * free-agency window completes AI free agency, and the short-roster fill
 * respects the salary cap (minimum deals when a market contract does not
 * fit). Multi-season rosters and payrolls change; single-game output for
 * fixed rosters does not.
 *
 * Version 6: player salaries are paid over the regular season (exactly the
 * annual payroll, whatever the calendar skips), every team receives a
 * cap-linked national media share, and AI teams sign and extend within a
 * revenue-and-cash payroll budget. Multi-season finances and rosters change;
 * single-game output does not.
 *
 * Version 7: blocks are a rating-scaled chance on each missed shot
 * (`blockProbability`, one RNG draw per miss) instead of every miss against
 * a block >= 72 defender, cutting possession blocks from ~12 to ~4-5 per team.
 * The rebound positioning multiplier rises 2 -> 3.1 (OREB ~14 -> ~11). Box
 * score projects OREB and blocks from rosters with the same formulas.
 */
export const ENGINE_VERSION = 7;
