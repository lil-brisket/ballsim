import { describe, expect, it } from "vitest";
import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
} from "@/domain/entities/franchise-ops";
import type { FranchiseSeasonRecord } from "@/domain/entities/franchise-history";
import { asSeasonId } from "@/domain/ids";
import { detectFranchiseEras } from "@/systems/franchise-eras";

function season(input: {
  year: number;
  wins: number;
  losses?: number;
  playoff?: boolean;
  championship?: boolean;
  cash?: number;
  netIncome?: number;
  franchiseValue?: number;
}): FranchiseSeasonRecord {
  const facilityLevels = {} as Record<FacilityCategory, number>;
  for (const category of FACILITY_CATEGORIES) {
    facilityLevels[category] = 2;
  }
  const losses = input.losses ?? 82 - input.wins;
  return {
    seasonId: asSeasonId(`season_${input.year}`),
    seasonYear: input.year,
    wins: input.wins,
    losses,
    playoffResult: input.championship
      ? "champion"
      : input.playoff
        ? "conference_finals"
        : "missed",
    championship: input.championship ?? false,
    revenue: 120_000_000,
    expenses: 100_000_000,
    netIncome: input.netIncome ?? 10_000_000,
    payroll: 90_000_000,
    leagueRank: 5,
    attendance: 700_000,
    cash: input.cash ?? 40_000_000,
    fanSentiment: 55,
    reputation: 55,
    facilityLevels,
    relocated: false,
    city: "Capital",
    name: "Kings",
    notableEventIds: [],
    franchiseValue: input.franchiseValue ?? 1_000_000_000,
  };
}

describe("franchise era detection", () => {
  it("classifies rebuilding from sustained poor records", () => {
    const seasons = [
      season({ year: 2026, wins: 22 }),
      season({ year: 2027, wins: 25 }),
      season({ year: 2028, wins: 28 }),
    ];
    const { eras } = detectFranchiseEras(seasons, { foundedSeasonYear: 2026 });
    expect(eras.length).toBeGreaterThan(0);
    expect(
      eras.some(
        (e) =>
          e.classification === "rebuilding" ||
          e.classification === "new_franchise",
      ),
    ).toBe(true);
  });

  it("classifies golden era from titles and sustained success", () => {
    const seasons = [
      season({ year: 2030, wins: 55, playoff: true, championship: true, franchiseValue: 1.4e9 }),
      season({ year: 2031, wins: 58, playoff: true, championship: true, franchiseValue: 1.5e9 }),
      season({ year: 2032, wins: 56, playoff: true, franchiseValue: 1.55e9 }),
      season({ year: 2033, wins: 60, playoff: true, championship: true, franchiseValue: 1.7e9 }),
    ];
    const { eras } = detectFranchiseEras(seasons, { foundedSeasonYear: 2020 });
    expect(eras.some((e) => e.classification === "golden_era")).toBe(true);
    const golden = eras.find((e) => e.classification === "golden_era")!;
    expect(golden.drivers.length).toBeGreaterThan(0);
    expect(golden.confidence).toBeGreaterThan(0.5);
  });

  it("detects financial crisis", () => {
    const seasons = [
      season({ year: 2040, wins: 40, cash: -1, netIncome: -30_000_000 }),
      season({ year: 2041, wins: 38, cash: -5_000_000, netIncome: -25_000_000 }),
    ];
    const { eras } = detectFranchiseEras(seasons);
    expect(eras.some((e) => e.classification === "financial_crisis")).toBe(true);
  });

  it("uses hysteresis to avoid noisy era flipping", () => {
    const seasons = [
      season({ year: 2030, wins: 48, playoff: true }),
      season({ year: 2031, wins: 50, playoff: true }),
      season({ year: 2032, wins: 47, playoff: true }),
      season({ year: 2033, wins: 44, playoff: true }),
      season({ year: 2034, wins: 49, playoff: true }),
    ];
    const { eras, transitions } = detectFranchiseEras(seasons, {
      foundedSeasonYear: 2020,
    });
    // Should not produce a transition every single season
    expect(transitions.length).toBeLessThan(seasons.length - 1);
    expect(eras.length).toBeLessThanOrEqual(3);
  });

  it("records explainable transitions", () => {
    const seasons = [
      season({ year: 2026, wins: 22 }),
      season({ year: 2027, wins: 24 }),
      season({ year: 2028, wins: 26 }),
      season({ year: 2029, wins: 45, playoff: true }),
      season({ year: 2030, wins: 50, playoff: true }),
      season({ year: 2031, wins: 52, playoff: true }),
    ];
    const { transitions } = detectFranchiseEras(seasons, {
      foundedSeasonYear: 2026,
    });
    for (const t of transitions) {
      expect(t.message).toContain("→");
      expect(t.drivers.length).toBeGreaterThan(0);
    }
  });
});
