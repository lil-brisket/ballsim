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
 *
 * Version 8: shooting ability has diminishing returns above 75
 * (`effectiveShootingAbility`, half weight per point) in both engines, with
 * the make-probability baseline raised -0.2 -> -0.18 so league scoring holds.
 * The box-score-only make-rate knee is gone and its points model is refit on
 * real-pipeline possession games. Player generation adds an 86-90 quality
 * band (starter slots up to 90), giving ~3 players at 90+ per league with
 * top scorers near 30 PPG instead of 31-35 PPG at ~59% FG.
 *
 * Version 9: a missed shot that draws a shooting foul is no longer a
 * field-goal attempt (only and-ones are), lifting FG% ~2 points. Steals are a
 * rating-based chance on every turnover (`STEAL_CREDIT_CONFIG`, one RNG draw
 * per turnover plus a defender pick on standalone turnovers) instead of every
 * pass turnover against a steal >= 70 defender, ~4 -> ~8 per team. Home teams
 * get a make-probability bonus (`homeCourtAdvantage`, ~+2.5 points). The
 * three-point adjustment drops -0.08 -> -0.095 so pooled 3P% stays ~38% once
 * fouled three-point misses stop counting. Box score refits its 2P/3P
 * intercepts, points intercept and steal rate, and adds the home term.
 *
 * Version 10: a completed pass that does not end in a shot costs 3-7 seconds
 * (`passContinueMin/Max`) instead of a full 8-18 second possession, lifting
 * pace ~91 -> ~99 possessions per team. Turnovers fall ~19% -> ~14.5% of
 * possessions (turnover action weight 6 -> 4.5, `baselinePassSuccess`
 * 0.72 -> 0.76); steal credit bases rise 0.6/0.3 -> 0.7/0.4 so steals hold
 * ~8. Fouls rise (foul weight 14 -> 16, shooting share 38 -> 48 of 100),
 * FTA ~14 -> ~22. Team scoring ~95 -> ~113 PPG on the validation rosters.
 * Box score rescales its points model (OLS on held-out Lab possession
 * games), possessions 82-92 -> 94-104, and its turnover, steal, defensive
 * rebound and free-throw share rates.
 *
 * Version 11: made shots from the `shot` action are assisted 30% of the time
 * (`DIRECT_SHOT_ASSIST_CONFIG`, one RNG draw per made direct shot plus a
 * teammate pick), preferring the passer of a completed pass that kept the
 * ball on the previous step. Assisted share of made field goals ~50% -> ~62%,
 * assists ~21 -> ~26 per team. Box score assist rate 0.51 -> 0.605.
 *
 * Version 12: defenders are matched by position slot (`pickMatchedDefender`)
 * instead of picked uniformly: shot, pass, foul and standalone-turnover
 * defenders guard their man, with a 20% switch to a random defender and, on
 * two-point shots, a 25% rim-help contest by the best shot blocker. One RNG
 * draw per pick, as before; shot type is now chosen before the shot defender.
 * An elite defender now holds their man's FG% down instead of spreading the
 * effect over the whole offense. League scoring ~1 PPG lower; box score
 * points intercept -1.0.
 *
 * Version 13: lead regression (`SHOT_RESOLUTION_CONFIG.leadRegression`).
 * Past an 8-point lead the leading team's shots lose 0.004 make probability
 * per extra point (cap 0.05) and the trailing team's gain the same. No RNG
 * change. In 12-team leagues the margin noise left after team strength
 * falls ~16.3 -> ~12.4 (NBA ~12.5), 20+ point games ~33% -> ~19%, team win%
 * spread unchanged. Box score draws one shared noise term for both teams
 * (+-12) plus +-15 per team instead of +-24 per team, and rescales its
 * points model (x0.830, +17.7; home 2.0).
 */
export const ENGINE_VERSION = 13;
