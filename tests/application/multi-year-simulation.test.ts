import { beforeEach, describe, expect, it, vi } from "vitest";

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

const LONG_TIMEOUT_MS = 600_000;

describe("multi-year unattended simulation (CI gate)", () => {
  beforeEach(() => {
    // isolation
  });

  it(
    "AI Off completes 1 season without Invalid GameState",
    async () => {
      const result = await runMultiYearSimulation({
        seasons: 1,
        managementMode: "off",
        advanceMode: "until_phase",
        seed: TEST_RNG_SEED,
        saveReloadEachSeason: true,
      });
      expect(result.seasonsCompleted).toBe(1);
      expect(result.finalState.competition.season.phase).toBe("preseason");
    },
    LONG_TIMEOUT_MS,
  );

  it(
    "Smart Assist completes 5 seasons with save/reload and mid-FA reload",
    async () => {
      const result = await runMultiYearSimulation({
        seasons: 5,
        managementMode: "smart_assist",
        advanceMode: "until_phase",
        seed: TEST_RNG_SEED + 1,
        saveReloadEachSeason: true,
        saveReloadMidFa: true,
      });
      expect(result.seasonsCompleted).toBe(5);
      expect(result.finalState.competition.season.phase).toBe("preseason");
      expect(result.finalState.settings.ai.managementMode).toBe("smart_assist");
    },
    LONG_TIMEOUT_MS,
  );

  it(
    "Full Management completes 5 seasons unattended",
    async () => {
      const result = await runMultiYearSimulation({
        seasons: 5,
        managementMode: "full_management",
        advanceMode: "until_phase",
        seed: TEST_RNG_SEED + 2,
        saveReloadEachSeason: true,
      });
      expect(result.seasonsCompleted).toBe(5);
      expect(result.finalState.competition.season.phase).toBe("preseason");
      expect(result.finalState.settings.ai.managementMode).toBe(
        "full_management",
      );
    },
    LONG_TIMEOUT_MS,
  );

  it(
    "Smart Assist + FA domain override completes 5 seasons",
    async () => {
      const result = await runMultiYearSimulation({
        seasons: 5,
        managementMode: "smart_assist",
        assistanceOverrides: {
          freeAgency: "full",
          draft: "full",
          rosterFilling: "full",
        },
        advanceMode: "until_phase",
        seed: TEST_RNG_SEED + 3,
        saveReloadEachSeason: true,
      });
      expect(result.seasonsCompleted).toBe(5);
    },
    LONG_TIMEOUT_MS,
  );
});
