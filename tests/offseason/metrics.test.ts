/**
 * Fast unit tests for the offseason balance bands: tolerance rule, baseline
 * comparison and aggregation on tiny synthetic samples. No league is run.
 */

import { describe, expect, it } from "vitest";
import {
  aggregateMetrics,
  buildBaseline,
  compareToBaseline,
  failureMessages,
  mean,
  metricsPerSeed,
  pearson,
  pickGroup,
  salaryTier,
  stdev,
  toleranceFor,
  type BaselineFile,
  type SeasonSample,
  type SeedSamples,
} from "./balance-stats";

function season(overrides: Partial<SeasonSample> = {}): SeasonSample {
  return {
    seasonIndex: 1,
    seasonYear: 2026,
    development: [],
    teams: [],
    cashAfterOffseason: [],
    unsignedAtPreseason: 0,
    unsignedAtPreseason60Plus: 0,
    faSignings: [],
    topFa: null,
    starTotal: 0,
    starMaxOnOneTeam: 0,
    starTop4Count: 0,
    rosterTurnover: [],
    rookies: [],
    top5Picks: [],
    ...overrides,
  };
}

function seed(
  seasons: SeasonSample[],
  overall90PlusSeries: number[] = [1, 2],
): SeedSamples {
  return { seed: 1, overall90PlusSeries, seasons };
}

describe("numeric helpers", () => {
  it("computes Pearson correlation", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 10);
    expect(pearson([1, 2, 3, 4], [1, 3, 2, 4])).toBeCloseTo(0.8, 10);
    expect(pearson([1, 2, 3], [5, 5, 5])).toBeNaN();
    expect(pearson([1], [1])).toBeNaN();
  });

  it("computes mean and sample stdev", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([])).toBeNaN();
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(stdev([5])).toBe(0);
  });

  it("buckets salary tiers and pick groups", () => {
    expect(salaryTier(59)).toBe("<60");
    expect(salaryTier(60)).toBe("60-69");
    expect(salaryTier(79)).toBe("70-79");
    expect(salaryTier(80)).toBe("80+");
    expect(pickGroup(3)).toBe("1-3");
    expect(pickGroup(4)).toBe("4-8");
    expect(pickGroup(14)).toBe("9-14");
    expect(pickGroup(24)).toBe("15-24");
    expect(pickGroup(25)).toBeNull();
  });
});

describe("tolerance rule", () => {
  it("takes the largest of 3 sd, the floor and, for money and counts, 10% of baseline", () => {
    expect(
      toleranceFor({ stdevAcrossSeeds: 0.5, baseline: 2, absoluteFloor: 0.25 }),
    ).toBe(1.5);
    // A rating level gets no relative floor: 10% of 73 would be a 7-point band.
    expect(
      toleranceFor({
        stdevAcrossSeeds: 0.2,
        baseline: 73,
        absoluteFloor: 0.5,
        unit: "overall",
      }),
    ).toBeCloseTo(0.6);
    expect(
      toleranceFor({
        stdevAcrossSeeds: 0.01,
        baseline: -10,
        absoluteFloor: 0.25,
        unit: "$M",
      }),
    ).toBe(1);
    expect(
      toleranceFor({
        stdevAcrossSeeds: 0,
        baseline: 30,
        absoluteFloor: 1,
        unit: "count",
      }),
    ).toBe(3);
    expect(
      toleranceFor({
        stdevAcrossSeeds: 0,
        baseline: 0.1,
        absoluteFloor: 0.05,
        unit: "share",
      }),
    ).toBe(0.05);
  });

  it("refuses to write a baseline from fewer than 3 seeds", () => {
    expect(() =>
      buildBaseline({
        perSeed: [{ a: 1 }, { a: 2 }],
        seeds: 2,
        seasons: 4,
        seedStart: 1,
      }),
    ).toThrow(/at least 3 seeds/);
  });

  it("builds baseline entries with value, tolerance, unit and note", () => {
    const baseline = buildBaseline({
      perSeed: [
        { shareGain3Plus: 0.2 },
        { shareGain3Plus: 0.3 },
        { shareGain3Plus: 0.25 },
      ],
      seeds: 3,
      seasons: 4,
      seedStart: 7,
    });
    const entry = baseline.metrics.shareGain3Plus!;
    expect(entry.value).toBe(0.25);
    expect(entry.unit).toBe("share");
    expect(entry.tolerance).toBeCloseTo(0.15, 4);
    expect(entry.note).toContain("+3");
    expect(baseline.generatedWith).toEqual({
      seeds: 3,
      seasons: 4,
      seedStart: 7,
    });
  });
});

