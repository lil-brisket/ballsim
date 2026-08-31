import { describe, expect, it } from "vitest";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { createTestGameState } from "../factories/game-state";
import { runYearlyAwards } from "@/systems/awards/award-pipeline";
import {
  addPlayerToState,
  createAwardsTestState,
  generatePlayerGames,
  injectGames,
  primaryTeamIds,
} from "../systems/awards/helpers";

describe("v56 → v57 migration", () => {
  it("adds empty awards and defaults started on playerStats", () => {
    const modern = createTestGameState({ saveId: "mig_v57" });
    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    (parsed.meta as Record<string, unknown>).schemaVersion = 56;
    const business = parsed.business as Record<string, unknown>;
    delete business.awards;

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(GAME_STATE_SCHEMA_VERSION).toBe(57);
    expect(loaded.business.awards).toEqual({ results: {} });
    expect(() => validateGameState(loaded)).not.toThrow();
  });
});

describe("awards persistence", () => {
  it("survives serialize/deserialize after yearly awards", () => {
    let state = createAwardsTestState();
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "star", teamA);
    state = injectGames(
      state,
      generatePlayerGames({
        playerId: "star",
        teamId: teamA,
        opponentId: teamB,
        count: 55,
        datePrefix: "2026-01",
        perGame: { points: 25, minutes: 34, rebounds: 7, assists: 6 },
      }),
    );
    state = runYearlyAwards(state).state;
    const count = Object.keys(state.business.awards.results).length;
    expect(count).toBeGreaterThan(0);

    const roundTrip = deserializeGameState(serializeGameState(state));
    expect(Object.keys(roundTrip.business.awards.results).length).toBe(count);
    expect(() => validateGameState(roundTrip)).not.toThrow();
  });
});
