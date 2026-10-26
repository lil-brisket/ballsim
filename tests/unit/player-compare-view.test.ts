import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { getControlledTeam } from "@/state/selectors";
import { toPlayerCompareView } from "@/state/player-compare";

function bootstrapped() {
  const state = createTestGameState({ saveId: "player_compare_test" });
  const rng = createSeededRng(state.meta.rngState);
  return bootstrapWorld(state, rng).state;
}

describe("toPlayerCompareView", () => {
  it("shows contracts only for your own roster, like the player drawer", () => {
    const state = bootstrapped();
    const mine = getControlledTeam(state).roster[0]!;
    const theirs = Object.values(state.world.players).find(
      (player) =>
        player.teamId &&
        player.contractId &&
        !getControlledTeam(state).roster.includes(player.id),
    )!;

    expect(toPlayerCompareView(state, mine)?.contract).not.toBeNull();
    const other = toPlayerCompareView(state, theirs.id);
    expect(other).not.toBeNull();
    expect(other?.contract).toBeNull();
  });

  it("returns null for missing ids", () => {
    const state = bootstrapped();
    expect(toPlayerCompareView(state, undefined)).toBeNull();
    expect(toPlayerCompareView(state, "no_such_player")).toBeNull();
  });
});
