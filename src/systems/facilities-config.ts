import type { FacilityCategory } from "@/domain/entities/franchise-ops";
import { FACILITY_LEVEL_MAX } from "@/domain/entities/franchise-ops";

/** Weeks required to complete a facility upgrade. */
export const FACILITY_UPGRADE_WEEKS = 4;

/** Arena seating capacity by facility level (index 0 = level 1). */
export const ARENA_CAPACITY_BY_LEVEL: readonly number[] = [
  12_000,
  15_000,
  18_000,
  21_000,
  25_000,
];

/** One-time upgrade cost from level N to N+1 (index 0 = 1→2). */
const UPGRADE_COST_BASE: Record<FacilityCategory, readonly number[]> = {
  arena: [2_500_000, 4_000_000, 6_000_000, 9_000_000],
  practice: [500_000, 900_000, 1_400_000, 2_000_000],
  training: [600_000, 1_000_000, 1_500_000, 2_200_000],
  medical: [400_000, 750_000, 1_200_000, 1_800_000],
  youth: [350_000, 650_000, 1_000_000, 1_500_000],
  fan: [300_000, 550_000, 850_000, 1_200_000],
};

/** Weekly operating expense by current level (index 0 = level 1). */
const WEEKLY_OPEX_BASE: Record<FacilityCategory, readonly number[]> = {
  arena: [25_000, 35_000, 48_000, 62_000, 78_000],
  practice: [8_000, 12_000, 17_000, 23_000, 30_000],
  training: [7_000, 11_000, 16_000, 22_000, 29_000],
  medical: [6_000, 9_000, 13_000, 18_000, 24_000],
  youth: [5_000, 8_000, 12_000, 16_000, 21_000],
  fan: [4_000, 7_000, 10_000, 14_000, 18_000],
};

export function facilityUpgradeCost(
  category: FacilityCategory,
  currentLevel: number,
): number {
  if (currentLevel < 1 || currentLevel >= FACILITY_LEVEL_MAX) {
    throw new Error(
      `facilityUpgradeCost: level ${currentLevel} cannot be upgraded.`,
    );
  }
  return UPGRADE_COST_BASE[category][currentLevel - 1]!;
}

export function facilityWeeklyOpex(
  category: FacilityCategory,
  level: number,
): number {
  if (level < 1 || level > FACILITY_LEVEL_MAX) {
    throw new Error(`facilityWeeklyOpex: invalid level ${level}.`);
  }
  return WEEKLY_OPEX_BASE[category][level - 1]!;
}

export function arenaCapacityForLevel(level: number): number {
  if (level < 1 || level > FACILITY_LEVEL_MAX) {
    throw new Error(`arenaCapacityForLevel: invalid level ${level}.`);
  }
  return ARENA_CAPACITY_BY_LEVEL[level - 1]!;
}
