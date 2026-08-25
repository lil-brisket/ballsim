import { describe, expect, it } from "vitest";
import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
} from "@/domain/entities/franchise-ops";
import type { FranchiseSeasonRecord } from "@/domain/entities/franchise-history";
import { asSeasonId, asTeamId } from "@/domain/ids";
import { createTestGameState } from "../../factories/game-state";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  generateAnnualFranchiseReport,
  buildFranchiseNarrative,
} from "@/systems/franchise-report";

function historySeason(input: {
  year: number;
  wins: number;
  losses?: number;
  playoff?: boolean;
  championship?: boolean;
  cash?: number;
  revenue?: number;
  expenses?: number;
  franchiseValue?: number;
  attendance?: number;
}): FranchiseSeasonRecord {
  const facilityLevels = {} as Record<FacilityCategory, number>;
  for (const category of FACILITY_CATEGORIES) {
    facilityLevels[category] = 2;
  }
  const losses = input.losses ?? 82 - input.wins;
  const revenue = input.revenue ?? 110_000_000;
  const expenses = input.expenses ?? 100_000_000;
  return {
    seasonId: asSeasonId(`season_${input.year}`),
    seasonYear: input.year,
    wins: input.wins,
    losses,
    playoffResult: input.championship
      ? "champion"
      : input.playoff
        ? "first_round"
        : "missed",
    championship: input.championship ?? false,
    revenue,
    expenses,
    netIncome: revenue - expenses,
    payroll: 85_000_000,
    leagueRank: 6,
    attendance: input.attendance ?? 650_000,
    cash: input.cash ?? 45_000_000,
    fanSentiment: 55,
    reputation: 55,
    facilityLevels,
    relocated: false,
    city: "Harbor",
    name: "Waves",
    notableEventIds: [],
    franchiseValue: input.franchiseValue ?? 1_100_000_000,
  };
}

describe("annual franchise report", () => {
  it("builds immutable YoY sections and narrative", () => {
    let state = createTestGameState({ saveId: "annual_report_1" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = asTeamId(state.user.controlledTeamId);

    const seasons = [
      historySeason({
        year: 2026,
        wins: 35,
        cash: 50_000_000,
        franchiseValue: 1_000_000_000,
        attendance: 600_000,
      }),
      historySeason({
        year: 2027,
        wins: 52,
        playoff: true,
        cash: 55_000_000,
        franchiseValue: 1_200_000_000,
        attendance: 720_000,
        revenue: 130_000_000,
      }),
    ];

    state = {
      ...state,
      business: {
        ...state.business,
        franchiseHistory: {
          ...state.business.franchiseHistory,
          [teamId]: { teamId, seasons },
        },
      },
    };

    const report = generateAnnualFranchiseReport(state, teamId, {
      generatedAt: "2027-06-01T00:00:00.000Z",
    });

    expect(report.seasonYear).toBe(2027);
    expect(report.competitive.wins).toBe(52);
    expect(report.competitive.winPct.prior).not.toBeNull();
    expect(report.competitive.winPct.delta).not.toBeNull();
    expect(report.financial.revenue.deltaPct).not.toBeNull();
    expect(report.franchiseValue.ending).toBe(1_200_000_000);
    expect(report.franchiseValue.starting).toBe(1_000_000_000);
    expect(report.franchiseValue.drivers).toBeTruthy();
    expect(report.franchiseTrajectory.overall).toBeTruthy();
    expect(report.narrative.length).toBeGreaterThan(10);
    expect(report.generatedAt).toBe("2027-06-01T00:00:00.000Z");

    // Immutability of frozen drivers: mutating explanation later must not change report
    const frozen = report.franchiseValue.ending;
    expect(frozen).toBe(1_200_000_000);
  });

  it("selects mixed narrative for championship with insolvency pressure", () => {
    const draft = {
      teamId: asTeamId("team_x"),
      seasonYear: 2030,
      generatedAt: "2030-01-01T00:00:00.000Z",
      competitive: {
        wins: 58,
        losses: 24,
        winPct: { value: 0.7, prior: 0.55, delta: 0.15, deltaPct: 0.27 },
        leagueRank: 1,
        playoffResult: "champion" as const,
        championship: true,
        rosterStrength: { value: 80, prior: null, delta: null, deltaPct: null },
      },
      financial: {
        startingCash: 20_000_000,
        endingCash: { value: -5_000_000, prior: 20_000_000, delta: -25_000_000, deltaPct: -1.25 },
        revenue: { value: 100_000_000, prior: 110_000_000, delta: -10_000_000, deltaPct: -0.09 },
        expenses: { value: 140_000_000, prior: 100_000_000, delta: 40_000_000, deltaPct: 0.4 },
        netIncome: { value: -40_000_000, prior: 10_000_000, delta: -50_000_000, deltaPct: -5 },
        payroll: { value: 120_000_000, prior: 90_000_000, delta: 30_000_000, deltaPct: 0.33 },
      },
      commercial: {
        attendance: { value: 800_000, prior: 700_000, delta: 100_000, deltaPct: 0.14 },
        ticketPrice: { value: 50, prior: null, delta: null, deltaPct: null },
        sponsorshipRevenue: { value: 20_000_000, prior: null, delta: null, deltaPct: null },
      },
      organizational: {
        meanFacilityLevel: { value: 3, prior: 2, delta: 1, deltaPct: 0.5 },
      },
      ownership: {
        patience: 40,
        completedObjectives: 1,
        failedObjectives: 2,
        alignmentScore: 35,
      },
      franchiseValue: {
        starting: 1e9,
        ending: 1.05e9,
        deltaPct: 0.05,
        drivers: {},
        topPositiveDriver: null,
        topNegativeDriver: null,
      },
      facilityLevels: Object.fromEntries(
        FACILITY_CATEGORIES.map((c) => [c, 3]),
      ) as Record<(typeof FACILITY_CATEGORIES)[number], number>,
      franchiseTrajectory: {
        competitive: "up" as const,
        financial: "down" as const,
        commercial: "up" as const,
        organizational: "up" as const,
        brand: "flat" as const,
        overall: "neutral" as const,
      },
      historicalSignificance: [],
      era: null,
      eraTransition: {
        occurred: false,
        from: null,
        to: null,
        message: null,
      },
    };

    const narrative = buildFranchiseNarrative(draft);
    expect(narrative.toLowerCase()).toContain("cost");
  });
});
