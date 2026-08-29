import {
  BUSINESS_FUNDS_CRITICAL_THRESHOLD,
  BUSINESS_FUNDS_STRONG_THRESHOLD,
  BUSINESS_FUNDS_TIGHT_THRESHOLD,
} from "@/systems/business-funds-config";

/**
 * Informational business-funds health bands.
 * Never blocks simulation, eliminates franchises, or gates basketball ops.
 */
export const BUSINESS_HEALTH_STATES = [
  "strong",
  "stable",
  "tight",
  "critical",
] as const;

export type BusinessHealthState = (typeof BUSINESS_HEALTH_STATES)[number];

/** @deprecated Use BUSINESS_HEALTH_STATES / BusinessHealthState. */
export const FINANCIAL_HEALTH_STATES = [
  "healthy",
  "stable",
  "warning",
  "critical",
  "insolvent",
] as const;

/** @deprecated Use BusinessHealthState. */
export type FinancialHealthState = (typeof FINANCIAL_HEALTH_STATES)[number];

export type BusinessHealthInput = {
  businessFunds: number;
  weeklyOutflow: number;
  netWeeklyBurn: number;
  runwayWeeks: number | null;
  projectedBusinessFunds: number | null;
};

/** @deprecated Use BusinessHealthInput. */
export type FinancialHealthInput = {
  cash: number;
  weeklyOutflow: number;
  netWeeklyBurn: number;
  runwayWeeks: number | null;
  projectedCash: number | null;
};

/**
 * Pure informational business-funds health evaluator.
 * Never returns insolvent / bankruptcy; low funds → critical warning only.
 */
export function calculateBusinessHealth(
  input: BusinessHealthInput,
): BusinessHealthState {
  const { businessFunds } = input;

  if (businessFunds < BUSINESS_FUNDS_CRITICAL_THRESHOLD) {
    return "critical";
  }
  if (businessFunds < BUSINESS_FUNDS_TIGHT_THRESHOLD) {
    return "tight";
  }
  if (businessFunds >= BUSINESS_FUNDS_STRONG_THRESHOLD) {
    return "strong";
  }
  return "stable";
}

/**
 * @deprecated Prefer calculateBusinessHealth. Maps legacy bands for call-site migration.
 * "insolvent" is never returned — maps low cash to "critical".
 */
export function calculateFinancialHealth(
  input: FinancialHealthInput,
): FinancialHealthState {
  const business = calculateBusinessHealth({
    businessFunds: input.cash,
    weeklyOutflow: input.weeklyOutflow,
    netWeeklyBurn: input.netWeeklyBurn,
    runwayWeeks: input.runwayWeeks,
    projectedBusinessFunds: input.projectedCash,
  });
  switch (business) {
    case "strong":
      return "healthy";
    case "stable":
      return "stable";
    case "tight":
      return "warning";
    case "critical":
      return "critical";
  }
}

/**
 * @deprecated Capital spend is gated by assertSufficientBusinessFunds only.
 * Always returns false — insolvency/runway gates removed.
 */
export function isCapitalSpendingRestricted(
  _input: FinancialHealthInput | BusinessHealthInput,
): boolean {
  return false;
}
