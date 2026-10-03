import { describe, expect, it } from "vitest";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { createTestGameState } from "../factories/game-state";

describe("v61 → v62 migration", () => {
  it("initializes empty pendingDraftClassDecisions", () => {
    const modern = createTestGameState({ saveId: "mig_v62" });
    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    (parsed.meta as Record<string, unknown>).schemaVersion = 61;
    const user = parsed.user as Record<string, unknown>;
    delete user.pendingDraftClassDecisions;

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded.user.pendingDraftClassDecisions).toEqual({});
    expect(() => validateGameState(loaded)).not.toThrow();
  });
});
