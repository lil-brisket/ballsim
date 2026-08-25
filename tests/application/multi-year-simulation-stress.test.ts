/**
 * 25-year stress soak — not part of default CI.
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

import { runMultiYearSimulation } from "../helpers/multi-year-simulation";
import { TEST_RNG_SEED } from "../helpers/determinism";

const STRESS = process.env.STRESS === "1";
const LONG_TIMEOUT_MS = 3_600_000;

describe.runIf(STRESS)("multi-year simulation stress soak", () => {
  it(
    "Smart Assist completes 25 seasons",
    async () => {
      const result = await runMultiYearSimulation({
        seasons: 25,
        managementPreset: "smart",
        advanceMode: "until_phase",
        seed: TEST_RNG_SEED + 99,
        saveReloadEachSeason: true,
        maxSteps: 25 * 600,
      });
      expect(result.seasonsCompleted).toBe(25);
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