describe("baseline comparison", () => {
  const baseline: BaselineFile = {
    generatedWith: { seeds: 4, seasons: 4, seedStart: 101 },
    metrics: {
      "meanOverallChange[<=22]": {
        value: 2.23,
        tolerance: 0.4,
        unit: "overall",
        note: "",
      },
      insolvencyRate: { value: 0.04, tolerance: 0.05, unit: "share", note: "" },
      gone: { value: 1, tolerance: 1, unit: "count", note: "" },
      "meanSalaryByTier[80+]": {
        value: 10,
        tolerance: 5,
        unit: "$M",
        note: "",
      },
    },
  };

  it("classifies inside, outside, missing and new metrics", () => {
    const rows = compareToBaseline(baseline, {
      "meanOverallChange[<=22]": 2.31,
      insolvencyRate: 0.2,
      fresh: 3,
    });
    const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
    expect(byName["meanOverallChange[<=22]"]!.status).toBe("ok");
    expect(byName.insolvencyRate!.status).toBe("outside");
    expect(byName.gone!.status).toBe("missing");
    expect(byName.fresh!.status).toBe("new");
    expect(byName.fresh!.baseline).toBeNull();
    // Sparse metrics need a rare event; absent is skipped, not failed.
    expect(byName["meanSalaryByTier[80+]"]!.status).toBe("skipped");
  });

  it("treats the band edge as inside", () => {
    const rows = compareToBaseline(baseline, {
      "meanOverallChange[<=22]": 2.63,
      insolvencyRate: 0.04,
      gone: 1,
      "meanSalaryByTier[80+]": 15,
    });
    expect(rows.every((row) => row.status === "ok")).toBe(true);
  });

  it("treats a non-finite current value as missing", () => {
    const rows = compareToBaseline(baseline, {
      "meanOverallChange[<=22]": Number.NaN,
      insolvencyRate: 0.04,
      gone: 1,
    });
    expect(rows.find((r) => r.name === "meanOverallChange[<=22]")!.status).toBe(
      "missing",
    );
  });

  it("writes a readable message per failing metric and ignores new ones", () => {
    const rows = compareToBaseline(baseline, {
      "meanOverallChange[<=22]": 3.31,
      insolvencyRate: 0.04,
      fresh: 3,
    });
    const messages = failureMessages(rows, "tests/offseason/baselines.json");
    expect(messages).toHaveLength(2);
    expect(messages[0]).toBe(
      "meanOverallChange[<=22] 3.31 is outside 2.23 +/- 0.4 (baseline tests/offseason/baselines.json). " +
        "If this change is intentional, rerun with --write-baseline and commit the baseline on its own.",
    );
    expect(messages[1]).toContain("gone was not measured");
  });
});

