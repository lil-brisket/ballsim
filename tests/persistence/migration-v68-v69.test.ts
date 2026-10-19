import { describe, expect, it } from "vitest";
import type { TeamId } from "@/domain/ids";
import { isJerseyNumber } from "@/domain/jersey-number";
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
  const base = createTestGameState({ saveId: "mig_v69" });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

function legacyV68Json(): string {
  const parsed = JSON.parse(serializeGameState(modernState())) as {
    meta: { schemaVersion: number };
    world: { players: Record<string, Record<string, unknown>> };
  };
  parsed.meta.schemaVersion = 68;
  for (const player of Object.values(parsed.world.players)) {
    delete player.jerseyNumber;
  }
  return JSON.stringify(parsed);
}

describe("v68 → v69 migration (jersey numbers)", () => {
  it("numbers every player, unique within each franchise", () => {
    const loaded = deserializeGameState(legacyV68Json());
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    for (const player of Object.values(loaded.world.players)) {
      expect(isJerseyNumber(player.jerseyNumber)).toBe(true);
    }
    for (const teamId of Object.keys(loaded.world.teams) as TeamId[]) {
      const numbers = Object.values(loaded.world.players)
        .filter((p) => p.teamId === teamId && p.retired !== true)
        .map((p) => p.jerseyNumber);
      expect(new Set(numbers).size).toBe(numbers.length);
    }
    expect(() => validateGameState(loaded)).not.toThrow();
  });

  it("gives the same numbers a new league gets", () => {
    const loaded = deserializeGameState(legacyV68Json());
    const modern = modernState();
    for (const [id, player] of Object.entries(modern.world.players)) {
      expect(
        loaded.world.players[id as keyof typeof loaded.world.players]!
          .jerseyNumber,
      ).toBe(player.jerseyNumber);
    }
  });

  it("changes nothing except jersey numbers and the schema version", () => {
    const migrated = JSON.parse(
      serializeGameState(deserializeGameState(legacyV68Json())),
    ) as {
      meta: { schemaVersion: number };
      world: { players: Record<string, Record<string, unknown>> };
    };
    migrated.meta.schemaVersion = 68;
    for (const player of Object.values(migrated.world.players)) {
      delete player.jerseyNumber;
    }
    expect(JSON.stringify(migrated)).toBe(legacyV68Json());
  });

  it("round-trips migrated saves byte-for-byte", () => {
    const serialized = serializeGameState(
      deserializeGameState(legacyV68Json()),
    );
    expect(serializeGameState(deserializeGameState(serialized))).toBe(
      serialized,
    );
  });

  it("rejects an out-of-range jersey number", () => {
    const state = modernState();
    const [id, player] = Object.entries(state.world.players)[0]!;
    const bad = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [id]: { ...player, jerseyNumber: 100 },
        },
      },
    };
    expect(() => validateGameState(bad)).toThrow(/jerseyNumber/);
  });
});
