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
  const base = createTestGameState({ saveId: "mig_v67" });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

function legacyV66Json(): string {
  const parsed = JSON.parse(serializeGameState(modernState())) as Record<
    string,
    Record<string, unknown>
  >;
  parsed.meta!.schemaVersion = 66;
  delete parsed.user!.participation;
  return JSON.stringify(parsed);
}

describe("v66 → v67 migration (league participation)", () => {
  it("defaults legacy saves to single-player and keeps every owned team", () => {
    const json = legacyV66Json();
    const loaded = deserializeGameState(json);
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded.user.participation).toEqual({ mode: "single" });

    const legacy = JSON.parse(json) as { user: Record<string, unknown> };
    expect(loaded.user.ownedTeamIds).toEqual(legacy.user.ownedTeamIds);
    expect(loaded.user.activeOwnerTeamId).toBe(legacy.user.activeOwnerTeamId);
    expect(() => validateGameState(loaded)).not.toThrow();
  });

  it("changes nothing except participation and the schema version", () => {
    const migrated = JSON.parse(
      serializeGameState(deserializeGameState(legacyV66Json())),
    ) as Record<string, Record<string, unknown>>;
    delete migrated.user!.participation;
    migrated.meta!.schemaVersion = 66;
    expect(JSON.stringify(migrated)).toBe(legacyV66Json());
  });

  it("round-trips migrated saves byte-for-byte", () => {
    const serialized = serializeGameState(
      deserializeGameState(legacyV66Json()),
    );
    expect(serializeGameState(deserializeGameState(serialized))).toBe(
      serialized,
    );
  });

  it("rejects a save whose participation is missing or malformed", () => {
    const state = modernState();
    expect(() =>
      validateGameState({
        ...state,
        user: { ...state.user, participation: { mode: "online" } },
      } as unknown as typeof state),
    ).toThrow(/user\.participation\.mode/);
    const { participation: _omit, ...userWithout } = state.user;
    expect(() =>
      validateGameState({
        ...state,
        user: userWithout,
      } as unknown as typeof state),
    ).toThrow(/user\.participation must be an object/);
  });
});
