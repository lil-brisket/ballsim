import { RATING_MAX, RATING_MIN } from "@/domain/entities/player";
import {
  createDefaultStaffDevelopment,
  type StaffCareerEntry,
  type StaffDevelopmentState,
} from "@/domain/entities/staff-development";
import type { StaffPreferences } from "@/domain/entities/staff-preferences";
import {
  STAFF_ATTRIBUTE_KEYS,
  type StaffAttributes,
  type StaffRole,
} from "@/domain/entities/staff-roles";
import {
  computeStaffOverall,
  createStaff,
  migrateLegacyStaffRole,
  type Staff,
} from "@/domain/entities/staff";
import type { StaffId, TeamId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import {
  STAFF_BASE_SALARY_BY_ROLE,
  STAFF_SALARY_QUALITY_CENTER,
  STAFF_SALARY_QUALITY_PCT_PER_POINT,
} from "@/systems/staff-config";

function clampRating(value: number): number {
  return Math.max(
    RATING_MIN,
    Math.min(RATING_MAX, Math.round(value)),
  );
}

/**
 * Generate role attributes clustered around a target overall with noise.
 */
export function generateAttributesAroundOverall(
  role: StaffRole,
  targetOverall: number,
  rng: Rng,
): StaffAttributes {
  const keys = STAFF_ATTRIBUTE_KEYS[role] as readonly string[];
  const out: Record<string, number> = {};
  for (const key of keys) {
    const noise = rng.nextInt(-8, 8);
    out[key] = clampRating(targetOverall + noise);
  }
  // Nudge mean toward targetOverall
  const mean =
    keys.reduce((sum, key) => sum + out[key]!, 0) / keys.length;
  const adjust = targetOverall - mean;
  for (const key of keys) {
    out[key] = clampRating(out[key]! + adjust);
  }
  return out as StaffAttributes;
}

/**
 * Legacy migration: build attributes from quality + optional strength/weakness tags.
 */
export function attributesFromLegacyQuality(
  role: StaffRole,
  quality: number,
  strengths: readonly string[],
  weaknesses: readonly string[],
): StaffAttributes {
  const keys = STAFF_ATTRIBUTE_KEYS[role] as readonly string[];
  const out: Record<string, number> = {};
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i]!;
    let value = quality;
    // Deterministic spread from key index
    value += ((i * 7) % 11) - 5;
    if (strengths.length > 0 && i % 3 === 0) {
      value += 4;
    }
    if (weaknesses.length > 0 && i % 4 === 0) {
      value -= 4;
    }
    out[key] = clampRating(value);
  }
  return out as StaffAttributes;
}

/**
 * Independent but correlated potential for newly generated staff.
 */
export function generateStaffPotential(
  overall: number,
  age: number,
  rng: Rng,
): number {
  const room = Math.max(0, RATING_MAX - overall);
  let bonus: number;
  if (age <= 35) {
    // Young: wider potential range (star or bust)
    if (rng.chance(0.15)) {
      bonus = rng.nextInt(Math.min(room, 18), Math.min(room, 32));
    } else if (rng.chance(0.2)) {
      bonus = rng.nextInt(0, 4); // bust
    } else {
      bonus = rng.nextInt(5, Math.min(room, 20));
    }
  } else if (age <= 50) {
    bonus = rng.nextInt(0, Math.min(room, 10));
  } else {
    bonus = rng.nextInt(0, Math.min(room, 5));
  }
  return clampRating(overall + bonus);
}

/**
 * Legacy-save migration heuristic for potential (no RNG).
 */
export function derivePotentialForMigration(
  overall: number,
  age: number,
): number {
  let bonus = 0;
  if (age <= 35) {
    bonus = Math.min(20, Math.round((99 - overall) * 0.45));
  } else if (age <= 50) {
    bonus = Math.min(8, Math.round((99 - overall) * 0.2));
  } else {
    bonus = Math.min(3, Math.round((99 - overall) * 0.1));
  }
  return clampRating(overall + bonus);
}

export function deriveAgeFromExperience(experience: number): number {
  // Mid-career baseline: started around 28
  return Math.max(25, Math.min(72, 28 + experience));
}

