import { describe, expect, it } from "vitest";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { createTestGameState } from "../factories/game-state";

describe("v62 → current schema migration", () => {
  it("adds homeFillSeries and gameArchiveIndex", () => {
    const modern = createTestGameState({ saveId: "mig_v64" });
    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    (parsed.meta as Record<string, unknown>).schemaVersion = 62;
    const business = parsed.business as Record<string, unknown>;
    delete business.gameArchiveIndex;
    const ops = business.franchiseOps as Record<string, Record<string, unknown>>;
    for (const teamOps of Object.values(ops)) {
      delete teamOps.homeFillSeries;
    }

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    const teamId = Object.keys(loaded.world.teams)[0]!;
    expect(loaded.business.franchiseOps[teamId]?.homeFillSeries).toEqual([]);
    expect(loaded.business.gameArchiveIndex?.byPlayerId).toEqual({});
    expect(() => validateGameState(loaded)).not.toThrow();
  });
});
