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
  const base = createTestGameState({ saveId: "mig_v72" });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

function legacyV71Json(): string {
  const parsed = JSON.parse(serializeGameState(modernState())) as {
    meta: { schemaVersion: number };
    business: Record<string, unknown>;
  };
  parsed.meta.schemaVersion = 71;
  delete parsed.business.extensionTalks;
  return JSON.stringify(parsed);
}

describe("v71 → v72 migration (extension talks)", () => {
  it("starts every save with no extension talks", () => {
    const loaded = deserializeGameState(legacyV71Json());
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded.business.extensionTalks).toEqual({});
    expect(() => validateGameState(loaded)).not.toThrow();
  });

  it("round-trips migrated saves byte-for-byte", () => {
    const serialized = serializeGameState(
      deserializeGameState(legacyV71Json()),
    );
    expect(serializeGameState(deserializeGameState(serialized))).toBe(
      serialized,
    );
  });

  it("rejects talks with a bad response or unknown player", () => {
    const state = modernState();
    const teamId = Object.keys(state.world.teams)[0]!;
    const playerId = Object.keys(state.world.players)[0]!;
    const talks = {
      playerId,
      teamId,
      contractId: "contract_x",
      refusals: 1,
      lastRefusedOn: state.world.calendar.currentDate,
      testingMarket: false,
      lastResponse: {
        kind: "refuse",
        offeredSalary: 1_000_000,
        offeredYears: 2,
        askSalary: 1_000_000,
        askYears: 2,
        on: state.world.calendar.currentDate,
      },
    };
    const withTalks = (extensionTalks: unknown): GameState =>
      ({
        ...state,
        business: { ...state.business, extensionTalks },
      }) as GameState;
    expect(() =>
      validateGameState(withTalks({ [playerId]: talks })),
    ).not.toThrow();
    expect(() =>
      validateGameState(
        withTalks({
          [playerId]: {
            ...talks,
            lastResponse: { ...talks.lastResponse, kind: "maybe" },
          },
        }),
      ),
    ).toThrow(/lastResponse.kind/);
    expect(() =>
      validateGameState(withTalks({ ghost: { ...talks, playerId: "ghost" } })),
    ).toThrow(/extensionTalks/);
  });
});
