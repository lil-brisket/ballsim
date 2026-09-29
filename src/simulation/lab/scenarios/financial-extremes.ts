import { ECONOMY_SCENARIOS } from "@/systems/economy/scenario-harness";

/**
 * Scenario: financial extremes
 * Base generator: existing ECONOMY_SCENARIOS (distress, high_market, low_market, …)
 * Transformation: none — reuses runEconomyScenario rather than a Lab roster clamp.
 * RNG stream: economy harness seed (not deriveSeed); Lab career mode uses runLabSeason.
 * Determinism: same seed ⇒ identical economy harness checksums.
 */
export const LAB_FINANCIAL_EXTREME_IDS = [
  "distress",
  "high_market",
  "low_market",
] as const satisfies ReadonlyArray<(typeof ECONOMY_SCENARIOS)[number]>;

export type LabFinancialExtremeId = (typeof LAB_FINANCIAL_EXTREME_IDS)[number];
