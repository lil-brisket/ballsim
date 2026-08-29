import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  FranchiseHistorySeasonTable,
  FranchiseHistorySummary,
} from "@/components/owner/FranchiseHistorySummary";
import type { FranchiseHistoryView } from "@/state/franchise-selectors";
import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
} from "@/domain/entities/franchise-ops";
import { asSeasonId } from "@/domain/ids";
import { computeFranchiseHistoryMilestones } from "@/state/franchise-history-milestones";

function emptyFacilities(): Record<string, number> {
  const levels = {} as Record<FacilityCategory, number>;
  for (const category of FACILITY_CATEGORIES) {
    levels[category] = 1;
  }
  return levels;
}

function buildView(
  overrides?: Partial<FranchiseHistoryView>,
): FranchiseHistoryView {
  const seasons = overrides?.seasons ?? [];
  const milestones =
    overrides?.milestones ??
    computeFranchiseHistoryMilestones(
      seasons.map(({ playoffLabel: _p, highlights: _h, ...rest }) => rest),
      2026,
      2026,
    );
  return {
    seasons,
    milestones,
    ownerTenureYears: overrides?.ownerTenureYears ?? milestones.currentOwnershipTenureYears,
  };
}

describe("Franchise history UI", () => {
  it("renders empty summary without crashing", () => {
    const view = buildView();
    const { unmount } = render(<FranchiseHistorySummary view={view} />);
    expect(screen.getByText("Championships")).toBeTruthy();
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    expect(screen.getByText("Years under current ownership")).toBeTruthy();
    unmount();
  });

  it("renders summary milestones from the view model", () => {
    const facilityLevels = emptyFacilities();
    const seasons = [
      {
        seasonId: asSeasonId("season_2029"),
        seasonYear: 2029,
        wins: 55,
        losses: 27,
        playoffResult: "champion" as const,
        championship: true,
        revenue: 100,
        expenses: 80,
        netIncome: 20,
        payroll: 50,
        leagueRank: 1,
        attendance: 1_000_000,
        businessFunds: 10,
        fanSentiment: 70,
        reputation: 70,
        facilityLevels,
        relocated: false,
        city: "A",
        name: "B",
        notableEventIds: [],
        franchiseValue: 900_000_000,
        playoffLabel: "Champion",
        highlights: ["championship" as const, "best_record" as const],
      },
    ];
    const view = buildView({ seasons });
    const { unmount } = render(<FranchiseHistorySummary view={view} />);
    expect(screen.getByText("Championships")).toBeTruthy();
    expect(screen.getByText("55-27")).toBeTruthy();
    expect(screen.getAllByText("2029").length).toBeGreaterThan(0);
    expect(screen.getByText("$900.0M")).toBeTruthy();
    unmount();
  });

  it("renders attendance, null attendance, and multiple highlights", () => {
    const facilityLevels = emptyFacilities();
    const seasons = [
      {
        seasonId: asSeasonId("season_2028"),
        seasonYear: 2028,
        wins: 40,
        losses: 42,
        playoffResult: "missed" as const,
        championship: false,
        revenue: 50,
        expenses: 40,
        netIncome: 10,
        payroll: 30,
        leagueRank: null,
        attendance: null,
        businessFunds: 10,
        fanSentiment: 40,
        reputation: 40,
        facilityLevels,
        relocated: false,
        city: "A",
        name: "B",
        notableEventIds: [],
        franchiseValue: 300_000_000,
        playoffLabel: "missed",
        highlights: [] as const,
      },
      {
        seasonId: asSeasonId("season_2029"),
        seasonYear: 2029,
        wins: 60,
        losses: 22,
        playoffResult: "champion" as const,
        championship: true,
        revenue: 120,
        expenses: 90,
        netIncome: 30,
        payroll: 60,
        leagueRank: 1,
        attendance: 1_250_000,
        businessFunds: 20,
        fanSentiment: 80,
        reputation: 80,
        facilityLevels,
        relocated: false,
        city: "A",
        name: "B",
        notableEventIds: [],
        franchiseValue: 950_000_000,
        playoffLabel: "Champion",
        highlights: [
          "championship" as const,
          "best_record" as const,
          "highest_franchise_value" as const,
          "highest_attendance" as const,
        ],
      },
    ];
    const { unmount } = render(
      <FranchiseHistorySeasonTable seasons={[...seasons]} />,
    );
    expect(screen.getByText("Attendance")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("1,250,000")).toBeTruthy();
    expect(screen.getByText("Champion")).toBeTruthy();
    expect(screen.getByText("Championship")).toBeTruthy();
    expect(screen.getByText("Highest value")).toBeTruthy();
    expect(screen.getAllByText("Best record").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Highest attendance").length).toBeGreaterThan(0);
    unmount();
  });
});
