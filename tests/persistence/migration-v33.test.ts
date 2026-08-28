import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { getActiveOwnedFranchise } from "@/state/owner-context";

describe("v32 → v33 migration", () => {
  it("adds ownershipConfidence defaults and validates", () => {
    const modern = createTestGameState({ saveId: "mig_v32" });
    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    const meta = parsed.meta as Record<string, unknown>;
    meta.schemaVersion = 32;

    const user = parsed.user as Record<string, unknown>;
    delete user.ownershipConfidence;

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(GAME_STATE_SCHEMA_VERSION).toBe(44);
    expect(getActiveOwnedFranchise(loaded).ownershipConfidence).toBeDefined();
    expect(getActiveOwnedFranchise(loaded).ownershipConfidence.mood).toBe("supportive");
    expect(getActiveOwnedFranchise(loaded).ownershipConfidence.recentEvidence).toEqual([]);
    expect(getActiveOwnedFranchise(loaded).ownershipConfidence.seasonNotes).toEqual([]);
    expect(() => validateGameState(loaded)).not.toThrow();

    const roundTrip = deserializeGameState(serializeGameState(loaded));
    expect(getActiveOwnedFranchise(roundTrip).ownershipConfidence.mood).toBe(
      getActiveOwnedFranchise(loaded).ownershipConfidence.mood,
    );
  });
});
