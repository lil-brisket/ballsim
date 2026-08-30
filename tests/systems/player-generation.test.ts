import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  PLAYER_ATTRIBUTE_KEYS,
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
import { isPlayerNationality } from "@/domain/entities/player-nationality";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import {
  generatePlayer,
  generatePlayerWithRng,
} from "@/systems/player-generation";
import {
  developmentStageForAge,
  MAX_PERSONALITY,
  MAX_PLAYER_AGE,
  MIN_PERSONALITY,
  MIN_PLAYER_AGE,
  POSITION_BODY_RANGES,
  potentialGapBandForAge,
} from "@/systems/player-generation-config";
import { generateRosters } from "@/systems/roster-generation";

const SAMPLE_SIZE = 5000;

const DETERMINISTIC_SEEDS = [
  0, 1, 42, 12345, 999999, 7, 13, 256, 2026, 8675309,
] as const;

const PERSONALITY_KEYS = [
  "workEthic",
  "loyalty",
  "competitiveness",
  "leadership",
  "composure",
] as const satisfies readonly (keyof PlayerPersonality)[];

type GeneratedSample = {
  seed: number;
  player: Player;
};

function clampRating(value: number): number {
  return Math.min(RATING_MAX, Math.max(RATING_MIN, value));
}

function seedMessage(seed: number | string): string {
  return `Generated invalid player for seed ${seed}`;
}

function expectValidGeneratedPlayer(
  player: Player,
  seed: number | string,
): void {
  const message = seedMessage(seed);

  expect(player.id.length, message).toBeGreaterThan(0);
  expect(player.firstName.trim().length, message).toBeGreaterThan(0);
  expect(player.lastName.trim().length, message).toBeGreaterThan(0);
  expect(isPlayerNationality(player.nationality), message).toBe(true);

  expect(Number.isInteger(player.age), message).toBe(true);
  expect(player.age, message).toBeGreaterThanOrEqual(MIN_PLAYER_AGE);
  expect(player.age, message).toBeLessThanOrEqual(MAX_PLAYER_AGE);

  expect(PLAYER_POSITIONS, message).toContain(player.position);
  expect(isPlayerArchetype(player.archetype), message).toBe(true);
  expect(
    isArchetypeCompatible(player.archetype, player.position),
    message,
  ).toBe(true);

  const body = POSITION_BODY_RANGES[player.position];
  expect(Number.isInteger(player.heightInches), message).toBe(true);
  expect(Number.isInteger(player.weightPounds), message).toBe(true);
  expect(player.heightInches, message).toBeGreaterThanOrEqual(
    body.minHeightInches,
  );
  expect(player.heightInches, message).toBeLessThanOrEqual(body.maxHeightInches);
  expect(player.weightPounds, message).toBeGreaterThanOrEqual(
    body.minWeightPounds,
  );
  expect(player.weightPounds, message).toBeLessThanOrEqual(body.maxWeightPounds);

  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    expect(player.attributes[key], message).toBeDefined();
    expect(Number.isInteger(player.attributes[key]), message).toBe(true);
    expect(player.attributes[key], message).toBeGreaterThanOrEqual(RATING_MIN);
    expect(player.attributes[key], message).toBeLessThanOrEqual(RATING_MAX);
  }

  const overall = calculatePlayerOverall(player.position, player.attributes);
  expect(Number.isInteger(player.potential.overall), message).toBe(true);
  expect(player.potential.overall, message).toBeGreaterThanOrEqual(RATING_MIN);
  expect(player.potential.overall, message).toBeLessThanOrEqual(RATING_MAX);
  expect(player.potential.overall, message).toBeGreaterThanOrEqual(overall);

  const gapBand = potentialGapBandForAge(player.age);
  const minPotential = clampRating(overall + gapBand.min);
  const maxPotential = clampRating(overall + gapBand.max);
  expect(player.potential.overall, message).toBeGreaterThanOrEqual(minPotential);
  expect(player.potential.overall, message).toBeLessThanOrEqual(maxPotential);

  for (const key of PERSONALITY_KEYS) {
    expect(Number.isInteger(player.personality[key]), message).toBe(true);
    expect(player.personality[key], message).toBeGreaterThanOrEqual(RATING_MIN);
    expect(player.personality[key], message).toBeLessThanOrEqual(RATING_MAX);
    expect(player.personality[key], message).toBeGreaterThanOrEqual(
      MIN_PERSONALITY,
    );
    expect(player.personality[key], message).toBeLessThanOrEqual(MAX_PERSONALITY);
  }

  expect(player.availability, message).toBe("available");
  expect(player.development.stage, message).toBe(
    developmentStageForAge(player.age),
  );
  expect(player.teamId, message).toBeNull();
  expect(player.contractId, message).toBeNull();
}

