import { describe, expect, it } from "vitest";
import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
} from "@/domain/entities/franchise-ops";
import type {
  FranchiseSeasonRecord,
  PlayoffResultSnapshot,
} from "@/domain/entities/franchise-history";
import { asSeasonId } from "@/domain/ids";
import {
  computeFranchiseHistoryMilestones,
  currentOwnershipTenureYears,
  getSeasonHistoricalHighlights,
} from "@/state/franchise-history-milestones";

function season(input: {
  year: number;
  wins?: number;
  losses?: number;
  playoffResult?: PlayoffResultSnapshot;
  championship?: boolean;
  franchiseValue?: number;
  attendance?: number | null;
}): FranchiseSeasonRecord {
  const facilityLevels = {} as Record<FacilityCategory, number>;
  for (const category of FACILITY_CATEGORIES) {
    facilityLevels[category] = 1;
  }
  return {
    seasonId: asSeasonId(`season_${input.year}`),
    seasonYear: input.year,
    wins: input.wins ?? 30,
    losses: input.losses ?? 52,
    playoffResult: input.playoffResult ?? "missed",
    championship: input.championship ?? false,
    revenue: 80_000_000,
    attendance: input.attendance === undefined ? null : input.attendance,
    cash: 40_000_000,
    fanSentiment: 50,
    reputation: 50,
    facilityLevels,
    relocated: false,
    city: "Test",
    name: "Team",
    notableEventIds: [],
    franchiseValue: input.franchiseValue ?? 400_000_000,
  };
}

