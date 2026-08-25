import { describe, expect, it } from "vitest";
import {
  championshipConcentration,
  computeCompetitiveMobility,
  computeValueMobility,
  evaluateRelationship,
  herfindahlHirschmanIndex,
  laggedPearson,
  percentile,
  pearsonCorrelation,
  summarizeWithPercentiles,
} from "@/simulation/analytics";

describe("simulation analytics summarize", () => {
  it("computes percentiles", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(values, 50)).toBe(5.5);
    expect(percentile(values, 0)).toBe(1);
    expect(percentile(values, 100)).toBe(10);
    const summary = summarizeWithPercentiles(values);
    expect(summary.n).toBe(10);
    expect(summary.p25).toBe(3.25);
    expect(summary.p75).toBe(7.75);
  });

  it("computes HHI and championship concentration", () => {
    expect(herfindahlHirschmanIndex([0.5, 0.5])).toBeCloseTo(0.5);
    expect(championshipConcentration([5, 3, 2])).toBeCloseTo(
      (0.5) ** 2 + (0.3) ** 2 + (0.2) ** 2,
    );
    expect(championshipConcentration([])).toBe(0);
  });
});

describe("simulation analytics correlations", () => {
  it("computes Pearson and lagged Pearson", () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [2, 4, 6, 8, 10];
    expect(pearsonCorrelation(xs, ys)).toBeCloseTo(1);
    const lag1 = laggedPearson(xs, ys, 1);
    expect(lag1.n).toBe(4);
    expect(lag1.r).not.toBeNull();
  });

  it("evaluates relationship expectations", () => {
    expect(
      evaluateRelationship(0.4, { kind: "directional_positive", minR: 0.15 }),
    ).toBeNull();
    expect(
      evaluateRelationship(0.02, { kind: "directional_positive", minR: 0.15 }),
    ).toContain("expected positive");
    expect(
      evaluateRelationship(0.3, { kind: "weak_positive", minR: 0.05, maxR: 0.7 }),
    ).toBeNull();
  });
});

describe("simulation analytics mobility", () => {
  it("computes competitive mobility transitions", () => {
    const seasons = [];
    for (let seasonIndex = 0; seasonIndex < 4; seasonIndex += 1) {
      for (let t = 0; t < 8; t += 1) {
        seasons.push({
          teamKey: `t${t}`,
          seasonIndex,
          winPct: (t + 1) / 10 + seasonIndex * 0.01,
          playoff: t >= 4,
          champion: t === 7 && seasonIndex % 2 === 0,
          playoffDepth: t >= 6 ? 4 : t >= 4 ? 1 : 0,
          leagueRank: 8 - t,
        });
      }
    }
    const report = computeCompetitiveMobility(seasons);
    expect(report.nTransitions).toBeGreaterThan(0);
    expect(report.bottomToPlayoffRate).toBeGreaterThanOrEqual(0);
    expect(report.bottomToPlayoffRate).toBeLessThanOrEqual(1);
  });

  it("computes value mobility", () => {
    const seasons = [];
    for (let seasonIndex = 0; seasonIndex < 3; seasonIndex += 1) {
      for (let t = 0; t < 8; t += 1) {
        seasons.push({
          teamKey: `t${t}`,
          seasonIndex,
          franchiseValue: (t + 1) * 100_000_000 + seasonIndex * 10_000_000,
        });
      }
    }
    const report = computeValueMobility(seasons);
    expect(report.nFranchiseYears).toBe(24);
    expect(report.rankPersistence).not.toBeNull();
  });
});
