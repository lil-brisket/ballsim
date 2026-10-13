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
 */
export const ENGINE_VERSION = 3;
