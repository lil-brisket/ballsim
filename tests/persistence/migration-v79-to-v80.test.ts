import { describe, expect, it } from "vitest";
import type { GameState } from "@/state/game-state";
import { migrateV79ToV80 } from "@/persistence/mappers/game-state-migrations/v66-v75";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { createTestGameState } from "../factories/game-state";

/** A v79 save: ownership confidence has no board pressure yet. */
function v79State(): GameState {
  const base = createTestGameState({ saveId: "migration_v80" });
  const ownedFranchises = Object.fromEntries(
    Object.entries(base.user.ownedFranchises).map(([teamId, franchise]) => {
      const { boardPressure: _dropped, ...confidence } =
        franchise.ownershipConfidence;
      return [teamId, { ...franchise, ownershipConfidence: confidence }];
    }),
  );
  return {
    ...base,
    meta: { ...base.meta, schemaVersion: 79 },
    user: { ...base.user, ownedFranchises },
  } as unknown as GameState;
}

describe("migration v79 -> v80", () => {
  it("starts every owned franchise with no board pressure", () => {
    const migrated = migrateV79ToV80(v79State());
    expect(migrated.meta.schemaVersion).toBe(80);
    const franchises = Object.values(migrated.user.ownedFranchises);
    expect(franchises.length).toBeGreaterThan(0);
    for (const franchise of franchises) {
      expect(franchise.ownershipConfidence.boardPressure).toEqual({
        stage: "none",
      });
    }
  });

  it("loads a v79 save through the mapper", () => {
    const state = deserializeGameState(JSON.stringify(v79State()));
    const franchise = Object.values(state.user.ownedFranchises)[0]!;
    expect(franchise.ownershipConfidence.boardPressure.stage).toBe("none");
    expect(
      serializeGameState(deserializeGameState(serializeGameState(state))),
    ).toBe(serializeGameState(state));
  });
});
