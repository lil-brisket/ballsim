import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { GAME_STATE_SCHEMA_VERSION, type GameState } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

function modernState() {
  const base = createTestGameState({ saveId: "mig_v71" });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

function legacyV70Json(): string {
  const parsed = JSON.parse(serializeGameState(modernState())) as {
    meta: { schemaVersion: number };
    business: Record<string, unknown>;
  };
  parsed.meta.schemaVersion = 70;
  delete parsed.business.deadMoney;
  return JSON.stringify(parsed);
}

describe("v70 → v71 migration (dead money)", () => {
  it("gives every save an empty dead-money store", () => {
    const loaded = deserializeGameState(legacyV70Json());
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded.business.deadMoney).toEqual({});
    expect(() => validateGameState(loaded)).not.toThrow();
  });

  it("round-trips migrated saves byte-for-byte", () => {
    const serialized = serializeGameState(
      deserializeGameState(legacyV70Json()),
    );
    expect(serializeGameState(deserializeGameState(serialized))).toBe(
      serialized,
    );
  });

  it("rejects a dead-money entry for an unknown team or bad amount", () => {
    const state = modernState();
    const teamId = Object.keys(state.world.teams)[0]!;
    const playerId = Object.keys(state.world.players)[0]!;
    const entry = {
      playerId,
      teamId,
      seasonYear: state.competition.season.year,
      amount: 1_000_000,
      reason: "waived",
      prepaid: false,
      createdOn: state.world.calendar.currentDate,
    };
    const withDead = (deadMoney: unknown): GameState =>
      ({
        ...state,
        business: { ...state.business, deadMoney },
      }) as GameState;
    expect(() =>
      validateGameState(withDead({ [teamId]: [entry] })),
    ).not.toThrow();
    expect(() =>
      validateGameState(
        withDead({ team_missing: [{ ...entry, teamId: "team_missing" }] }),
      ),
    ).toThrow(/deadMoney/);
    expect(() =>
      validateGameState(withDead({ [teamId]: [{ ...entry, amount: -5 }] })),
    ).toThrow(/amount/);
  });
});
