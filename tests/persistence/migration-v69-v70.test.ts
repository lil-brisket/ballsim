import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { NEUTRAL_TEAM_PLAY_STYLE } from "@/persistence/mappers/game-state-migrations/legacy-team-play-style";
import { validateGameState } from "@/persistence/validate-game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

function modernState() {
  const base = createTestGameState({ saveId: "mig_v70" });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

function legacyV69Json(): string {
  const parsed = JSON.parse(serializeGameState(modernState())) as {
    meta: { schemaVersion: number };
    world: { teams: Record<string, Record<string, unknown>> };
  };
  parsed.meta.schemaVersion = 69;
  for (const team of Object.values(parsed.world.teams)) {
    team.playStyle = { ...NEUTRAL_TEAM_PLAY_STYLE, pace: 72 };
  }
  return JSON.stringify(parsed);
}

describe("v69 → v70 migration (drop Team.playStyle)", () => {
  it("removes playStyle from every team and validates", () => {
    const loaded = deserializeGameState(legacyV69Json());
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    for (const team of Object.values(loaded.world.teams)) {
      expect("playStyle" in team).toBe(false);
    }
    expect(() => validateGameState(loaded)).not.toThrow();
  });

  it("changes nothing except playStyle and the schema version", () => {
    const migrated = serializeGameState(deserializeGameState(legacyV69Json()));
    expect(migrated).toBe(serializeGameState(modernState()));
  });

  it("round-trips migrated saves byte-for-byte", () => {
    const serialized = serializeGameState(
      deserializeGameState(legacyV69Json()),
    );
    expect(serializeGameState(deserializeGameState(serialized))).toBe(
      serialized,
    );
  });
});
