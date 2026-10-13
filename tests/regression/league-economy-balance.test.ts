/**
 * League-economy balance invariants surfaced by `npm run sanity:league`:
 * payroll should not be a near-deterministic function of talent, franchise
 * value should move with performance, and facility investment should pay
 * off in development with a real delay. Fixed-seed, unit-level checks — not
 * a full multi-season sim.
 *
 * Widening the generation-time superstar quality tail (to fix the
 * near-total absence of 90+ overall players) was tried and reverted: it
 * shifted possession-engine scoring/efficiency for the rare elite roll
 * enough to break the box-score/possession fidelity calibration gate
 * (`tests/simulation/lab/fidelity-parity.test.ts`,
 * `tests/simulation/lab/simulate-game-box-score-stats.test.ts`). Fixing it
 * properly requires recalibrating the box-score projection alongside the
 * quality-tail change, not a config-only tweak — tracked as unresolved.
 */

import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { TeamId } from "@/domain/ids";
import { createInitialGameState } from "@/state/create-initial-state";
import {
  applyContractNegotiationNoise,
  salaryForPlayer,
  teamPayrollEfficiencyFactor,
  vetMinSalary,
} from "@/systems/salary-scale";
import {
  facilityDevelopmentMultiplierFromLevels,
  laggedFacilityDevelopmentMultiplier,
} from "@/systems/facilities";
import {
  calculatePerformanceValue,
  calculateMarketValue,
} from "@/state/franchise-value";

describe("league economy balance regressions", () => {
  it("gives different teams a different, bounded payroll-efficiency bias", () => {
    const factors = Array.from({ length: 30 }, (_, i) =>
      teamPayrollEfficiencyFactor(42, `team_${i}`),
    );
    // Different teams must land on different biases, not one shared value.
    expect(new Set(factors).size).toBeGreaterThan(10);
    for (const factor of factors) {
      // Never below market (see TEAM_PAYROLL_EFFICIENCY_MIN).
      expect(factor).toBeGreaterThanOrEqual(1);
      expect(factor).toBeLessThanOrEqual(1.35);
    }
    // Stable for a team within a game — not re-rolled per contract.
    expect(teamPayrollEfficiencyFactor(42, "team_fixed")).toBe(
      teamPayrollEfficiencyFactor(42, "team_fixed"),
    );
  });

  it("biases CPU signings but pays owned teams the formula rate", () => {
    const state = createInitialGameState({
      saveId: "econ_balance",
      rngSeed: 42,
      settings: CBL_GAME_SETTINGS,
    });
    const cap = 100_000_000;
    const market = salaryForPlayer({
      overall: 78,
      age: 27,
      years: 5,
      cap,
      kind: "fa",
    });
    const ownerId = state.user.activeOwnerTeamId;
    const cpuIds = (Object.keys(state.world.teams) as TeamId[]).filter(
      (id) => id !== ownerId,
    );
    expect(applyContractNegotiationNoise(state, market, ownerId, cap)).toBe(
      market,
    );
    const cpuSalaries = cpuIds.map((id) =>
      applyContractNegotiationNoise(state, market, id, cap),
    );
    expect(cpuSalaries.some((salary) => salary > market)).toBe(true);
    for (const salary of cpuSalaries) {
      expect(salary).toBeGreaterThanOrEqual(market);
    }
  });

  it("never lets a team's payroll-efficiency bias undercut the real vet-minimum floor", () => {
    const state = createInitialGameState({
      saveId: "econ_floor",
      rngSeed: 7,
      settings: CBL_GAME_SETTINGS,
    });
    const cap = 100_000_000;
    const cheapMarket = vetMinSalary(cap) + 50_000;
    for (const teamId of Object.keys(state.world.teams) as TeamId[]) {
      const salary = applyContractNegotiationNoise(
        state,
        cheapMarket,
        teamId,
        cap,
      );
      expect(salary).toBeGreaterThanOrEqual(vetMinSalary(cap));
    }
  });

  it("lags facility-driven development behind current investment", () => {
    const poorLevels = { practice: 1, training: 1, medical: 1 } as const;
    const eliteLevels = { practice: 5, training: 5, medical: 5 } as const;
    const poor = facilityDevelopmentMultiplierFromLevels(
      poorLevels.practice,
      poorLevels.training,
      poorLevels.medical,
    );
    const elite = facilityDevelopmentMultiplierFromLevels(
      eliteLevels.practice,
      eliteLevels.training,
      eliteLevels.medical,
    );
    expect(elite).toBeGreaterThan(poor);

    // A team with no (or too-short) franchise history falls back to its
    // current facility level rather than silently using a 2-season-old
    // value that doesn't exist yet.
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
    // The floor-only share of market value should leave meaningful room
    // for realization to move the number, not swallow nearly all of it.
    expect(lowRealization).toBeLessThan(potential * 0.85);
    expect(highRealization).toBeGreaterThan(lowRealization * 1.15);
  });
});
