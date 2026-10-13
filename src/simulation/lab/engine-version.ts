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
 * (1.0-1.35 → 1.0-1.7). Every CPU-controlled team now has a persistent,
 * deterministic payroll-efficiency factor derived from the game seed and
 * its team id
 * (`teamPayrollEfficiencyFactor` / `applyContractNegotiationNoise`,
 * applied at every signing in roster generation and AI free agency), so
 * payroll is not a deterministic function of overall rating alone. No RNG
 * is consumed for this — it is a pure function of team id, not a random
 * roll — so it does not shift the RNG stream.
 *
 * (Widening the generation-time superstar quality tail was tried in the
 * same pass and reverted — it broke box-score/possession fidelity
 * calibration. See `tests/regression/league-economy-balance.test.ts`.)
 */
export const ENGINE_VERSION = 3;
