import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { createSeededRng } from "@/domain/rng";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("v41 → v42 migration", () => {
  it("marks completed city selection as franchise identity confirmed", () => {
    let modern = createTestGameState({ saveId: "mig_v42_done" });
    modern = bootstrapWorld(modern, createSeededRng(modern.meta.rngState)).state;
    modern = {
      ...modern,
      user: {
        ...modern.user,
        citySelectionConfirmed: true,
        franchiseIdentityConfirmed: true,
      },
    };

    const parsed = JSON.parse(serializeGameState(modern)) as {
      meta: { schemaVersion: number };
      user: Record<string, unknown>;
      world: { teams: Record<string, Record<string, unknown>> };
    };
    parsed.meta.schemaVersion = 41;
    delete parsed.user.franchiseIdentityConfirmed;
    for (const team of Object.values(parsed.world.teams)) {
      delete team.branding;
    }

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded.user.citySelectionConfirmed).toBe(true);
    expect(loaded.user.franchiseIdentityConfirmed).toBe(true);
    for (const team of Object.values(loaded.world.teams)) {
      expect(team.branding.logoId).toBeTruthy();
      expect(team.branding.primaryColor).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(() => validateGameState(loaded)).not.toThrow();
  });

  it("keeps in-progress city selection on city step", () => {
    let modern = createTestGameState({ saveId: "mig_v42_progress" });
    modern = bootstrapWorld(modern, createSeededRng(modern.meta.rngState)).state;
    modern = {
      ...modern,
      user: {
        ...modern.user,
        citySelectionConfirmed: false,
        franchiseIdentityConfirmed: false,
      },
    };

    const parsed = JSON.parse(serializeGameState(modern)) as {
      meta: { schemaVersion: number };
      user: Record<string, unknown>;
      world: { teams: Record<string, Record<string, unknown>> };
    };
    parsed.meta.schemaVersion = 41;
    delete parsed.user.franchiseIdentityConfirmed;
    for (const team of Object.values(parsed.world.teams)) {
      delete team.branding;
    }

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.user.citySelectionConfirmed).toBe(false);
    expect(loaded.user.franchiseIdentityConfirmed).toBe(false);
    expect(Object.values(loaded.world.teams)[0]!.branding.logoId).toBeTruthy();
  });
});