describe("aggregation", () => {
  it("computes development metrics per age bucket and share", () => {
    const metrics = aggregateMetrics([
      seed([
        season({
          development: [
            { bucket: "<=22", change: 5 },
            { bucket: "<=22", change: 1 },
            { bucket: "34+", change: -5 },
            { bucket: "34+", change: -1 },
          ],
        }),
      ]),
    ]);
    expect(metrics["meanOverallChange[<=22]"]).toBe(3);
    expect(metrics["meanOverallChange[34+]"]).toBe(-3);
    expect(metrics["meanOverallChange[23-26]"]).toBeUndefined();
    expect(metrics.shareGain3Plus).toBe(0.25);
    expect(metrics.shareLose3Plus).toBe(0.25);
    expect(metrics.shareGainAtCap).toBe(0.25);
    expect(metrics.shareLoseAtCap).toBe(0.25);
  });

  it("keeps first, last and max of the 90+ series", () => {
    const metrics = aggregateMetrics([seed([season()], [2, 5, 3])]);
    expect(metrics["overall90Plus[first]"]).toBe(2);
    expect(metrics["overall90Plus[last]"]).toBe(3);
    expect(metrics["overall90Plus[max]"]).toBe(5);
  });

  it("averages per-seed values across seeds", () => {
    const perSeed = metricsPerSeed([
      seed([season({ unsignedAtPreseason: 4 })]),
      seed([season({ unsignedAtPreseason: 8 })]),
    ]);
    expect(perSeed.map((v) => v.unsignedAtPreseason)).toEqual([4, 8]);
    expect(
      aggregateMetrics([
        seed([season({ unsignedAtPreseason: 4 })]),
        seed([season({ unsignedAtPreseason: 8 })]),
      ]).unsignedAtPreseason,
    ).toBe(6);
  });

  it("reports salary tiers in $M and the top free agent payroll rate", () => {
    const metrics = aggregateMetrics([
      seed([
        season({
          faSignings: [
            { tier: "80+", salary: 20_000_000 },
            { tier: "80+", salary: 10_000_000 },
            { tier: "<60", salary: 1_000_000 },
          ],
          topFa: { signed: true, toHighestPayroll: true },
        }),
        season({ topFa: { signed: true, toHighestPayroll: false } }),
        season({ topFa: { signed: false, toHighestPayroll: false } }),
        season({ topFa: null }),
      ]),
    ]);
    expect(metrics["meanSalaryByTier[80+]"]).toBe(15);
    expect(metrics["meanSalaryByTier[<60]"]).toBe(1);
    expect(metrics["meanSalaryByTier[70-79]"]).toBeUndefined();
    expect(metrics.topFaSignsWithHighestPayroll).toBe(0.5);
  });

  it("computes star spread, turnover and economy", () => {
    const metrics = aggregateMetrics([
      seed([
        season({
          starTotal: 6,
          starMaxOnOneTeam: 3,
          starTop4Count: 5,
          rosterTurnover: [0.5, 0.3],
          cashAfterOffseason: [10_000_000, 30_000_000],
          teams: [
            { winPct: 0.2, payroll: 40_000_000, cash: -1 },
            { winPct: 0.5, payroll: 60_000_000, cash: 5 },
            { winPct: 0.8, payroll: 80_000_000, cash: 5 },
            { winPct: 0.5, payroll: 60_000_000, cash: 5 },
          ],
        }),
      ]),
    ]);
    expect(metrics.starMaxOnOneTeam).toBe(3);
    expect(metrics.starTop4TeamsShare).toBeCloseTo(5 / 6, 10);
    expect(metrics.meanRosterTurnover).toBeCloseTo(0.4, 10);
    expect(metrics.meanCashAfterOffseason).toBe(20);
    expect(metrics.meanPayroll).toBe(60);
    expect(metrics.insolvencyRate).toBe(0.25);
    expect(metrics.payrollWinPctCorrelation).toBeCloseTo(1, 10);
  });

  it("computes rookie overall by pick group and top-5 starter share", () => {
    const metrics = aggregateMetrics([
      seed([
        season({
          rookies: [
            { pick: 1, overall: 60 },
            { pick: 3, overall: 50 },
            { pick: 4, overall: 48 },
            { pick: 24, overall: 40 },
            { pick: 25, overall: 10 },
          ],
          top5Picks: [
            { pick: 1, starter: true },
            { pick: 2, starter: false },
            { pick: 3, starter: true },
            { pick: 4, starter: true },
          ],
        }),
      ]),
    ]);
    expect(metrics["meanRookieOverall[1-3]"]).toBe(55);
    expect(metrics["meanRookieOverall[4-8]"]).toBe(48);
    expect(metrics["meanRookieOverall[9-14]"]).toBeUndefined();
    expect(metrics["meanRookieOverall[15-24]"]).toBe(40);
    expect(metrics.shareTop5PicksStarters).toBe(0.75);
  });
});
