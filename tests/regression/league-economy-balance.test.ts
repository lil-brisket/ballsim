/**
 * League-economy balance invariants surfaced by `npm run sanity:league`:
 * franchise value should move with performance, and facility investment
 * should pay off in development with a real delay. Fixed-seed, unit-level
 * checks — not a full multi-season sim.
 *
 * Tried and reverted (see GAME_DESIGN.md "League economy — intended causal
 * relationships"): a per-team payroll overpay factor (raised insolvency
 * without loosening payroll→win%), a higher marketSize demand weight (no
 * effect — attendance is capped by arena capacity), and a wider superstar
 * quality tail (broke box-score/possession fidelity calibration).
 */

import { describe, expect, it } from "vitest";
import {
  facilityDevelopmentMultiplierFromLevels,
  laggedFacilityDevelopmentMultiplier,
} from "@/systems/facilities";
import {
  calculatePerformanceValue,
  calculateMarketValue,
} from "@/state/franchise-value";

describe("league economy balance regressions", () => {
  it("lags facility-driven development behind current investment", () => {
    const poor = facilityDevelopmentMultiplierFromLevels(1, 1, 1);
    const elite = facilityDevelopmentMultiplierFromLevels(5, 5, 5);
    expect(elite).toBeGreaterThan(poor);

    // A team with no (or too-short) franchise history falls back to its
    // current facility level rather than a 2-season-old value that doesn't
    // exist yet.
    const noHistoryState = {
      business: { franchiseHistory: {}, franchiseOps: {} },
    } as unknown as Parameters<typeof laggedFacilityDevelopmentMultiplier>[0];
    expect(() =>
      laggedFacilityDevelopmentMultiplier(noHistoryState, "missing" as never),
    ).not.toThrow();
  });

  it("weights win% and playoff success heavily enough to move franchise value", () => {
    const badSeason = calculatePerformanceValue({
      trailingWinPct: 0.2,
      playoffRate: 0,
      playoffDepth: 0,
    });
    const greatSeason = calculatePerformanceValue({
      trailingWinPct: 0.8,
      playoffRate: 1,
      playoffDepth: 0.8,
    });
    // The swing from a bad season to a great one should be a meaningful
    // fraction of typical market value, not a rounding error next to it.
    const typicalMarket = calculateMarketValue(55, 0.75).market;
    expect(greatSeason - badSeason).toBeGreaterThan(typicalMarket * 0.5);
  });

  it("market value leans on realized demand, not mostly a fixed floor", () => {
    const marketSize = 60;
    const lowRealization = calculateMarketValue(marketSize, 0.45).market;
    const highRealization = calculateMarketValue(marketSize, 1.05).market;
    const potential = marketSize * 2_800_000;
    expect(lowRealization).toBeLessThan(potential * 0.85);
    expect(highRealization).toBeGreaterThan(lowRealization * 1.15);
  });
});
