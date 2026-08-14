import { describe, expect, it } from "vitest";
import { createPlayer } from "../factories/player";
import { createTeam } from "../factories/team";
import { createTestGameState } from "../factories/game-state";
import { FIXTURE_SEASON_START } from "../fixtures/dates";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../helpers/determinism";

describe("createPlayer", () => {
  it("produces deterministic defaults", () => {
    const a = createPlayer();
    const b = createPlayer();
    expect(a).toEqual(b);
    expect(a.id).toBe("player_test");
    expect(a.firstName).toBe("Alex");
    expect(a.ratings.overall).toBe(70);
  });

  it("applies top-level and nested ratings overrides", () => {
    const player = createPlayer({
      id: "player_custom",
      firstName: "Sam",
      age: 30,
      ratings: { offense: 90 },
    });

    expect(player.id).toBe("player_custom");
    expect(player.firstName).toBe("Sam");
    expect(player.age).toBe(30);
    expect(player.ratings.offense).toBe(90);
    expect(player.ratings.defense).toBe(72);
    expect(player.ratings.overall).toBe(70);
  });
});

describe("createTeam", () => {
  it("produces deterministic defaults and accepts overrides", () => {
    expect(createTeam()).toEqual(createTeam());
    expect(createTeam({ abbreviation: "SUM" }).abbreviation).toBe("SUM");
  });
});

describe("createTestGameState", () => {
  it("always supplies deterministic meta defaults", () => {
    const state = createTestGameState();
    expect(state.meta.saveId).toBe("save_test");
    expect(state.meta.rngSeed).toBe(TEST_RNG_SEED);
    expect(state.meta.createdAt).toBe(TEST_NOW_ISO);
    expect(state.world.calendar.currentDate).toBe(FIXTURE_SEASON_START);
  });
});
