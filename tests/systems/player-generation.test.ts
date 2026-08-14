import { describe, expect, it } from "vitest";
import {
  PLAYER_POSITIONS,
  RATING_MAX,
  RATING_MIN,
  type Player,
  type PlayerAttributes,
  type PlayerPersonality,
} from "@/domain/entities/player";
import {
  isArchetypeCompatible,
  isPlayerArchetype,
  PLAYER_ARCHETYPES,
} from "@/domain/entities/player-archetype";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { createSeededRng } from "@/domain/rng";
import {
  generatePlayer,
  generatePlayerWithRng,
} from "@/systems/player-generation";
import {
  MAX_PLAYER_AGE,
  MIN_PLAYER_AGE,
} from "@/systems/player-generation-config";
import { generateRosters } from "@/systems/roster-generation";
import { createInitialGameState } from "@/state/create-initial-state";

const ATTRIBUTE_KEYS = [
  "speed",
  "strength",
  "athleticism",
  "stamina",
  "finishing",
  "midRange",
  "threePoint",
  "freeThrow",
  "ballHandling",
  "passing",
  "perimeterDefense",
  "interiorDefense",
  "steal",
  "block",
  "rebounding",
  "basketballIq",
  "offensiveIq",
  "defensiveIq",
  "consistency",
] as const satisfies readonly (keyof PlayerAttributes)[];

const PERSONALITY_KEYS = [
  "workEthic",
  "loyalty",
  "competitiveness",
  "leadership",
  "composure",
] as const satisfies readonly (keyof PlayerPersonality)[];

function expectValidPlayer(player: Player): void {
  expect(player.firstName.trim().length).toBeGreaterThan(0);
  expect(player.lastName.trim().length).toBeGreaterThan(0);
  expect(player.age).toBeGreaterThanOrEqual(MIN_PLAYER_AGE);
  expect(player.age).toBeLessThanOrEqual(MAX_PLAYER_AGE);
  expect(PLAYER_POSITIONS).toContain(player.position);
  expect(isPlayerArchetype(player.archetype)).toBe(true);
  expect(isArchetypeCompatible(player.archetype, player.position)).toBe(true);

  for (const key of ATTRIBUTE_KEYS) {
    expect(Number.isInteger(player.attributes[key])).toBe(true);
    expect(player.attributes[key]).toBeGreaterThanOrEqual(RATING_MIN);
    expect(player.attributes[key]).toBeLessThanOrEqual(RATING_MAX);
  }

  expect(Number.isInteger(player.potential.overall)).toBe(true);
  expect(player.potential.overall).toBeGreaterThanOrEqual(RATING_MIN);
  expect(player.potential.overall).toBeLessThanOrEqual(RATING_MAX);

  for (const key of PERSONALITY_KEYS) {
    expect(Number.isInteger(player.personality[key])).toBe(true);
    expect(player.personality[key]).toBeGreaterThanOrEqual(RATING_MIN);
    expect(player.personality[key]).toBeLessThanOrEqual(RATING_MAX);
  }

  const overall = calculatePlayerOverall(player.position, player.attributes);
  expect(player.potential.overall).toBeGreaterThanOrEqual(overall);
}

function meanOf(
  samples: Player[],
  key: keyof PlayerAttributes,
): number {
  const sum = samples.reduce((acc, player) => acc + player.attributes[key], 0);
  return sum / samples.length;
}

