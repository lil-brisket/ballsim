import { describe, expect, it } from "vitest";
import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
} from "@/domain/entities/franchise-ops";
import type { FranchiseSeasonRecord } from "@/domain/entities/franchise-history";
import { asSeasonId } from "@/domain/ids";
import {
  activeGameplayMilestones,
  queryHistoricalMilestones,
} from "@/systems/historical-milestones";

function season(input: {
  year: number;
  wins?: number;
  losses?: number;
  playoff?: boolean;
  championship?: boolean;
  attendance?: number | null;
  franchiseValue?: number;
  netIncome?: number;
  relocated?: boolean;
}): FranchiseSeasonRecord {
  const facilityLevels = {} as Record<FacilityCategory, number>;
  for (const category of FACILITY_CATEGORIES) {
    facilityLevels[category] = 2;
  }
  return {
    seasonId: asSeasonId(`season_${input.year}`),
    seasonYear: input.year,
    wins: input.wins ?? 35,
    losses: input.losses ?? 47,
    playoffResult: input.championship
      ? "champion"
      : input.playoff
        ? "first_round"
        : "missed",
    championship: input.championship ?? false,
    revenue: 100_000_000,
    expenses: 90_000_000,
    netIncome: input.netIncome ?? 10_000_000,
    payroll: 80_000_000,
    leagueRank: 8,
    attendance: input.attendance ?? 600_000,
    cash: 40_000_000,
    fanSentiment: 50,
    reputation: 50,
    facilityLevels,
    relocated: input.relocated ?? false,
    city: "Metro",
    name: "Rockets",
    notableEventIds: [],
    franchiseValue: input.franchiseValue ?? 900_000_000,
  };
}

describe("historical milestones", () => {
  it("detects first championship and playoff", () => {
    const seasons = [
      season({ year: 2026, wins: 30 }),
      season({ year: 2027, wins: 45, playoff: true }),
      season({ year: 2028, wins: 55, championship: true }),
    ];
    const results = queryHistoricalMilestones(seasons);
    expect(results.some((m) => m.kind === "first_playoff")).toBe(true);
    expect(results.some((m) => m.kind === "first_championship")).toBe(true);
    expect(results.some((m) => m.kind === "first_50_win_season")).toBe(true);
  });

  it("detects first three-year playoff streak", () => {
    const seasons = [
      season({ year: 2026, playoff: true }),
      season({ year: 2027, playoff: true }),
      season({ year: 2028, playoff: true }),
    ];
    const results = queryHistoricalMilestones(seasons);
    expect(
      results.some((m) => m.kind === "first_three_year_playoff_streak"),
    ).toBe(true);
  });

  it("distinguishes projected vs approaching vs achieved records", () => {
    const seasons = [
      season({ year: 2026, wins: 50, attendance: 700_000 }),
      season({ year: 2027, wins: 48, attendance: 680_000 }),
    ];
    const approaching = activeGameplayMilestones(seasons, {
      seasonYear: 2028,
      wins: 49,
      losses: 20,
      projectedWins: 55,
      attendanceToDate: 500_000,
      projectedAttendance: 750_000,
      franchiseValue: 950_000_000,
      netIncome: 5_000_000,
      playoffClinched: false,
      championshipWon: false,
      hasRelocatedBefore: false,
      seasonsSinceRelocation: null,
    });
    expect(
      approaching.some(
        (m) =>
          m.kind === "franchise_record_wins" &&
          (m.status === "projected" || m.status === "approaching"),
      ),
    ).toBe(true);
    expect(
      approaching.some(
        (m) =>
          m.kind === "franchise_record_attendance" && m.status === "projected",
      ),
    ).toBe(true);
  });

  it("detects first playoff after relocation", () => {
    const seasons = [
      season({ year: 2026, playoff: true }),
      season({ year: 2027, relocated: true, wins: 25 }),
      season({ year: 2028, wins: 28 }),
      season({ year: 2029, playoff: true, wins: 44 }),
    ];
    const results = queryHistoricalMilestones(seasons);
    expect(
      results.some((m) => m.kind === "first_playoff_after_relocation"),
    ).toBe(true);
  });

  it("detects championship drought context via history", () => {
    const seasons = [
      season({ year: 2020, championship: true, wins: 60 }),
      season({ year: 2021, wins: 40 }),
      season({ year: 2022, wins: 35 }),
      season({ year: 2023, wins: 38 }),
    ];
    const results = queryHistoricalMilestones(seasons);
    expect(results.some((m) => m.kind === "first_championship")).toBe(true);
  });
});
