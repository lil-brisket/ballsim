import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

function modernState() {
  const base = createTestGameState({ saveId: "mig_v76" });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

function legacyV75Json(): string {
  const parsed = JSON.parse(serializeGameState(modernState())) as {
    meta: { schemaVersion: number };
    business: Record<string, unknown>;
  };
  parsed.meta.schemaVersion = 75;
  delete parsed.business.playerMorale;
  return JSON.stringify(parsed);
}

describe("v75 → v76 migration (player morale)", () => {
  it("starts every player content (no stored moods)", () => {
    const loaded = deserializeGameState(legacyV75Json());
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded.business.playerMorale).toEqual({});
    expect(() => validateGameState(loaded)).not.toThrow();
  });

  it("round-trips migrated saves byte-for-byte", () => {
    const serialized = serializeGameState(
      deserializeGameState(legacyV75Json()),
    );
    expect(serializeGameState(deserializeGameState(serialized))).toBe(
      serialized,
    );
  });
});
