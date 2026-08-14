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
    expect(a.attributes.finishing).toBe(70);
    expect(a.attributes.midRange).toBe(68);
    expect(a.potential.overall).toBe(80);
  });

  it("applies top-level and nested attributes overrides", () => {
    const player = createPlayer({
      id: "player_custom",
      firstName: "Sam",
      age: 30,
      archetype: "shot_creator",
      attributes: { finishing: 90 },
    });

    expect(player.id).toBe("player_custom");
    expect(player.firstName).toBe("Sam");
    expect(player.age).toBe(30);
    expect(player.archetype).toBe("shot_creator");
    expect(player.attributes.finishing).toBe(90);
    expect(player.attributes.midRange).toBe(68);
    expect(player.attributes.passing).toBe(72);
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