export function annualSalaryFromOverall(
  role: StaffRole,
  overall: number,
): number {
  const base = STAFF_BASE_SALARY_BY_ROLE[role] ?? 500_000;
  const mult =
    1 +
    (overall - STAFF_SALARY_QUALITY_CENTER) *
      STAFF_SALARY_QUALITY_PCT_PER_POINT;
  return Math.max(0, Math.round(base * Math.max(0.4, mult)));
}

export function generateStaffPreferences(
  role: StaffRole,
  overall: number,
  age: number,
  experience: number,
  rng: Rng,
): StaffPreferences {
  const desired = annualSalaryFromOverall(role, overall);
  const minimum = Math.round(desired * (0.7 + rng.nextInt(0, 20) / 100));
  const preferredRole =
    role === "assistant_coach" && rng.chance(0.45)
      ? ("head_coach" as const)
      : role === "scout" && rng.chance(0.15)
        ? ("general_manager" as const)
        : null;

  return {
    salaryWeight: rng.nextInt(20, 90),
    securityWeight: age > 45 ? rng.nextInt(50, 95) : rng.nextInt(20, 70),
    winningWeight: rng.nextInt(25, 85),
    developmentOpportunityWeight:
      age < 40 ? rng.nextInt(40, 90) : rng.nextInt(10, 50),
    promotionWeight: preferredRole ? rng.nextInt(40, 90) : rng.nextInt(5, 40),
    rolePreferenceWeight: preferredRole
      ? rng.nextInt(30, 80)
      : rng.nextInt(0, 25),
    minimumSalary: minimum,
    desiredSalary: Math.max(minimum, desired),
    preferredContractYears: experience > 15 ? rng.nextInt(2, 5) : rng.nextInt(1, 4),
    preferredRole,
  };
}

/** Deterministic preferences for migration (no RNG). */
export function preferencesForMigration(
  role: StaffRole,
  overall: number,
  age: number,
  experience: number,
): StaffPreferences {
  const desired = annualSalaryFromOverall(role, overall);
  const minimum = Math.round(desired * 0.8);
  const preferredRole =
    role === "assistant_coach" ? ("head_coach" as const) : null;
  return {
    salaryWeight: 50,
    securityWeight: age > 45 ? 70 : 40,
    winningWeight: 50,
    developmentOpportunityWeight: age < 40 ? 60 : 30,
    promotionWeight: preferredRole ? 55 : 20,
    rolePreferenceWeight: preferredRole ? 40 : 10,
    minimumSalary: minimum,
    desiredSalary: desired,
    preferredContractYears: 3,
    preferredRole,
  };
}

export type StaffCareerArchetype =
  | "elite"
  | "veteran"
  | "average"
  | "developmental";

export function pickCareerArchetype(rng: Rng): StaffCareerArchetype {
  const roll = rng.nextInt(1, 100);
  if (roll <= 5) return "elite";
  if (roll <= 30) return "veteran";
  if (roll <= 75) return "average";
  return "developmental";
}

export function generateStaffProfile(
  role: StaffRole,
  rng: Rng,
  options: { teamId: string | null; seasonYear: number } = {
    teamId: null,
    seasonYear: 2026,
  },
): {
  age: number;
  overall: number;
  potential: number;
  experience: number;
  attributes: StaffAttributes;
  morale: number;
  preferences: StaffPreferences;
  development: StaffDevelopmentState;
  careerHistory: StaffCareerEntry[];
} {
  const archetype = pickCareerArchetype(rng);
  let age: number;
  let targetOverall: number;
  let experience: number;

  switch (archetype) {
    case "elite":
      age = rng.nextInt(38, 62);
      targetOverall = rng.nextInt(82, 94);
      experience = Math.max(8, age - 28 + rng.nextInt(-2, 4));
      break;
    case "veteran":
      age = rng.nextInt(42, 65);
      targetOverall = rng.nextInt(68, 80);
      experience = Math.max(10, age - 28 + rng.nextInt(-3, 3));
      break;
    case "average":
      age = rng.nextInt(30, 55);
      targetOverall = rng.nextInt(52, 70);
      experience = Math.max(0, age - 28 + rng.nextInt(-2, 4));
      break;
    case "developmental":
      age = rng.nextInt(25, 38);
      targetOverall = rng.nextInt(38, 58);
      experience = Math.max(0, age - 28 + rng.nextInt(0, 4));
      break;
  }

  experience = Math.max(0, experience);
  const attributes = generateAttributesAroundOverall(role, targetOverall, rng);
  const overall = computeStaffOverall(role, attributes);
  const potential = generateStaffPotential(overall, age, rng);
  const preferences = generateStaffPreferences(
    role,
    overall,
    age,
    experience,
    rng,
  );
  const careerHistory: StaffCareerEntry[] = [];
  if (options.teamId !== null) {
    careerHistory.push({
      seasonYear: options.seasonYear,
      teamId: options.teamId,
      role,
      overall,
      kind: "joined",
    });
  }

  return {
    age,
    overall,
    potential,
    experience,
    attributes,
    morale: rng.nextInt(45, 75),
    preferences,
    development: createDefaultStaffDevelopment(),
    careerHistory,
  };
}

