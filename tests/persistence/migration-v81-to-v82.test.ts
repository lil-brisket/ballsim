import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { migrateV81ToV82 } from "@/persistence/mappers/game-state-migrations/v66-v75";
import { deserializeGameState } from "@/persistence/mappers/game-state-mapper";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";

/** A v81 save: teams' coachingPhilosophy has no focalPlayerId. */
function v81State(): GameState {
  const initial = createInitialGameState({
    saveId: "migration_v82",
    rngSeed: 82,
    settings: CBL_GAME_SETTINGS,
  });
  const base = bootstrapWorld(
    initial,
    createSeededRng(initial.meta.rngState),
  ).state;
  const teams = Object.fromEntries(
    Object.entries(base.world.teams).map(([teamId, team]) => {
      const { focalPlayerId: _focal, ...philosophy } = team.coachingPhilosophy;
      return [teamId, { ...team, coachingPhilosophy: philosophy }];
    }),
  );
  return {
    ...base,
    meta: { ...base.meta, schemaVersion: 81 },
    world: { ...base.world, teams },
  } as unknown as GameState;
}

describe("migration v81 -> v82", () => {
  it("adds a null focal player to every team and keeps the rest", () => {
    const state = v81State();
    const migrated = migrateV81ToV82(state);
    expect(migrated.meta.schemaVersion).toBe(82);
    for (const [teamId, team] of Object.entries(migrated.world.teams)) {
      expect(team.coachingPhilosophy).toEqual({
        ...state.world.teams[teamId]!.coachingPhilosophy,
        focalPlayerId: null,
      });
    }
  });

  it("loads a v81 save through the mapper", () => {
    const loaded = deserializeGameState(JSON.stringify(v81State()));
    for (const team of Object.values(loaded.world.teams)) {
      expect(team.coachingPhilosophy.focalPlayerId).toBeNull();
    }
  });
});
