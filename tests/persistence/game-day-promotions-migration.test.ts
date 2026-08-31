import { describe, expect, it } from "vitest";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { deserializeGameState } from "@/persistence/mappers/game-state-mapper";
import { createEmptyAwardHistory } from "@/domain/entities/awards";

describe("game-day promotions migration", () => {
  it("new saves include empty promotion state at schema 58", () => {
    let state = createInitialGameState({
      saveId: "gdp_mig",
      rngSeed: 1,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(
      state,
      createSeededRng(state.meta.rngState),
    ).state;
    expect(state.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(GAME_STATE_SCHEMA_VERSION).toBe(58);
    for (const teamId of Object.keys(state.world.teams)) {
      const promo = state.business.gameDayPromotionsByTeamId[teamId];
      expect(promo).toBeTruthy();
      expect(promo!.committedSpend).toBe(0);
      expect(Object.keys(promo!.assignments)).toHaveLength(0);
    }
  });

  it("migrates a v57-shaped payload to include promotions", () => {
    let state = createInitialGameState({
      saveId: "gdp_mig2",
      rngSeed: 2,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(
      state,
      createSeededRng(state.meta.rngState),
    ).state;

    // Simulate a v57 save missing the promotions map.
    const legacy = {
      ...state,
      meta: { ...state.meta, schemaVersion: 57 },
      business: {
        ...state.business,
        awards: state.business.awards ?? createEmptyAwardHistory(),
        gameDayPromotionsByTeamId: undefined,
      },
    };
    const json = JSON.stringify(legacy);
    const migrated = deserializeGameState(json);
    expect(migrated.meta.schemaVersion).toBe(58);
    for (const teamId of Object.keys(migrated.world.teams)) {
      expect(migrated.business.gameDayPromotionsByTeamId[teamId]).toBeTruthy();
    }
  });
});
