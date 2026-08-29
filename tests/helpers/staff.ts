import {
  computeStaffOverall,
  createStaff,
  type Staff,
  type StaffInput,
  type StaffRole,
} from "@/domain/entities/staff";
import { createDefaultStaffDevelopment } from "@/domain/entities/staff-development";
import {
  attributesFromLegacyQuality,
  deriveAgeFromExperience,
  derivePotentialForMigration,
  preferencesForMigration,
} from "@/systems/staff-ratings";

/**
 * Test helper: builds valid Staff with defaults for the post-overhaul shape.
 */
export function testStaff(
  overrides: Partial<StaffInput> &
    Pick<StaffInput, "id" | "role"> & {
      firstName?: string;
      lastName?: string;
    },
): Staff {
  const role: StaffRole = overrides.role;
  const experience = overrides.experience ?? 5;
  const age = overrides.age ?? deriveAgeFromExperience(experience);
  const overallHint = overrides.overall ?? 60;
  const attributes =
    overrides.attributes ??
    attributesFromLegacyQuality(role, overallHint, [], []);
  const overall = overrides.overall ?? computeStaffOverall(role, attributes);
  const potential =
    overrides.potential ?? derivePotentialForMigration(overall, age);
  const preferences =
    overrides.preferences ??
    preferencesForMigration(role, overall, age, experience);

  return createStaff({
    id: overrides.id,
    teamId: overrides.teamId ?? null,
    firstName: overrides.firstName ?? "Test",
    lastName: overrides.lastName ?? "Staff",
    role,
    age,
    overall,
    potential,
    experience,
    attributes,
    morale: overrides.morale ?? 60,
    preferences,
    development: overrides.development ?? createDefaultStaffDevelopment(),
    careerHistory: overrides.careerHistory ?? [],
  });
}
