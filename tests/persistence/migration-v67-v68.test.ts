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
  const base = createTestGameState({ saveId: "mig_v68" });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

function legacyV67Json(): string {
  const parsed = JSON.parse(serializeGameState(modernState())) as Record<
    string,
    Record<string, unknown>
  >;
  parsed.meta!.schemaVersion = 67;
  delete parsed.competition!.aiTradeSearch;
  return JSON.stringify(parsed);
}

describe("v67 → v68 migration (AI trade search memory)", () => {
  it("starts legacy saves with empty search memory", () => {
    const loaded = deserializeGameState(legacyV67Json());
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded.competition.aiTradeSearch).toEqual({ byTeamId: {} });
    expect(() => validateGameState(loaded)).not.toThrow();
  });

  it("changes nothing except aiTradeSearch and the schema version", () => {
    const migrated = JSON.parse(
      serializeGameState(deserializeGameState(legacyV67Json())),
    ) as Record<string, Record<string, unknown>>;
    delete migrated.competition!.aiTradeSearch;
    migrated.meta!.schemaVersion = 67;
    expect(JSON.stringify(migrated)).toBe(legacyV67Json());
  });

  it("round-trips migrated saves byte-for-byte", () => {
    const serialized = serializeGameState(
      deserializeGameState(legacyV67Json()),
    );
    expect(serializeGameState(deserializeGameState(serialized))).toBe(
      serialized,
    );
  });

  it("rejects malformed search records", () => {
    const state = modernState();
    const withRecord = (record: unknown) =>
      ({
        ...state,
        competition: {
          ...state.competition,
          aiTradeSearch: { byTeamId: { team_x: record } },
        },
      }) as unknown as typeof state;
    expect(() =>
      validateGameState(withRecord({ lastSearchDate: "", inputsKey: "abc" })),
    ).toThrow(/aiTradeSearch\.byTeamId\[team_x\]\.lastSearchDate/);
    expect(() =>
      validateGameState(
        withRecord({ lastSearchDate: "2026-10-01", inputsKey: "" }),
      ),
    ).toThrow(/aiTradeSearch\.byTeamId\[team_x\]\.inputsKey/);
    const { aiTradeSearch: _omit, ...competitionWithout } = state.competition;
    expect(() =>
      validateGameState({
        ...state,
        competition: competitionWithout,
      } as unknown as typeof state),
    ).toThrow(/aiTradeSearch/);
  });
});
