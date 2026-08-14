import { describe, expect, it } from "vitest";
import { createInitialGameState } from "@/state/create-initial-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";

describe("GameState schema migration", () => {
  it("migrates schemaVersion 1 saves to version 2 with rngState", () => {
    const modern = createInitialGameState({
      saveId: "save_migrate",
      rngSeed: 5,
      nowIso: "2026-08-13T12:00:00.000Z",
    });

    const v1Json = JSON.stringify({
      ...modern,
      meta: {
        saveId: modern.meta.saveId,
        schemaVersion: 1,
        createdAt: modern.meta.createdAt,
        updatedAt: modern.meta.updatedAt,
        rngSeed: modern.meta.rngSeed,
      },
      competition: {
        ...modern.competition,
        games: {
          game_legacy: {
            id: "game_legacy",
            seasonId: modern.competition.season.id,
            date: "2026-10-02",
            homeTeamId: modern.user.controlledTeamId,
            awayTeamId: Object.keys(modern.world.teams).find(
              (id) => id !== modern.user.controlledTeamId,
            ),
            status: "scheduled",
            homeScore: null,
            awayScore: null,
          },
        },
      },
    });

    const migrated = deserializeGameState(v1Json);
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(migrated.meta.rngState).toBe(5);
    expect(migrated.competition.games.game_legacy?.boxScore).toBeNull();
  });

  it("round-trips schema version 2 including rngState", () => {
    const state = createInitialGameState({
      saveId: "save_v2",
      rngSeed: 9,
    });
    const restored = deserializeGameState(serializeGameState(state));
    expect(restored.meta.rngState).toBe(state.meta.rngState);
    expect(restored).toEqual(state);
  });
});
