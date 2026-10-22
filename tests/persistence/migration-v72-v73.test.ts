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
  const base = createTestGameState({ saveId: "mig_v73" });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

function legacyV72Json(): string {
  const parsed = JSON.parse(serializeGameState(modernState())) as {
    meta: { schemaVersion: number };
    settings: { offseason: Record<string, unknown> };
  };
  parsed.meta.schemaVersion = 72;
  delete parsed.settings.offseason.restrictedFreeAgency;
  return JSON.stringify(parsed);
}

describe("v72 → v73 migration (restricted free agency setting)", () => {
  it("turns restricted free agency on for existing saves", () => {
    const loaded = deserializeGameState(legacyV72Json());
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded.settings.offseason.restrictedFreeAgency).toBe(true);
    expect(() => validateGameState(loaded)).not.toThrow();
  });

  it("round-trips migrated saves byte-for-byte", () => {
    const serialized = serializeGameState(
      deserializeGameState(legacyV72Json()),
    );
    expect(serializeGameState(deserializeGameState(serialized))).toBe(
      serialized,
    );
  });
});
