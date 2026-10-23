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
  const base = createTestGameState({ saveId: "mig_v75" });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

function legacyV74Json(): string {
  const parsed = JSON.parse(serializeGameState(modernState())) as {
    meta: { schemaVersion: number };
    settings: Record<string, unknown>;
  };
  parsed.meta.schemaVersion = 74;
  delete parsed.settings.draftLottery;
  return JSON.stringify(parsed);
}

describe("v74 → v75 migration (draft lottery setting)", () => {
  it("leaves the lottery off for existing leagues", () => {
    const loaded = deserializeGameState(legacyV74Json());
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded.settings.draftLottery).toEqual({
      enabled: false,
      oddsPreset: "flattened",
      picksDrawn: 4,
    });
    expect(() => validateGameState(loaded)).not.toThrow();
  });

  it("turns it on for new leagues", () => {
    expect(modernState().settings.draftLottery.enabled).toBe(true);
  });

  it("round-trips migrated saves byte-for-byte", () => {
    const serialized = serializeGameState(
      deserializeGameState(legacyV74Json()),
    );
    expect(serializeGameState(deserializeGameState(serialized))).toBe(
      serialized,
    );
  });
});