describe("franchise history milestones", () => {
  it("returns safe defaults for empty history", () => {
    const milestones = computeFranchiseHistoryMilestones([], 2026, 2026);
    expect(milestones.totalSeasons).toBe(0);
    expect(milestones.championships).toBe(0);
    expect(milestones.playoffAppearances).toBe(0);
    expect(milestones.winningSeasons).toBe(0);
    expect(milestones.losingSeasons).toBe(0);
    expect(milestones.bestRecord).toBeNull();
    expect(milestones.highestFranchiseValue).toBeNull();
    expect(milestones.highestAttendance).toBeNull();
    expect(milestones.firstPlayoffSeason).toBeNull();
    expect(milestones.firstChampionshipSeason).toBeNull();
    expect(milestones.championshipDrought).toBeNull();
    expect(milestones.mostSuccessfulSeason).toBeNull();
    expect(milestones.currentOwnershipTenureYears).toBe(1);
    expect(milestones.longestPlayoffStreak).toBe(0);
  });

  it("counts winning, losing, and .500 seasons correctly", () => {
    const milestones = computeFranchiseHistoryMilestones(
      [
        season({ year: 2026, wins: 45, losses: 37 }),
        season({ year: 2027, wins: 30, losses: 52 }),
        season({ year: 2028, wins: 41, losses: 41 }),
      ],
      2026,
      2029,
    );
    expect(milestones.winningSeasons).toBe(1);
    expect(milestones.losingSeasons).toBe(1);
    expect(milestones.totalSeasons).toBe(3);
  });

  it("derives championships and playoff appearances", () => {
    const milestones = computeFranchiseHistoryMilestones(
      [
        season({ year: 2026, playoffResult: "first_round" }),
        season({ year: 2027, playoffResult: "missed" }),
        season({
          year: 2028,
          playoffResult: "champion",
          championship: true,
        }),
      ],
      2026,
      2029,
    );
    expect(milestones.championships).toBe(1);
    expect(milestones.playoffAppearances).toBe(2);
    expect(milestones.firstPlayoffSeason?.seasonYear).toBe(2026);
    expect(milestones.firstChampionshipSeason?.seasonYear).toBe(2028);
    expect(milestones.lastPlayoffSeason?.seasonYear).toBe(2028);
    expect(milestones.lastChampionshipSeason?.seasonYear).toBe(2028);
  });

  it("resolves best record by win% then wins then earliest", () => {
    const milestones = computeFranchiseHistoryMilestones(
      [
        season({ year: 2026, wins: 50, losses: 20 }),
        season({ year: 2027, wins: 60, losses: 22 }),
        season({ year: 2028, wins: 60, losses: 22 }),
      ],
      2026,
      2029,
    );
    expect(milestones.bestRecord?.seasonYear).toBe(2027);
    expect(milestones.bestWinningPercentage?.seasonYear).toBe(2027);
  });

  it("resolves highest franchise value and attendance with earliest tie-break", () => {
    const milestones = computeFranchiseHistoryMilestones(
      [
        season({
          year: 2026,
          franchiseValue: 500_000_000,
          attendance: 800_000,
        }),
        season({
          year: 2027,
          franchiseValue: 600_000_000,
          attendance: 900_000,
        }),
        season({
          year: 2028,
          franchiseValue: 600_000_000,
          attendance: 900_000,
        }),
        season({ year: 2029, franchiseValue: 550_000_000, attendance: null }),
      ],
      2026,
      2030,
    );
    expect(milestones.highestFranchiseValue).toEqual({
      value: 600_000_000,
      seasonYear: 2027,
    });
    expect(milestones.highestAttendance).toEqual({
      value: 900_000,
      seasonYear: 2027,
    });
  });

  it("counts ownership tenure including the current season", () => {
    expect(currentOwnershipTenureYears(2026, 2026)).toBe(1);
    expect(currentOwnershipTenureYears(2026, 2027)).toBe(2);
    expect(currentOwnershipTenureYears(2026, 2028)).toBe(3);
    const milestones = computeFranchiseHistoryMilestones(
      [
        season({ year: 2024 }),
        season({ year: 2025 }),
        season({ year: 2026 }),
      ],
      2026,
      2026,
    );
    expect(milestones.currentOwnershipTenureYears).toBe(1);
  });

  it("computes longest playoff streak and championship drought", () => {
    const withTitle = computeFranchiseHistoryMilestones(
      [
        season({ year: 2026, playoffResult: "first_round" }),
        season({ year: 2027, playoffResult: "second_round" }),
        season({ year: 2028, playoffResult: "missed" }),
        season({
          year: 2029,
          playoffResult: "champion",
          championship: true,
        }),
        season({ year: 2030, playoffResult: "missed" }),
        season({ year: 2031, playoffResult: "missed" }),
      ],
      2026,
      2032,
    );
    expect(withTitle.longestPlayoffStreak).toBe(2);
    expect(withTitle.championshipDrought).toBe(2);

    const neverChamp = computeFranchiseHistoryMilestones(
      [season({ year: 2026 }), season({ year: 2027 })],
      2026,
      2028,
    );
    expect(neverChamp.championshipDrought).toBeNull();
  });

  it("picks most successful season by documented tie-breaks", () => {
    const milestones = computeFranchiseHistoryMilestones(
      [
        season({
          year: 2026,
          wins: 55,
          losses: 27,
          playoffResult: "finals",
          franchiseValue: 700_000_000,
        }),
        season({
          year: 2027,
          wins: 40,
          losses: 42,
          playoffResult: "champion",
          championship: true,
          franchiseValue: 500_000_000,
        }),
        season({
          year: 2028,
          wins: 60,
          losses: 22,
          playoffResult: "champion",
          championship: true,
          franchiseValue: 500_000_000,
        }),
      ],
      2026,
      2029,
    );
    expect(milestones.mostSuccessfulSeason?.seasonYear).toBe(2028);
  });

  it("assigns multiple highlights to one season", () => {
    const seasons = [
      season({
        year: 2029,
        wins: 60,
        losses: 22,
        playoffResult: "champion",
        championship: true,
        franchiseValue: 800_000_000,
        attendance: 1_200_000,
      }),
    ];
    const highlights = getSeasonHistoricalHighlights(seasons);
    expect(highlights.get(2029)).toEqual(
      expect.arrayContaining([
        "championship",
        "best_record",
        "highest_franchise_value",
        "highest_attendance",
        "first_playoff",
        "first_championship",
      ]),
    );
  });
});
