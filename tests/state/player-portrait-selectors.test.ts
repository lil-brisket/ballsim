import { describe, expect, it } from "vitest";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import type { GameState } from "@/state/game-state";
import { derivePortraitTraits } from "@/systems/portraits/assign-player-portraits";
import { createTestGameState } from "../factories/game-state";

function stateWith(entry: unknown): GameState {
  const base = createTestGameState({ saveId: "selector_portraits" });
  return {
    ...base,
    world: { ...base.world, playerPortraits: { player_1: entry } },
  } as unknown as GameState;
}

const face: PlayerPortraitAssignment = {
  version: 1,
  traits: derivePortraitTraits("selector_portraits", "player_1", 0),
  salt: 0,
};

describe("selectPlayerPortrait", () => {
  it("returns null for a missing or invalid entry", () => {
    expect(selectPlayerPortrait(stateWith(undefined), "player_1")).toBeNull();
    expect(
      selectPlayerPortrait(stateWith({ version: 9 }), "player_1"),
    ).toBeNull();
  });

  it("returns a valid face unchanged", () => {
    expect(selectPlayerPortrait(stateWith(face), "player_1")).toBe(face);
  });

  it("drops a library id that is not in the shipped manifest", () => {
    const stale = { ...face, libraryId: "p9999" };
    const selected = selectPlayerPortrait(stateWith(stale), "player_1");
    expect(selected).toEqual(face);
    expect(selected?.libraryId).toBeUndefined();
  });
});
