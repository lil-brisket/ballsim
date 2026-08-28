import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActiveOwnedFranchise } from "@/state/owner-context";

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
import { applyPreset } from "@/domain/ai-management-presets";
import { selectAllVisiblePhases } from "@/domain/ai-management-delegation";

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
      const userAssistEvents = getActiveOwnedFranchise(result.finalState).eventLog.filter(
        (event) =>
          event.type === "AiAssistAction" &&
          (event.payload as { teamId?: string }).teamId ===
            result.finalState.user.activeOwnerTeamId,
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

describe("multi-year delegation profiles", () => {
  const allOff = applyPreset("off");
  const rosterOnly = {
    ...applyPreset("off"),
    injuriesEmergencyRoster: "full" as const,
    rotationsDepthChart: "full" as const,
  };
  const rosterAndFa = {
    ...rosterOnly,
    freeAgency: "full" as const,
  };
  const rosterFaCoaching = {
    ...rosterAndFa,
    coachingStaff: "full" as const,
    frontOfficeStaff: "full" as const,
  };
  const allVisible = selectAllVisiblePhases(applyPreset("off"));

  const profiles: Array<{
    name: string;
    assistance: typeof allOff;
    seasons: number;
    seedOffset: number;
  }> = [
    { name: "all off", assistance: allOff, seasons: 1, seedOffset: 10 },
    { name: "roster only", assistance: rosterOnly, seasons: 1, seedOffset: 11 },
    { name: "roster + FA", assistance: rosterAndFa, seasons: 1, seedOffset: 12 },
    {
      name: "roster + FA + coaching",
      assistance: rosterFaCoaching,
      seasons: 1,
      seedOffset: 13,
    },
    {
      name: "all visible supported",
      assistance: allVisible,
      seasons: 3,
      seedOffset: 14,
    },
  ];

  for (const profile of profiles) {
    it(
      `${profile.name} completes ${profile.seasons} season(s)`,
      async () => {
        const result = await runMultiYearSimulation({
          seasons: profile.seasons,
          assistance: profile.assistance,
          managementPreset: "custom",
          advanceMode: "until_phase",
          seed: TEST_RNG_SEED + profile.seedOffset,
          saveReloadEachSeason: true,
        });
        expect(result.seasonsCompleted).toBe(profile.seasons);
        expect(result.finalState.competition.season.phase).toBe("preseason");
        // No dead user team
        const team =
          result.finalState.world.teams[
            result.finalState.user.activeOwnerTeamId
          ];
        expect(team).toBeTruthy();
        expect(team!.roster.length).toBeGreaterThan(0);
      },
      LONG_TIMEOUT_MS,
    );
  }
});
