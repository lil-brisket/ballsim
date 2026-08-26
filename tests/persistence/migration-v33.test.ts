import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";

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
    expect(GAME_STATE_SCHEMA_VERSION).toBe(42);
    expect(loaded.user.ownershipConfidence).toBeDefined();
    expect(loaded.user.ownershipConfidence.mood).toBe("supportive");
    expect(loaded.user.ownershipConfidence.recentEvidence).toEqual([]);
    expect(loaded.user.ownershipConfidence.seasonNotes).toEqual([]);
    expect(() => validateGameState(loaded)).not.toThrow();

    const roundTrip = deserializeGameState(serializeGameState(loaded));
    expect(roundTrip.user.ownershipConfidence.mood).toBe(
      loaded.user.ownershipConfidence.mood,
    );
  });
});
