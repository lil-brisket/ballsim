import { describe, expect, it } from "vitest";
import { isValidPortraitAssignment } from "@/domain/entities/player-portrait";
import { createSeededRng } from "@/domain/rng";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

function legacyV64Json(): string {
  const base = createTestGameState({ saveId: "mig_v65" });
  const modern = bootstrapWorld(
    base,
    createSeededRng(base.meta.rngState),
  ).state;
  const parsed = JSON.parse(serializeGameState(modern)) as Record<
    string,
    Record<string, unknown>
  >;
  parsed.meta!.schemaVersion = 64;
  delete parsed.world!.playerPortraits;
  return JSON.stringify(parsed);
}

describe("v64 → v65 migration (player portraits)", () => {
  it("backfills a valid portrait for every player and preserves other state", () => {
    const json = legacyV64Json();
    const loaded = deserializeGameState(json);
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    const playerIds = Object.keys(loaded.world.players);
    expect(playerIds.length).toBeGreaterThan(0);
    for (const id of playerIds) {
      expect(isValidPortraitAssignment(loaded.world.playerPortraits[id])).toBe(
        true,
      );
    }
    const legacy = JSON.parse(json) as { world: Record<string, unknown> };
    expect(JSON.parse(JSON.stringify(loaded.world.players))).toEqual(
      legacy.world.players,
    );
    expect(() => validateGameState(loaded)).not.toThrow();
  });

  it("is deterministic across repeated loads of an un-resaved legacy save", () => {
    const json = legacyV64Json();
    const first = deserializeGameState(json);
    const second = deserializeGameState(json);
    expect(second.world.playerPortraits).toEqual(first.world.playerPortraits);
  });

  it("round-trips current saves without changing assignments", () => {
    const migrated = deserializeGameState(legacyV64Json());
    const reloaded = deserializeGameState(serializeGameState(migrated));
    expect(reloaded.world.playerPortraits).toEqual(
      migrated.world.playerPortraits,
    );
  });
});
