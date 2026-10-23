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
  const base = createTestGameState({ saveId: "mig_v77" });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

function legacyV76Json(): string {
  const parsed = JSON.parse(serializeGameState(modernState())) as {
    meta: { schemaVersion: number };
    business: Record<string, unknown>;
  };
  parsed.meta.schemaVersion = 76;
  delete parsed.business.developmentPlans;
  return JSON.stringify(parsed);
}

describe("v76 → v77 migration (development plans)", () => {
  it("starts every player on a balanced plan", () => {
    const loaded = deserializeGameState(legacyV76Json());
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded.business.developmentPlans).toEqual({});
    expect(() => validateGameState(loaded)).not.toThrow();
  });

  it("round-trips migrated saves byte-for-byte", () => {
    const serialized = serializeGameState(
      deserializeGameState(legacyV76Json()),
    );
    expect(serializeGameState(deserializeGameState(serialized))).toBe(
      serialized,
    );
  });
});