function meanOf(players: Player[], key: keyof PlayerAttributes): number {
  const sum = players.reduce((acc, player) => acc + player.attributes[key], 0);
  return sum / players.length;
}

describe("player generation", () => {
  let samples: GeneratedSample[];

  beforeAll(() => {
    samples = Array.from({ length: SAMPLE_SIZE }, (_, index) => {
      const seed = index + 1;
      return {
        seed,
        player: generatePlayer(seed),
      };
    });
  });

  describe("determinism", () => {
    it("produces identical players for the same seed", () => {
      for (const seed of DETERMINISTIC_SEEDS) {
        const first = generatePlayer(seed);
        const second = generatePlayer(seed);
        expect(first, seedMessage(seed)).toEqual(second);
      }
    });

    it("is equivalent to generatePlayerWithRng(createSeededRng(seed))", () => {
      for (const seed of DETERMINISTIC_SEEDS) {
        const fromSeed = generatePlayer(seed);
        const fromRng = generatePlayerWithRng(createSeededRng(seed));
        expect(fromRng, seedMessage(seed)).toEqual(fromSeed);
      }
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

    it("does not depend on previous generatePlayer calls", () => {
      const seedA = 12345;
      const first = generatePlayer(seedA);
      generatePlayer(1);
      generatePlayer(42);
      const again = generatePlayer(seedA);
      expect(again).toEqual(first);
    });

    it("does not call Math.random or Date.now", () => {
      const randomSpy = vi.spyOn(Math, "random");
      const nowSpy = vi.spyOn(Date, "now");
      try {
        generatePlayer(12345);
        expect(randomSpy).not.toHaveBeenCalled();
        expect(nowSpy).not.toHaveBeenCalled();
      } finally {
        randomSpy.mockRestore();
        nowSpy.mockRestore();
      }
    });

    it("does not consume RNG for overridden position (repeatable with options)", () => {
      const options = { position: "PG" as const };
      const a = generatePlayer(77, options);
      const b = generatePlayer(77, options);
      expect(a).toEqual(b);
      expect(a.position).toBe("PG");
      expect(isArchetypeCompatible(a.archetype, "PG")).toBe(true);
    });
  });

  describe("validity", () => {
    it("produces valid players for the deterministic seed set", () => {
      for (const seed of DETERMINISTIC_SEEDS) {
        expectValidGeneratedPlayer(generatePlayer(seed), seed);
      }
    });

    it("produces valid players for the large sequential sample", { timeout: 60_000 }, () => {
      for (const sample of samples) {
        expectValidGeneratedPlayer(sample.player, sample.seed);
      }
    });
  });

  describe("distribution", () => {
    it("generates all valid positions", () => {
      const positions = new Set(samples.map((sample) => sample.player.position));
      expect(positions.size).toBeGreaterThan(1);
      expect(positions.size).toBe(PLAYER_POSITIONS.length);
      for (const position of PLAYER_POSITIONS) {
        expect(positions.has(position)).toBe(true);
      }
    });

    it("generates every catalog archetype", () => {
      expect(PLAYER_ARCHETYPES).toHaveLength(9);
      const archetypes = new Set(
        samples.map((sample) => sample.player.archetype),
      );
      expect(archetypes.size).toBe(PLAYER_ARCHETYPES.length);
      for (const archetype of PLAYER_ARCHETYPES) {
        expect(archetypes.has(archetype)).toBe(true);
      }
    });

    it("varies age without clustering at a single bound", () => {
      const ages = samples.map((sample) => sample.player.age);
      const uniqueAges = new Set(ages);
      expect(uniqueAges.size).toBeGreaterThan(1);

      const minBoundShare =
        ages.filter((age) => age === MIN_PLAYER_AGE).length / samples.length;
      const maxBoundShare =
        ages.filter((age) => age === MAX_PLAYER_AGE).length / samples.length;
      expect(minBoundShare).toBeLessThanOrEqual(0.5);
      expect(maxBoundShare).toBeLessThanOrEqual(0.5);
    });

    it("varies each personality trait", () => {
      for (const key of PERSONALITY_KEYS) {
        const values = new Set(
          samples.map((sample) => sample.player.personality[key]),
        );
        expect(values.size, key).toBeGreaterThan(1);
      }
    });

    it("varies personality for the same position and archetype", () => {
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

    it("varies each attribute", () => {
      for (const key of PLAYER_ATTRIBUTE_KEYS) {
        const values = samples.map((sample) => sample.player.attributes[key]);
        const unique = new Set(values);
        const min = Math.min(...values);
        const max = Math.max(...values);
        expect(unique.size, key).toBeGreaterThan(1);
        expect(min, key).not.toBe(max);
      }
    });

    it("varies potential overall", () => {
      const values = new Set(
        samples.map((sample) => sample.player.potential.overall),
      );
      expect(values.size).toBeGreaterThan(1);
    });

    it("varies first and last names", () => {
      const firstNames = new Set(
        samples.map((sample) => sample.player.firstName),
      );
      const lastNames = new Set(samples.map((sample) => sample.player.lastName));
      expect(firstNames.size).toBeGreaterThan(1);
      expect(lastNames.size).toBeGreaterThan(1);
    });

    it("assigns distinct ids for sequential seeds 1 through SAMPLE_SIZE", () => {
      const ids = new Set(samples.map((sample) => sample.player.id));
      expect(ids.size).toBe(SAMPLE_SIZE);
    });
  });

  describe("invariants", () => {
    it("respects forced compatible position and archetype", () => {
      const seed = 55;
      const player = generatePlayer(seed, {
        position: "PG",
        archetype: "floor_general",
      });
      expect(player.position).toBe("PG");
      expect(player.archetype).toBe("floor_general");
      expectValidGeneratedPlayer(player, seed);
    });

    it("rejects an incompatible forced archetype", () => {
      expect(isArchetypeCompatible("floor_general", "C")).toBe(false);
      expect(() =>
        generatePlayer(55, {
          position: "C",
          archetype: "floor_general",
        }),
      ).toThrow(/incompatible/i);
    });

    it("never generates an incompatible position and archetype pair", () => {
      for (const sample of samples) {
        expect(
          isArchetypeCompatible(
            sample.player.archetype,
            sample.player.position,
          ),
          seedMessage(sample.seed),
        ).toBe(true);
      }
    });

    it("keeps height and weight inside the position body envelope", () => {
      for (const sample of samples) {
        const { player, seed } = sample;
        const body = POSITION_BODY_RANGES[player.position];
        expect(player.heightInches, seedMessage(seed)).toBeGreaterThanOrEqual(
          body.minHeightInches,
        );
        expect(player.heightInches, seedMessage(seed)).toBeLessThanOrEqual(
          body.maxHeightInches,
        );
        expect(player.weightPounds, seedMessage(seed)).toBeGreaterThanOrEqual(
          body.minWeightPounds,
        );
        expect(player.weightPounds, seedMessage(seed)).toBeLessThanOrEqual(
          body.maxWeightPounds,
        );
      }
    });

    it("never generates potential below current overall", () => {
      for (const sample of samples) {
        const overall = calculatePlayerOverall(
          sample.player.position,
          sample.player.attributes,
        );
        expect(
          sample.player.potential.overall,
          seedMessage(sample.seed),
        ).toBeGreaterThanOrEqual(overall);
      }
    });

    it("keeps development stage aligned with age", () => {
      for (const sample of samples) {
        expect(
          sample.player.development.stage,
          seedMessage(sample.seed),
        ).toBe(developmentStageForAge(sample.player.age));
      }
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
});

describe("generateRosters with player generation engine", () => {
  it("fills each team with ten players in fixed position slots", () => {
    const state = createInitialGameState({
    saveId: "save_roster_slots",
      rngSeed: 21,
      nowIso: "2026-08-13T12:00:00.000Z",
    settings: CBL_GAME_SETTINGS,
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
        const overall = calculatePlayerOverall(
          player.position,
          player.attributes,
        );
        expect(player.id.length).toBeGreaterThan(0);
        expect(player.firstName.trim().length).toBeGreaterThan(0);
        expect(player.lastName.trim().length).toBeGreaterThan(0);
        expect(isPlayerNationality(player.nationality)).toBe(true);
        expect(Number.isInteger(player.age)).toBe(true);
        expect(player.age).toBeGreaterThanOrEqual(MIN_PLAYER_AGE);
        expect(player.age).toBeLessThanOrEqual(MAX_PLAYER_AGE);
        expect(PLAYER_POSITIONS).toContain(player.position);
        expect(isPlayerArchetype(player.archetype)).toBe(true);
        expect(
          isArchetypeCompatible(player.archetype, player.position),
        ).toBe(true);
        expect(player.potential.overall).toBeGreaterThanOrEqual(overall);
        expect(player.availability).toBe("available");
        expect(player.development.stage).toBe(
          developmentStageForAge(player.age),
        );
      }
    }
  });
});