export function topAttributeLabels(
  role: StaffRole,
  attributes: StaffAttributes,
  count = 3,
): string[] {
  const keys = STAFF_ATTRIBUTE_KEYS[role] as readonly string[];
  const attrs = attributes as Record<string, number>;
  return [...keys]
    .sort((a, b) => attrs[b]! - attrs[a]!)
    .slice(0, count)
    .map(humanizeAttrKey);
}

export function bottomAttributeLabels(
  role: StaffRole,
  attributes: StaffAttributes,
  count = 2,
): string[] {
  const keys = STAFF_ATTRIBUTE_KEYS[role] as readonly string[];
  const attrs = attributes as Record<string, number>;
  return [...keys]
    .sort((a, b) => attrs[a]! - attrs[b]!)
    .slice(0, count)
    .map(humanizeAttrKey);
}

function humanizeAttrKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/**
 * Hydrate Staff from persisted JSON (legacy quality/strengths or new shape).
 */
export function hydrateStaffFromPersisted(
  raw: Record<string, unknown>,
  fallbackId: string,
): Staff {
  const role = migrateLegacyStaffRole(String(raw.role ?? "assistant_coach"));
  const experience =
    typeof raw.experience === "number" && Number.isInteger(raw.experience)
      ? Math.max(0, raw.experience)
      : 5;
  const age =
    typeof raw.age === "number" && Number.isInteger(raw.age)
      ? raw.age
      : deriveAgeFromExperience(experience);

  const hasNewShape =
    raw.attributes != null &&
    typeof raw.attributes === "object" &&
    typeof raw.overall === "number";

  const quality =
    typeof raw.quality === "number" ? raw.quality : 50;
  const strengths = Array.isArray(raw.strengths)
    ? raw.strengths.map(String)
    : [];
  const weaknesses = Array.isArray(raw.weaknesses)
    ? raw.weaknesses.map(String)
    : [];

  const attributes = hasNewShape
    ? (raw.attributes as StaffAttributes)
    : attributesFromLegacyQuality(role, quality, strengths, weaknesses);
  const overall = hasNewShape
    ? (raw.overall as number)
    : computeStaffOverall(role, attributes);
  const potential =
    typeof raw.potential === "number"
      ? raw.potential
      : derivePotentialForMigration(overall, age);
  const morale =
    typeof raw.morale === "number" ? raw.morale : 60;
  const preferences =
    raw.preferences != null && typeof raw.preferences === "object"
      ? (raw.preferences as StaffPreferences)
      : preferencesForMigration(role, overall, age, experience);
  const development =
    raw.development != null && typeof raw.development === "object"
      ? (raw.development as StaffDevelopmentState)
      : createDefaultStaffDevelopment();
  const careerHistory = Array.isArray(raw.careerHistory)
    ? (raw.careerHistory as StaffCareerEntry[])
    : [];

  let teamId = (raw.teamId as TeamId | null) ?? null;
  if (teamId !== null && typeof teamId !== "string") {
    teamId = null;
  }

  return createStaff({
    id: (typeof raw.id === "string" && raw.id.length > 0
      ? raw.id
      : fallbackId) as StaffId,
    teamId,
    firstName: String(raw.firstName ?? "Unknown"),
    lastName: String(raw.lastName ?? "Staff"),
    role,
    age,
    overall,
    potential,
    experience,
    attributes,
    morale,
    preferences,
    development,
    careerHistory,
  });
}
