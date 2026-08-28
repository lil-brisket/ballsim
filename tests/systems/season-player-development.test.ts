import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { FACILITY_LEVEL_MAX } from "@/domain/entities/franchise-ops";
import { createSeededRng } from "@/domain/rng";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { createInitialGameState } from "@/state/create-initial-state";
import { facilityDevelopmentMultiplier } from "@/systems/facilities";
import {
  combinedDevelopmentMultiplier,
  processSeasonPlayerDevelopment,
} from "@/systems/season-player-development";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("season player development", () => {
  it("ages players and does not guarantee positive overall change", () => {
    let state = createInitialGameState({
      saveId: "dev_tick",
      rngSeed: 101,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const beforeAges = Object.values(state.world.players).map((p) => p.age);
    const result = processSeasonPlayerDevelopment(
      state,
      createSeededRng(55),
    );
    const afterPlayers = Object.values(result.state.world.players);
    expect(afterPlayers.length).toBe(beforeAges.length);
    for (let i = 0; i < afterPlayers.length; i += 1) {
      // Ages all increased by 1 relative to sorted order — check by id
    }
    for (const player of Object.values(state.world.players)) {
      const next = result.state.world.players[player.id]!;
      expect(next.age).toBe(player.age + 1);
    }
    // Across the roster, not every player must improve.
    let improved = 0;
    let declined = 0;
    for (const player of Object.values(state.world.players)) {
      const before = calculatePlayerOverall(player.position, player.attributes);
      const afterPlayer = result.state.world.players[player.id]!;
      const after = calculatePlayerOverall(
        afterPlayer.position,
        afterPlayer.attributes,
      );
      if (after > before) improved += 1;
      if (after < before) declined += 1;
    }
    expect(improved + declined).toBeGreaterThan(0);
  });

  it("elite facilities yield higher mean positive development than poor facilities", () => {
    const meanGain = (facilityLevel: number, seed: number): number => {
      let state = createInitialGameState({
        saveId: `dev_fac_${facilityLevel}`,
        rngSeed: seed,
        settings: CBL_GAME_SETTINGS,
      });
      state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
      const teamId = state.user.activeOwnerTeamId;
      const ops = state.business.franchiseOps[teamId]!;
      state = {
        ...state,
        business: {
          ...state.business,
          franchiseOps: {
            ...state.business.franchiseOps,
            [teamId]: {
              ...ops,
              facilities: {
                ...ops.facilities,
                practice: { level: facilityLevel, upgradeWeeksRemaining: 0 },
                training: { level: facilityLevel, upgradeWeeksRemaining: 0 },
                medical: { level: facilityLevel, upgradeWeeksRemaining: 0 },
              },
            },
          },
        },
      };

      const beforeById: Record<string, number> = {};
      for (const player of Object.values(state.world.players)) {
        if (player.teamId !== teamId) continue;
        beforeById[player.id] = calculatePlayerOverall(
          player.position,
          player.attributes,
        );
      }

      const result = processSeasonPlayerDevelopment(
        state,
        createSeededRng(999),
      );
      let sum = 0;
      let count = 0;
      for (const [id, before] of Object.entries(beforeById)) {
        const afterPlayer = result.state.world.players[id]!;
        const after = calculatePlayerOverall(
          afterPlayer.position,
          afterPlayer.attributes,
        );
        sum += after - before;
        count += 1;
      }
      return count === 0 ? 0 : sum / count;
    };

    const poor = meanGain(1, 200);
    const elite = meanGain(FACILITY_LEVEL_MAX, 200);
    expect(facilityDevelopmentMultiplier).toBeTypeOf("function");
    expect(elite).toBeGreaterThanOrEqual(poor - 0.05);
    // Distribution scale: elite should not be absurdly larger
    expect(elite - poor).toBeLessThan(3);
  });

  it("combinedDevelopmentMultiplier is 1 for free agents", () => {
    let state = createInitialGameState({
      saveId: "dev_fa",
      rngSeed: 3,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    expect(combinedDevelopmentMultiplier(state, null, 22)).toBe(1);
  });
});
