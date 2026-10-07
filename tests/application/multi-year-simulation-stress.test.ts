/**
 * 50-year stress soak — not part of default CI.
 * Run with: STRESS=1 npx vitest run tests/application/multi-year-simulation-stress.test.ts
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/persistence/save-game-repository", () => ({
  prismaSaveGameStore: {
    list: vi.fn(),
    create: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));

import { PLAYER_POSITIONS } from "@/domain/entities/player";
import type { GameState } from "@/state/game-state";
import { getTeamPayroll } from "@/systems/salary-cap";
import { runMultiYearSimulation } from "../helpers/multi-year-simulation";
import { TEST_RNG_SEED } from "../helpers/determinism";

const STRESS = process.env.STRESS === "1";
const LONG_TIMEOUT_MS = 7_200_000;
const SEASONS = 50;
const PAYROLL_YOY_MAX_DELTA = 0.1;

function leaguePayroll(state: GameState): number {
  const year = state.competition.season.year;
  let total = 0;
  for (const team of Object.values(state.world.teams)) {
    total += getTeamPayroll(team.id, year, state);
  }
  return total;
}

function assertSeasonHealth(
  state: GameState,
  previousPayroll: number | null,
): number {
  for (const team of Object.values(state.world.teams)) {
    const covered = new Set<string>();
    for (const playerId of team.roster) {
      const player = state.world.players[playerId];
      if (player !== undefined) {
        covered.add(player.position);
      }
    }
    for (const position of PLAYER_POSITIONS) {
      expect(
        covered.has(position),
        `${team.id} missing position ${position}`,
      ).toBe(true);
    }
    const funds = state.business.finances[team.id]?.businessFunds;
    expect(funds, `${team.id} missing finances`).toBeDefined();
    expect(funds, `${team.id} negative cash`).toBeGreaterThanOrEqual(0);
  }

  const payroll = leaguePayroll(state);
  if (previousPayroll !== null) {
    expect(previousPayroll, "previous league payroll").toBeGreaterThan(0);
    const delta = Math.abs(payroll - previousPayroll) / previousPayroll;
    expect(delta).toBeLessThanOrEqual(PAYROLL_YOY_MAX_DELTA);
  }
  return payroll;
}

describe.runIf(STRESS)("multi-year simulation stress soak", () => {
  it(
    "Smart Assist completes 50 seasons",
    async () => {
      let previousPayroll: number | null = null;
      const result = await runMultiYearSimulation({
        seasons: SEASONS,
        managementPreset: "smart",
        advanceMode: "until_phase",
        seed: TEST_RNG_SEED + 99,
        saveReloadEachSeason: true,
        maxSteps: SEASONS * 600,
        onSeasonBoundary: (state, seasonsCompleted) => {
          previousPayroll = assertSeasonHealth(
            state,
            seasonsCompleted === 0 ? null : previousPayroll,
          );
        },
      });
      expect(result.seasonsCompleted).toBe(SEASONS);
      expect(result.finalState.competition.season.phase).toBe("preseason");
    },
    LONG_TIMEOUT_MS,
  );
});

describe.runIf(!STRESS)("multi-year simulation stress soak (skipped)", () => {
  it("is skipped unless STRESS=1", () => {
    expect(STRESS).toBe(false);
  });
});
