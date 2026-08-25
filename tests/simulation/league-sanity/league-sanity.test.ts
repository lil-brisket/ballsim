import { describe, expect, it } from "vitest";
import {
  aggregateLeagueSanitySnapshots,
  buildLeagueSanityReport,
  computeLeagueSanityCorrelations,
  evaluateCausalChains,
  evaluateSanityWarnings,
  formatLeagueSanityReport,
  runLeagueSanityBatch,
} from "@/simulation/league-sanity";
import type { LeagueSanityTeamSeasonSnapshot } from "@/simulation/league-sanity";

function fakeSnap(
  overrides: Partial<LeagueSanityTeamSeasonSnapshot>,
): LeagueSanityTeamSeasonSnapshot {
  return {
    simulationIndex: 0,
    teamId: "team_a",
    teamKey: "0:team_a",
    seasonYear: 2026,
    seasonIndex: 0,
    seasonsSinceFounding: 1,
    wins: 40,
    losses: 42,
    winPct: 40 / 82,
    leagueRank: 10,
    playoff: false,
    playoffDepth: 0,
    champion: false,
    cash: 50_000_000,
    revenue: 120_000_000,
    expenses: 110_000_000,
    netIncome: 10_000_000,
    payroll: 90_000_000,
    franchiseValue: 1_000_000_000,
    financialHealth: "stable",
    insolvent: false,
    attendance: 700_000,
    fillRate: 0.85,
    ticketPrice: 45,
    marketSize: 60,
    marketingBudget: 5_000_000,
    sponsorshipRevenue: 10_000_000,
    meanFacilityLevel: 2,
    meanRosterAge: 27,
    youngSharePct: 30,
    meanSalary: 5_000_000,
    rosterStrength: 70,
    reputation: 55,
    fanSentiment: 50,
    relocated: false,
    expansionTeam: false,
    ...overrides,
  };
}

describe("league sanity aggregation", () => {
  it("aggregates tenure, competitive, and financial metrics", () => {
    const snaps: LeagueSanityTeamSeasonSnapshot[] = [];
    for (let season = 0; season < 3; season += 1) {
      for (let t = 0; t < 4; t += 1) {
        snaps.push(
          fakeSnap({
            teamId: `team_${t}`,
            teamKey: `0:team_${t}`,
            seasonIndex: season,
            seasonYear: 2026 + season,
            seasonsSinceFounding: season + 1,
            winPct: 0.3 + t * 0.1,
            leagueRank: 4 - t,
            playoff: t >= 2,
            champion: t === 3 && season === 2,
            franchiseValue: (t + 1) * 800_000_000 + season * 50_000_000,
            marketSize: 40 + t * 10,
            attendance: 500_000 + t * 50_000 + season * 10_000,
            payroll: 70_000_000 + t * 10_000_000,
            insolvent: t === 0 && season === 2,
            financialHealth: t === 0 && season === 2 ? "insolvent" : "stable",
          }),
        );
      }
    }
    const agg = aggregateLeagueSanitySnapshots(snaps, 3);
    expect(agg.teamSeasonCount).toBe(12);
    expect(agg.franchiseCount).toBe(4);
    expect(agg.tenure.insolvencyRate).toBeCloseTo(1 / 12);
    expect(agg.championshipHhi).toBeGreaterThan(0);
    expect(agg.competitiveMobility.nTransitions).toBeGreaterThan(0);
    expect(agg.valueMobility.nFranchiseYears).toBe(12);

    const { sameSeason, lagged } = computeLeagueSanityCorrelations(snaps);
    expect(sameSeason.length).toBeGreaterThan(0);
    expect(lagged.length).toBeGreaterThan(0);

    const chains = evaluateCausalChains(snaps);
    expect(chains.length).toBeGreaterThan(0);

    const warnings = evaluateSanityWarnings({
      aggregates: agg,
      relationships: sameSeason,
      causalChains: chains,
      simulations: 1,
    });
    expect(Array.isArray(warnings)).toBe(true);
  });
});

describe("league sanity reproducibility", () => {
  it(
    "same seed produces identical resultChecksum",
    { timeout: 120_000 },
    () => {
      const a = buildLeagueSanityReport({
        simulations: 2,
        seasonsPerSimulation: 2,
        seed: 4242,
        generatedAt: "2026-01-01T00:00:00.000Z",
      });
      const b = buildLeagueSanityReport({
        simulations: 2,
        seasonsPerSimulation: 2,
        seed: 4242,
        generatedAt: "2099-01-01T00:00:00.000Z",
      });
      expect(a.metadata.resultChecksum).toBe(b.metadata.resultChecksum);
      expect(a.metadata.simulationConfigHash).toBe(
        b.metadata.simulationConfigHash,
      );
      expect(a.metadata.generatedAt).not.toBe(b.metadata.generatedAt);
      const text = formatLeagueSanityReport(a);
      expect(text).toContain("LEAGUE SANITY REPORT");
      expect(text).toContain("FRANCHISE TENURE");
    },
  );

  it(
    "batch runner collects snapshots without retaining careers incorrectly",
    { timeout: 120_000 },
    () => {
      const careers = runLeagueSanityBatch({
        simulations: 1,
        seasonsPerSimulation: 1,
        seed: 99,
      });
      expect(careers).toHaveLength(1);
      expect(careers[0]!.snapshots.length).toBeGreaterThan(0);
      expect(careers[0]!.teamCount).toBeGreaterThan(0);
    },
  );
});
