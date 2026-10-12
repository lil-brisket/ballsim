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
 */
export const ENGINE_VERSION = 2;
