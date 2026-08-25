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
        managementPreset: "off",
        advanceMode: "until_phase",
        seed: TEST_RNG_SEED,
        saveReloadEachSeason: true,
      });
      expect(result.seasonsCompleted).toBe(1);
      expect(result.finalState.competition.season.phase).toBe("preseason");
      const userAssistEvents = result.finalState.user.eventLog.filter(
        (event) =>
          event.type === "AiAssistAction" &&
          (event.payload as { teamId?: string }).teamId ===
            result.finalState.user.controlledTeamId,
      );
      expect(userAssistEvents.length).toBe(0);
    },
    LONG_TIMEOUT_MS,
  );

  it(
    "Continuity completes 3 seasons with save/reload",
    async () => {
      const result = await runMultiYearSimulation({
        seasons: 3,
        managementPreset: "continuity",
        advanceMode: "until_phase",
        seed: TEST_RNG_SEED + 4,
        saveReloadEachSeason: true,
      });
      expect(result.seasonsCompleted).toBe(3);
      expect(result.finalState.competition.season.phase).toBe("preseason");
      expect(result.finalState.settings.ai.managementPreset).toBe("continuity");
    },
    LONG_TIMEOUT_MS,
  );

  it(
    "Smart completes 5 seasons with save/reload and mid-FA reload",
    async () => {
      const result = await runMultiYearSimulation({
        seasons: 5,
        managementPreset: "smart",
        advanceMode: "until_phase",
        seed: TEST_RNG_SEED + 1,
        saveReloadEachSeason: true,
        saveReloadMidFa: true,
      });
      expect(result.seasonsCompleted).toBe(5);
      expect(result.finalState.competition.season.phase).toBe("preseason");
      expect(result.finalState.settings.ai.managementPreset).toBe("smart");
    },
    LONG_TIMEOUT_MS,
  );

  it(
    "Full Management completes 5 seasons unattended",
    async () => {
      const result = await runMultiYearSimulation({
        seasons: 5,
        managementPreset: "full_management",
        advanceMode: "until_phase",
        seed: TEST_RNG_SEED + 2,
        saveReloadEachSeason: true,
      });
      expect(result.seasonsCompleted).toBe(5);
      expect(result.finalState.competition.season.phase).toBe("preseason");
      expect(result.finalState.settings.ai.managementPreset).toBe(
        "full_management",
      );
    },
    LONG_TIMEOUT_MS,
  );

  it(
    "Custom FA off + injuries continuity completes 3 seasons",
    async () => {
      const result = await runMultiYearSimulation({
        seasons: 3,
        managementPreset: "continuity",
        assistanceOverrides: {
          freeAgency: "off",
          injuriesEmergencyRoster: "continuity",
        },
        advanceMode: "until_phase",
        seed: TEST_RNG_SEED + 3,
        saveReloadEachSeason: true,
      });
      expect(result.seasonsCompleted).toBe(3);
      expect(result.finalState.settings.ai.managementPreset).toBe("custom");
    },
    LONG_TIMEOUT_MS,
  );
});