describe("generatePlayer", () => {
  it("is deterministic for the same seed", () => {
    const a = generatePlayer(12345);
    const b = generatePlayer(12345);
    expect(a).toEqual(b);
    expect(a.id).toBe(b.id);
  });

  it("is equivalent to generatePlayerWithRng(createSeededRng(seed))", () => {
    const a = generatePlayer(12345);
    const b = generatePlayerWithRng(createSeededRng(12345));
    expect(b).toEqual(a);
  });

  it("treats integer-string seeds including leading zeros as the same seed", () => {
    const numeric = generatePlayer(12345);
    expect(generatePlayer("12345")).toEqual(numeric);
    expect(generatePlayer("0012345")).toEqual(numeric);
  });

  it("normally produces different players for different seeds", () => {
    const a = generatePlayer(1);
    const b = generatePlayer(2);
    expect(a).not.toEqual(b);
  });

  it("produces a domain-valid player", () => {
    for (const seed of [1, 42, 99, 12345, 999_001]) {
      expectValidPlayer(generatePlayer(seed));
    }
  });

  it("respects forced compatible position and archetype", () => {
    const player = generatePlayer(55, {
      position: "PG",
      archetype: "floor_general",
    });
    expect(player.position).toBe("PG");
    expect(player.archetype).toBe("floor_general");
    expectValidPlayer(player);
  });

  it("rejects an incompatible forced archetype", () => {
    expect(() =>
      generatePlayer(55, {
        position: "C",
        archetype: "floor_general",
      }),
    ).toThrow(/incompatible/i);
  });

  it("does not consume RNG for overridden position (repeatable with options)", () => {
    const options = { position: "PG" as const };
    const a = generatePlayer(77, options);
    const b = generatePlayer(77, options);
    expect(a).toEqual(b);
    expect(a.position).toBe("PG");
    expect(isArchetypeCompatible(a.archetype, "PG")).toBe(true);
  });

  it("shows multi-sample position/archetype attribute coherence", () => {
    const floorGenerals: Player[] = [];
    const rimProtectors: Player[] = [];
    const stretchBigs: Player[] = [];
    const reboundingBigs: Player[] = [];

    for (let seed = 1000; seed < 1040; seed += 1) {
      floorGenerals.push(
        generatePlayer(seed, {
          position: "PG",
          archetype: "floor_general",
        }),
      );
      rimProtectors.push(
        generatePlayer(seed, {
          position: "C",
          archetype: "rim_protector",
        }),
      );
      stretchBigs.push(
        generatePlayer(seed, {
          position: "PF",
          archetype: "stretch_big",
        }),
      );
      reboundingBigs.push(
        generatePlayer(seed, {
          position: "PF",
          archetype: "rebounding_big",
        }),
      );
    }

    expect(meanOf(floorGenerals, "passing")).toBeGreaterThan(
      meanOf(rimProtectors, "passing"),
    );
    expect(meanOf(rimProtectors, "block")).toBeGreaterThan(
      meanOf(floorGenerals, "block"),
    );
    expect(meanOf(stretchBigs, "threePoint")).toBeGreaterThan(
      meanOf(reboundingBigs, "threePoint"),
    );
    expect(meanOf(reboundingBigs, "rebounding")).toBeGreaterThan(
      meanOf(stretchBigs, "rebounding"),
    );
  });

  it("can produce potential above current overall, especially for young ages", () => {
    let youngWithGap = 0;
    for (let seed = 2000; seed < 2100; seed += 1) {
      const player = generatePlayer(seed);
      const overall = calculatePlayerOverall(
        player.position,
        player.attributes,
      );
      expect(player.potential.overall).toBeGreaterThanOrEqual(overall);
      if (player.age <= 24 && player.potential.overall > overall + 3) {
        youngWithGap += 1;
      }
    }
    expect(youngWithGap).toBeGreaterThan(0);
  });

  it("varies personality across seeds for the same position and archetype", () => {
    const a = generatePlayer(301, {
      position: "SG",
      archetype: "scoring_guard",
    });
    const b = generatePlayer(302, {
      position: "SG",
      archetype: "scoring_guard",
    });
    expect(a.personality).not.toEqual(b.personality);
  });

  it("locks a regression fixture for seed 12345", () => {
    const player = generatePlayer(12345);
    expect(player.id).toBe("player_gen_12345");
    expect(player.firstName).toBe("Miles");
    expect(player.lastName).toBe("Griffin");
    expect(player.position).toBe("SG");
    expect(player.archetype).toBe("three_and_d_wing");
    expect(player.age).toBe(32);
    expect(player.nationality).toBe("Canada");
  });

  it("does not store quality on the player entity", () => {
    const player = generatePlayer(12345);
    expect("quality" in player).toBe(false);
  });
});

describe("generateRosters with player generation engine", () => {
  it("fills each team with ten players in fixed position slots", () => {
    const state = createInitialGameState({
      saveId: "save_roster_slots",
      rngSeed: 21,
      nowIso: "2026-08-13T12:00:00.000Z",
    });
    const result = generateRosters(state, createSeededRng(state.meta.rngState));
    const teamCount = Object.keys(state.world.teams).length;
    const players = Object.values(result.state.world.players);

    expect(players).toHaveLength(teamCount * 10);

    for (const teamId of Object.keys(state.world.teams)) {
      const teamPlayers = players
        .filter((player) => player.teamId === teamId)
        .sort((left, right) => left.id.localeCompare(right.id));
      expect(teamPlayers.map((player) => player.position)).toEqual([
        "PG",
        "SG",
        "SF",
        "PF",
        "C",
        "PG",
        "SG",
        "SF",
        "PF",
        "C",
      ]);
      for (const player of teamPlayers) {
        expectValidPlayer(player);
      }
    }
  });
});

describe("PLAYER_ARCHETYPES catalog coverage", () => {
  it("lists nine archetypes used by generation", () => {
    expect(PLAYER_ARCHETYPES).toHaveLength(9);
  });
});
