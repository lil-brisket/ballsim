/**
 * Canonical player salary helper.
 * Context is overall / age / years / cap / rookie-vs-vet — not market-demand AI.
 */

import { DEFAULT_SALARY_CAP } from "@/systems/salary-cap-config";

export type SalaryKind = "fa" | "extension" | "rookie" | "vet_min";

export type SalaryForPlayerInput = {
  overall: number;
  age: number;
  years?: number;
  cap: number;
  kind: SalaryKind;
};

export type ServiceYearsInput = {
  age: number;
  seasonYear: number;
  draftSeasonYear?: number | null;
  seasonsPlayed?: number;
};

/** Infer NBA-style service years from history, draft class, or age. */
export function serviceYearsForSalary(input: ServiceYearsInput): number {
  if (input.seasonsPlayed != null && input.seasonsPlayed > 0) {
    return input.seasonsPlayed;
  }
  if (input.draftSeasonYear != null) {
    return Math.max(0, input.seasonYear - input.draftSeasonYear);
  }
  return Math.max(0, input.age - 19);
}

/** Veteran minimum as a fraction of the salary cap. */
export const VET_MIN_CAP_FRACTION = 0.012;

/** Replacement-level overall at or below this may take a vet-min deal. */
export const REPLACEMENT_LEVEL_OVERALL = 70;

/**
 * Players re-signing early with their own team take a little less than
 * their open-market price.
 */
export const EXTENSION_SALARY_DISCOUNT = 0.95;

/** Supermax fraction (10+ years, 95+ OVR). */
export const SUPERMAX_CAP_FRACTION = 0.35;

/** Standard max fraction for 90+ with fewer years. */
export const STAR_MAX_CAP_FRACTION = 0.25;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToThousand(value: number): number {
  return Math.round(value / 1_000) * 1_000;
}

function faCapFraction(overall: number, age: number, years: number): number {
  let pct: number;
  if (overall >= 95) {
    pct = years >= 7 ? SUPERMAX_CAP_FRACTION : 0.3;
  } else if (overall >= 90) {
    pct = years >= 7 ? 0.32 : STAR_MAX_CAP_FRACTION;
  } else if (overall >= 85) {
    pct = 0.18;
  } else if (overall >= 80) {
    pct = 0.12;
  } else if (overall >= 75) {
    pct = 0.07;
  } else if (overall >= 70) {
    pct = 0.04;
  } else if (overall >= 65) {
    pct = 0.025;
  } else {
    pct = VET_MIN_CAP_FRACTION;
  }
  if (age >= 34) {
    pct *= 0.7;
  } else if (age >= 32) {
    pct *= 0.85;
  }
  return pct;
}

function rookieCapFraction(overall: number): number {
  const t = clamp((overall - 50) / 30, 0, 1);
  return 0.008 + t * 0.072;
}

/**
 * Annual salary in integer dollars for FA, rookie-scale, or vet-min deals.
 */
export function salaryForPlayer(input: SalaryForPlayerInput): number {
  const cap = input.cap > 0 ? input.cap : DEFAULT_SALARY_CAP;
  const vetMin = roundToThousand(cap * VET_MIN_CAP_FRACTION);
  const maxSalary = roundToThousand(cap * SUPERMAX_CAP_FRACTION);
  const years = input.years ?? 0;

  if (input.kind === "vet_min") {
    return vetMin;
  }

  let fraction: number;
  if (input.kind === "rookie") {
    fraction = rookieCapFraction(input.overall);
  } else {
    fraction = faCapFraction(input.overall, input.age, years);
    if (input.kind === "extension") {
      fraction *= EXTENSION_SALARY_DISCOUNT;
    }
  }

  return clamp(roundToThousand(cap * fraction), vetMin, maxSalary);
}

/** Veteran minimum annual salary for a given cap. */
export function vetMinSalary(cap: number): number {
  return salaryForPlayer({
    overall: 50,
    age: 28,
    years: 0,
    cap,
    kind: "vet_min",
  });
}

/** Largest annual salary a contract may carry for a given cap. */
export function maxContractSalary(cap: number): number {
  return Math.round((cap * SUPERMAX_CAP_FRACTION) / 1_000) * 1_000;
}

/**
 * Why a player contract may not pay `salary` a year, or null when it may: a
 * whole number of dollars, at least the veteran minimum, and at most the
 * maximum contract.
 *
 * The maximum is a fraction of the salary cap, so a league with the cap
 * switched off has no maximum; pass `enforceMaximum: false` there.
 */
export function salaryBoundsBlockReason(
  cap: number,
  salary: number,
  options: { enforceMaximum?: boolean } = {},
): string | null {
  if (!Number.isInteger(salary) || salary < vetMinSalary(cap)) {
    return "Salary is below the league minimum.";
  }
  if (options.enforceMaximum !== false && salary > maxContractSalary(cap)) {
    return "Salary is above the league maximum.";
  }
  return null;
}

/**
 * NBA-style minimum exception: a vet-min deal may be signed even when
 * remaining cap space is insufficient.
 */
export function isVetMinExceptionSalary(salary: number, cap: number): boolean {
  return salary > 0 && salary <= vetMinSalary(cap);
}

/** True when offered salary is a lowball relative to market. */
export function isSalaryLowball(
  offered: number,
  market: number,
  threshold = 0.7,
): boolean {
  if (market <= 0) {
    return false;
  }
  return offered < market * threshold;
}
