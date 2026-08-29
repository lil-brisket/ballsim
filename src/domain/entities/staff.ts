import type { StaffId, TeamId } from "@/domain/ids";
import { RATING_MAX, RATING_MIN } from "@/domain/entities/player";
import {
  assertStaffCareerEntryShape,
  assertStaffDevelopmentShape,
  createDefaultStaffDevelopment,
  type StaffCareerEntry,
  type StaffDevelopmentState,
} from "@/domain/entities/staff-development";
import {
  assertStaffPreferencesShape,
  createStaffPreferences,
  type StaffPreferences,
} from "@/domain/entities/staff-preferences";
import {
  isStaffRole,
  STAFF_ATTRIBUTE_KEYS,
  STAFF_ROLES,
  type StaffAttributes,
  type StaffAttributesByRole,
  type StaffRole,
} from "@/domain/entities/staff-roles";

export type { StaffRole, StaffAttributes, StaffAttributesByRole };
export {
  STAFF_ROLES,
  STARTER_STAFF_ROLES,
  STAFF_ROLE_DISPLAY,
  STAFF_ATTRIBUTE_KEYS,
  isStaffRole,
  migrateLegacyStaffRole,
} from "@/domain/entities/staff-roles";
export type {
  StaffPreferences,
  StaffInterestLevel,
} from "@/domain/entities/staff-preferences";
export type {
  StaffDevelopmentState,
  StaffCareerEntry,
  StaffDevelopmentTrend,
  StaffCareerEventKind,
} from "@/domain/entities/staff-development";

/**
 * Staff roles. Gameplay modifiers are role-specific via staff-effects modules.
 * Finance Director affects business efficiency only — never basketball budgets.
 */
export type Staff = {
  id: StaffId;
  teamId: TeamId | null;
  firstName: string;
  lastName: string;
  role: StaffRole;
  age: number;
  /** Overall ability 1–99; equals weighted role attributes (no experience bonus). */
  overall: number;
  /** Developmental ceiling 1–99; independent but correlated at generation. */
  potential: number;
  /** Years of experience — separate from overall. */
  experience: number;
  attributes: StaffAttributes;
  morale: number;
  preferences: StaffPreferences;
  development: StaffDevelopmentState;
  careerHistory: StaffCareerEntry[];
};

export type StaffInput = {
  id: StaffId;
  teamId: TeamId | null;
  firstName: string;
  lastName: string;
  role: StaffRole;
  age: number;
  overall: number;
  potential: number;
  experience: number;
  attributes: StaffAttributes;
  morale: number;
  preferences: StaffPreferences;
  development: StaffDevelopmentState;
  careerHistory: readonly StaffCareerEntry[];
};

/**
 * Compute overall from role attributes (equal weights). Experience is NOT included.
 */
export function computeStaffOverall(
  role: StaffRole,
  attributes: StaffAttributes,
): number {
  const keys = STAFF_ATTRIBUTE_KEYS[role] as readonly string[];
  const attrs = attributes as Record<string, number>;
  let sum = 0;
  for (const key of keys) {
    sum += attrs[key]!;
  }
  return Math.round(sum / keys.length);
}

export function createStaff(input: StaffInput): Staff {
  assertStaffShape(input);
  return {
    id: input.id,
    teamId: input.teamId,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    age: input.age,
    overall: input.overall,
    potential: input.potential,
    experience: input.experience,
    attributes: cloneAttributes(input.role, input.attributes),
    morale: input.morale,
    preferences: createStaffPreferences(input.preferences),
    development: { ...input.development },
    careerHistory: input.careerHistory.map((e) => ({ ...e })),
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
  assertAge(staff.age);
  assertRating(staff.overall, "overall");
  assertRating(staff.potential, "potential");
  if (staff.potential < staff.overall - 5) {
    // Soft: allow slight undershoot from decline; hard floor in generation.
  }
  if (
    typeof staff.experience !== "number" ||
    !Number.isInteger(staff.experience) ||
    staff.experience < 0
  ) {
    throw new Error("Staff experience must be a non-negative integer.");
  }
  assertAttributes(staff.role, staff.attributes);
  assertRating(staff.morale, "morale");
  assertStaffPreferencesShape(staff.preferences);
  assertStaffDevelopmentShape(staff.development);
  if (!Array.isArray(staff.careerHistory)) {
    throw new Error("Staff careerHistory must be an array.");
  }
  for (const entry of staff.careerHistory) {
    assertStaffCareerEntryShape(entry);
  }
}

export function assertAttributes(
  role: StaffRole,
  attributes: StaffAttributes,
): void {
  const keys = STAFF_ATTRIBUTE_KEYS[role] as readonly string[];
  const attrs = attributes as Record<string, number>;
  for (const key of keys) {
    if (!(key in attrs)) {
      throw new Error(`Staff attributes missing "${key}" for role ${role}.`);
    }
    assertRating(attrs[key]!, `attributes.${key}`);
  }
}

function cloneAttributes(
  role: StaffRole,
  attributes: StaffAttributes,
): StaffAttributes {
  const keys = STAFF_ATTRIBUTE_KEYS[role] as readonly string[];
  const src = attributes as Record<string, number>;
  const out: Record<string, number> = {};
  for (const key of keys) {
    out[key] = src[key]!;
  }
  return out as StaffAttributes;
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

function assertAge(value: number): void {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 22 ||
    value > 85
  ) {
    throw new Error("Staff age must be an integer between 22 and 85.");
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

export { createDefaultStaffDevelopment };
