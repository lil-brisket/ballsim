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
  const base = createTestGameState({ saveId: "mig_v78" });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

function legacyV77Json(): string {
  const parsed = JSON.parse(serializeGameState(modernState())) as {
    meta: { schemaVersion: number };
    business: Record<string, unknown>;
  };
  parsed.meta.schemaVersion = 77;
  delete parsed.business.hallOfFame;
  delete (parsed as unknown as { world: Record<string, unknown> }).world
    .retiredNumbers;
  return JSON.stringify(parsed);
}

describe("v77 → v78 migration (Hall of Fame and retired numbers)", () => {
  it("starts with an empty Hall of Fame and no retired numbers", () => {
    const loaded = deserializeGameState(legacyV77Json());
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded.business.hallOfFame).toEqual({ inductees: [] });
    expect(loaded.world.retiredNumbers).toEqual({});
    expect(() => validateGameState(loaded)).not.toThrow();
  });

  it("round-trips migrated saves byte-for-byte", () => {
    const serialized = serializeGameState(
      deserializeGameState(legacyV77Json()),
    );
    expect(serializeGameState(deserializeGameState(serialized))).toBe(
      serialized,
    );
  });
});
