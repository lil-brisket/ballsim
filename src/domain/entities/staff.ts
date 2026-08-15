import type { StaffId, TeamId } from "@/domain/ids";
import { RATING_MAX, RATING_MIN } from "@/domain/entities/player";

/**
 * Staff roles. Tier 1 roles (GM, head coach, scout, trainer) have Phase E
 * gameplay modifiers. Tier 2 (assistant coach, finance, marketing) are
 * hireable/payable only until a later phase has real hooks.
 */
export type StaffRole =
  | "general_manager"
  | "head_coach"
  | "assistant_coach"
  | "scout"
  | "trainer"
  | "finance"
  | "marketing";

export const STAFF_ROLES: readonly StaffRole[] = [
  "general_manager",
  "head_coach",
  "assistant_coach",
  "scout",
  "trainer",
  "finance",
  "marketing",
] as const;

/** Roles that receive gameplay modifiers in Phase E. */
export const TIER1_STAFF_ROLES: readonly StaffRole[] = [
  "general_manager",
  "head_coach",
  "scout",
  "trainer",
] as const;

export type StaffStrength =
  | "evaluation"
  | "development"
  | "leadership"
  | "scouting"
  | "motivation"
  | "discipline";

export const STAFF_STRENGTHS: readonly StaffStrength[] = [
  "evaluation",
  "development",
  "leadership",
  "scouting",
  "motivation",
  "discipline",
] as const;

export type StaffWeakness =
  | "ego"
  | "inexperience"
  | "communication"
  | "risk_averse"
  | "overconfident";

export const STAFF_WEAKNESSES: readonly StaffWeakness[] = [
  "ego",
  "inexperience",
  "communication",
  "risk_averse",
  "overconfident",
] as const;

export type Staff = {
  id: StaffId;
  teamId: TeamId | null;
  firstName: string;
  lastName: string;
  role: StaffRole;
  /** Overall quality 1–99. */
  quality: number;
  /** Years of experience (non-negative integer). */
  experience: number;
  strengths: StaffStrength[];
  weaknesses: StaffWeakness[];
};

export type StaffInput = {
  id: StaffId;
  teamId: TeamId | null;
  firstName: string;
  lastName: string;
  role: StaffRole;
  quality: number;
  experience: number;
  strengths: readonly StaffStrength[];
  weaknesses: readonly StaffWeakness[];
};

export function isStaffRole(value: unknown): value is StaffRole {
  return (
    typeof value === "string" &&
    (STAFF_ROLES as readonly string[]).includes(value)
  );
}

export function isStaffStrength(value: unknown): value is StaffStrength {
  return (
    typeof value === "string" &&
    (STAFF_STRENGTHS as readonly string[]).includes(value)
  );
}

export function isStaffWeakness(value: unknown): value is StaffWeakness {
  return (
    typeof value === "string" &&
    (STAFF_WEAKNESSES as readonly string[]).includes(value)
  );
}

export function createStaff(input: StaffInput): Staff {
  assertStaffShape(input);
  return {
    id: input.id,
    teamId: input.teamId,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    quality: input.quality,
    experience: input.experience,
    strengths: [...input.strengths],
    weaknesses: [...input.weaknesses],
  };
}

export function assertStaffShape(staff: StaffInput | Staff): void {
  assertNonEmptyId(staff.id, "id");
  if (staff.teamId !== null) {
    assertNonEmptyId(staff.teamId, "teamId");
  }
  assertNonEmptyName(staff.firstName, "firstName");
  assertNonEmptyName(staff.lastName, "lastName");
  if (!isStaffRole(staff.role)) {
    throw new Error(
      `Staff role must be one of ${STAFF_ROLES.join(", ")}.`,
    );
  }
  assertRating(staff.quality, "quality");
  if (
    typeof staff.experience !== "number" ||
    !Number.isInteger(staff.experience) ||
    staff.experience < 0
  ) {
    throw new Error("Staff experience must be a non-negative integer.");
  }
  assertTraitList(staff.strengths, "strengths", isStaffStrength);
  assertTraitList(staff.weaknesses, "weaknesses", isStaffWeakness);
}

function assertTraitList<T extends string>(
  value: readonly T[],
  field: string,
  isValid: (v: unknown) => v is T,
): void {
  if (!Array.isArray(value)) {
    throw new Error(`Staff ${field} must be an array.`);
  }
  const seen = new Set<string>();
  for (const item of value) {
    if (!isValid(item)) {
      throw new Error(`Staff ${field} contains invalid value "${String(item)}".`);
    }
    if (seen.has(item)) {
      throw new Error(`Staff ${field} contains duplicate "${item}".`);
    }
    seen.add(item);
  }
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Staff ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`Staff ${field} cannot be whitespace-only.`);
  }
}

function assertNonEmptyName(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Staff ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`Staff ${field} cannot be whitespace-only.`);
  }
}

function assertRating(value: number, field: string): void {
  if (
    !Number.isInteger(value) ||
    value < RATING_MIN ||
    value > RATING_MAX
  ) {
    throw new Error(
      `Staff ${field} must be an integer between ${RATING_MIN} and ${RATING_MAX}.`,
    );
  }
}
