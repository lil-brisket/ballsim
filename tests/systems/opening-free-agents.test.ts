import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { listFreeAgents } from "@/systems/free-agency";
import { generateRosters } from "@/systems/roster-generation";
import {
  DEFAULT_ROSTER_SIZE,
  OPENING_FREE_AGENT_COUNT,
} from "@/systems/roster-generation-config";
import { createTestGameState } from "../factories/game-state";

/**
 * A generated league used to open with every player under contract, so the
 * Free Agency page was empty until the first offseason (#183).
 */
describe("opening free agents", () => {
  function generate(seed: number) {
    const state = createTestGameState({ saveId: "opening_fa", rngSeed: seed });
    const rng = createSeededRng(state.meta.rngState);
    return { state: generateRosters(state, rng).state, rng };
  }

  it("opens the league with unsigned free agents at every position", () => {
    const { state } = generate(11);
    const pool = listFreeAgents(state).playerIds;

    expect(pool).toHaveLength(OPENING_FREE_AGENT_COUNT);
    const positions = new Set(
      pool.map((id) => state.world.players[id]!.position),
    );
    expect(positions.size).toBe(5);
    for (const team of Object.values(state.world.teams)) {
      expect(team.roster).toHaveLength(DEFAULT_ROSTER_SIZE);
    }
  });

  it("is deterministic per seed", () => {
    const first = generate(11);
    const second = generate(11);
    expect(second.state.world.players).toEqual(first.state.world.players);
    expect(second.rng.getState()).toBe(first.rng.getState());
  });
});
