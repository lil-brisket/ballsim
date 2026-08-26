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

describe("v35 → v36 migration", () => {
  it("adds empty gameArchive and playerHistory", () => {
    let modern = createTestGameState({ saveId: "mig_v36" });
    modern = bootstrapWorld(modern, createSeededRng(modern.meta.rngState)).state;

    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    (parsed.meta as Record<string, unknown>).schemaVersion = 35;
    const business = parsed.business as Record<string, unknown>;
    delete business.gameArchive;
    delete business.playerHistory;

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(GAME_STATE_SCHEMA_VERSION).toBe(42);
    expect(loaded.business.gameArchive).toEqual({});
    expect(loaded.business.playerHistory).toEqual({});
    expect(() => validateGameState(loaded)).not.toThrow();
  });
});
