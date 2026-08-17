import {
  HEALTH_CRITICAL_RUNWAY_WEEKS,
  HEALTH_HEALTHY_LIQUIDITY_WEEKS,
  HEALTH_WARNING_RUNWAY_WEEKS,
} from "@/systems/financial-health-config";

export const FINANCIAL_HEALTH_STATES = [
  "healthy",
  "stable",
  "warning",
  "critical",
  "insolvent",
] as const;

export type FinancialHealthState = (typeof FINANCIAL_HEALTH_STATES)[number];

export type FinancialHealthInput = {
  cash: number;
  weeklyOutflow: number;
  netWeeklyBurn: number;
  runwayWeeks: number | null;
  /** Constant-condition projected cash at the named horizon; null if unknown. */
  projectedCash: number | null;
};

/**
 * Pure franchise financial-health evaluator.
 * Selectors, notifications, and spend guards must all call this — not each other.
 */
export function calculateFinancialHealth(
  input: FinancialHealthInput,
): FinancialHealthState {
  const { cash, weeklyOutflow, netWeeklyBurn, runwayWeeks, projectedCash } =
    input;

  if (cash <= 0) {
    return "insolvent";
  }

  if (projectedCash !== null && projectedCash < 0) {
    return "critical";
  }

  if (
    runwayWeeks !== null &&
    runwayWeeks <= HEALTH_CRITICAL_RUNWAY_WEEKS
  ) {
    return "critical";
  }

  if (
    runwayWeeks !== null &&
    runwayWeeks <= HEALTH_WARNING_RUNWAY_WEEKS
  ) {
    return "warning";
  }

  const healthyLiquidity =
    weeklyOutflow <= 0 ||
    cash >= weeklyOutflow * HEALTH_HEALTHY_LIQUIDITY_WEEKS;

  if (netWeeklyBurn <= 0 && healthyLiquidity) {
    return "healthy";
  }

  return "stable";
}

/**
 * Capital spend (facility upgrades, marketing increases) is blocked only when
 * cash is gone or projected cash at the horizon is materially negative.
 */
export function isCapitalSpendingRestricted(
  input: FinancialHealthInput,
): boolean {
  const health = calculateFinancialHealth(input);
  if (health === "insolvent") {
    return true;
  }
  if (health === "critical" && input.projectedCash !== null) {
    return input.projectedCash < 0;
  }
  return false;
}
