import { describe, expect, it } from "vitest";
import { isValidPortraitAssignment } from "@/domain/entities/player-portrait";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { migrateV82ToV83 } from "@/persistence/mappers/game-state-migrations/v66-v75";
import { validateGameState } from "@/persistence/validate-game-state";
import { createInitialGameState } from "@/state/create-initial-state";
import { GAME_STATE_SCHEMA_VERSION, type GameState } from "@/state/game-state";
import { ensurePlayerPortraits } from "@/systems/portraits/assign-player-portraits";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { makeTestLibrary } from "../factories/portrait-library";

/** A v82 save: portrait assignments exist but none has a libraryId. */
function v82State(): GameState {
  const initial = createInitialGameState({
    saveId: "migration_v83",
    rngSeed: 83,
    settings: CBL_GAME_SETTINGS,
  });
  const base = bootstrapWorld(
    initial,
    createSeededRng(initial.meta.rngState),
  ).state;
  const withFaces = ensurePlayerPortraits(base, { library: [] }).state;
  return { ...withFaces, meta: { ...withFaces.meta, schemaVersion: 82 } };
}

describe("migration v82 -> v83 (portrait library ids)", () => {
  it("links every assignment to a library image and keeps the faces", () => {
    const state = v82State();
    const library = makeTestLibrary(
      Object.keys(state.world.players).length * 2,
    );
    const ids = new Set(library.map((entry) => entry.id));
    const migrated = migrateV82ToV83(state, library);

    expect(migrated.meta.schemaVersion).toBe(83);
    const before = state.world.playerPortraits;
    for (const [id, entry] of Object.entries(migrated.world.playerPortraits)) {
      expect(isValidPortraitAssignment(entry)).toBe(true);
      expect(ids.has(entry.libraryId!)).toBe(true);
      expect(entry.traits).toEqual(before[id]!.traits);
      expect(entry.salt).toBe(before[id]!.salt);
    }
    expect(migrated.world.players).toBe(state.world.players);
  });

  it("is deterministic across repeated loads of an un-resaved save", () => {
    const state = v82State();
    const library = makeTestLibrary(Object.keys(state.world.players).length);
    expect(migrateV82ToV83(state, library).world.playerPortraits).toEqual(
      migrateV82ToV83(state, library).world.playerPortraits,
    );
  });

  it("leaves assignments alone when the library is empty", () => {
    const state = v82State();
    const migrated = migrateV82ToV83(state, []);
    expect(migrated.meta.schemaVersion).toBe(83);
    expect(migrated.world.playerPortraits).toBe(state.world.playerPortraits);
  });

  it("loads a v82 save through the mapper and round-trips it", () => {
    const loaded = deserializeGameState(JSON.stringify(v82State()));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(GAME_STATE_SCHEMA_VERSION).toBeGreaterThanOrEqual(83);
    expect(() => validateGameState(loaded)).not.toThrow();
    const reloaded = deserializeGameState(serializeGameState(loaded));
    expect(reloaded.world.playerPortraits).toEqual(
      loaded.world.playerPortraits,
    );
  });
});
