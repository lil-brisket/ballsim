import type { StaffRole } from "@/domain/entities/staff-roles";

/**
 * Per-staff hiring preferences. Weights are 0–100 relative importance;
 * salary fields are non-negative integer dollars.
 */
export type StaffPreferences = {
  salaryWeight: number;
  securityWeight: number;
  winningWeight: number;
  developmentOpportunityWeight: number;
  promotionWeight: number;
  rolePreferenceWeight: number;
  minimumSalary: number;
  desiredSalary: number;
  preferredContractYears: number;
  /** e.g. assistant_coach who wants head_coach someday */
  preferredRole: StaffRole | null;
};

export type StaffPreferencesInput = StaffPreferences;

export type StaffInterestLevel =
  | "interested"
  | "neutral"
  | "uninterested"
  | "unwilling";

export const STAFF_INTEREST_LEVELS: readonly StaffInterestLevel[] = [
  "interested",
  "neutral",
  "uninterested",
  "unwilling",
] as const;

export function isStaffInterestLevel(
  value: unknown,
): value is StaffInterestLevel {
  return (
    typeof value === "string" &&
    (STAFF_INTEREST_LEVELS as readonly string[]).includes(value)
  );
}

export function createStaffPreferences(
  input: StaffPreferencesInput,
): StaffPreferences {
  assertStaffPreferencesShape(input);
  return {
    salaryWeight: input.salaryWeight,
    securityWeight: input.securityWeight,
    winningWeight: input.winningWeight,
    developmentOpportunityWeight: input.developmentOpportunityWeight,
    promotionWeight: input.promotionWeight,
    rolePreferenceWeight: input.rolePreferenceWeight,
    minimumSalary: input.minimumSalary,
    desiredSalary: input.desiredSalary,
    preferredContractYears: input.preferredContractYears,
    preferredRole: input.preferredRole,
  };
}

export function assertStaffPreferencesShape(
  prefs: StaffPreferencesInput | StaffPreferences,
): void {
  assertWeight(prefs.salaryWeight, "salaryWeight");
  assertWeight(prefs.securityWeight, "securityWeight");
  assertWeight(prefs.winningWeight, "winningWeight");
  assertWeight(
    prefs.developmentOpportunityWeight,
    "developmentOpportunityWeight",
  );
  assertWeight(prefs.promotionWeight, "promotionWeight");
  assertWeight(prefs.rolePreferenceWeight, "rolePreferenceWeight");
  assertNonNegativeInteger(prefs.minimumSalary, "minimumSalary");
  assertNonNegativeInteger(prefs.desiredSalary, "desiredSalary");
  if (prefs.desiredSalary < prefs.minimumSalary) {
    throw new Error(
      "StaffPreferences desiredSalary must be >= minimumSalary.",
    );
  }
  if (
    typeof prefs.preferredContractYears !== "number" ||
    !Number.isInteger(prefs.preferredContractYears) ||
    prefs.preferredContractYears < 1 ||
    prefs.preferredContractYears > 10
  ) {
    throw new Error(
      "StaffPreferences preferredContractYears must be an integer 1–10.",
    );
  }
  if (prefs.preferredRole !== null && typeof prefs.preferredRole !== "string") {
    throw new Error("StaffPreferences preferredRole must be a role or null.");
  }
}

function assertWeight(value: number, field: string): void {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 100
  ) {
    throw new Error(
      `StaffPreferences ${field} must be an integer between 0 and 100.`,
    );
  }
}

function assertNonNegativeInteger(value: number, field: string): void {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new Error(`StaffPreferences ${field} must be a non-negative integer.`);
  }
}
