import { describe, expect, it } from "vitest";
import {
  PLAYER_ATTRIBUTE_KEYS,
  RATING_MAX,
  RATING_MIN,
  type Player,
  type PlayerAttributes,
} from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { createSeededRng } from "@/domain/rng";
import { developPlayer } from "@/systems/player-development";
import { developmentStageForAge } from "@/systems/player-generation-config";
import {
  createPlayer,
  createPrimeDevelopmentPlayer,
  createVeteranPlayer,
  createYoungHighPotentialPlayer,
  createYoungNearPotentialPlayer,
  uniformPlayerAttributes,
} from "../factories/player";

const SAMPLE_COUNT = 80;
const PHYSICAL_KEYS = [
  "speed",
  "strength",
  "athleticism",
  "stamina",
] as const satisfies readonly (keyof PlayerAttributes)[];
const MENTAL_KEYS = [
  "basketballIq",
  "offensiveIq",
  "defensiveIq",
  "consistency",
] as const satisfies readonly (keyof PlayerAttributes)[];

function overallOf(player: Player): number {
  return calculatePlayerOverall(player.position, player.attributes);
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleDeveloped(
  player: Player,
  startSeed: number,
  count: number = SAMPLE_COUNT,
): Player[] {
  const results: Player[] = [];
  for (let index = 0; index < count; index += 1) {
    results.push(developPlayer(player, createSeededRng(startSeed + index)));
  }
  return results;
}

function expectValidDevelopedPlayer(player: Player): void {
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    expect(Number.isInteger(player.attributes[key])).toBe(true);
    expect(player.attributes[key]).toBeGreaterThanOrEqual(RATING_MIN);
    expect(player.attributes[key]).toBeLessThanOrEqual(RATING_MAX);
  }
  expect(overallOf(player)).toBeLessThanOrEqual(player.potential.overall);
}

describe("developPlayer", () => {
  it("is deterministic for the same player and seed", () => {
    const player = createYoungHighPotentialPlayer();
    const resultA = developPlayer(player, createSeededRng(12345));
    const resultB = developPlayer(player, createSeededRng(12345));
    expect(resultA).toEqual(resultB);
  });

  it("does not mutate the original player", () => {
    const player = createYoungHighPotentialPlayer();
    const snapshot = structuredClone(player);
    developPlayer(player, createSeededRng(12345));
    expect(player).toEqual(snapshot);
  });

  it("does not increment age", () => {
    const player = createYoungHighPotentialPlayer({ age: 21 });
    const developed = developPlayer(player, createSeededRng(7));
    expect(developed.age).toBe(21);
  });

  it("keeps current overall at or below potential", () => {
    const players = [
      createYoungHighPotentialPlayer(),
      createYoungNearPotentialPlayer(),
      createPrimeDevelopmentPlayer(),
      createVeteranPlayer(),
    ];
    for (const player of players) {
      for (const developed of sampleDeveloped(player, 200)) {
        expect(overallOf(developed)).toBeLessThanOrEqual(
          developed.potential.overall,
        );
      }
    }
  });

  it("keeps every attribute within 1–99", () => {
    const player = createYoungHighPotentialPlayer();
    for (const developed of sampleDeveloped(player, 300)) {
      expectValidDevelopedPlayer(developed);
    }
  });

  it("does not change potential", () => {
    const player = createYoungHighPotentialPlayer();
    const developed = developPlayer(player, createSeededRng(11));
    expect(developed.potential).toEqual(player.potential);
  });

  it("returns a new valid player via createPlayer", () => {
    const player = createYoungHighPotentialPlayer();
    const developed = developPlayer(player, createSeededRng(13));
    expectValidDevelopedPlayer(developed);
    expect(developed).not.toBe(player);
    expect(developed.attributes).not.toBe(player.attributes);
  });

  it("gives young high-potential players a positive overall trend", () => {
    const player = createYoungHighPotentialPlayer();
    const before = overallOf(player);
    const changes = sampleDeveloped(player, 400).map(
      (developed) => overallOf(developed) - before,
    );
    expect(mean(changes)).toBeGreaterThan(0.3);
  });

  it("gives near-potential players substantially less upside than high-gap prospects", () => {
    const prospect = createYoungHighPotentialPlayer();
    const nearCeiling = createYoungNearPotentialPlayer();
    const prospectGain = mean(
      sampleDeveloped(prospect, 500).map(
        (developed) => overallOf(developed) - overallOf(prospect),
      ),
    );
    const nearGain = mean(
      sampleDeveloped(nearCeiling, 500).map(
        (developed) => overallOf(developed) - overallOf(nearCeiling),
      ),
    );
    expect(prospectGain).toBeGreaterThan(nearGain + 0.4);
  });

  it("does not raise an at-potential player above the ceiling", () => {
    const player = createPlayer({
      age: 21,
      attributes: uniformPlayerAttributes(75),
      potential: { overall: 75 },
      development: { stage: "developing" },
    });
    expect(overallOf(player)).toBe(75);
    for (const developed of sampleDeveloped(player, 600)) {
      expect(overallOf(developed)).toBeLessThanOrEqual(75);
      expect(developed.potential.overall).toBe(75);
    }
  });

  it("keeps prime players relatively stable", () => {
    const player = createPrimeDevelopmentPlayer();
    const before = overallOf(player);
    const absChanges = sampleDeveloped(player, 700).map((developed) =>
      Math.abs(overallOf(developed) - before),
    );
    expect(mean(absChanges)).toBeLessThan(1.5);
  });

  it("trends veterans toward gradual overall decline", () => {
    const player = createVeteranPlayer();
    const before = overallOf(player);
    const changes = sampleDeveloped(player, 800).map(
      (developed) => overallOf(developed) - before,
    );
    expect(mean(changes)).toBeLessThan(0);
  });

  it("gives high work ethic a modest development advantage", () => {
    const highWorkEthic = createYoungHighPotentialPlayer({
      attributes: uniformPlayerAttributes(68),
      potential: { overall: 85 },
      personality: { workEthic: 90 },
    });
    const lowWorkEthic = createYoungHighPotentialPlayer({
      attributes: uniformPlayerAttributes(68),
      potential: { overall: 85 },
      personality: { workEthic: 20 },
    });
    const highGain = mean(
      sampleDeveloped(highWorkEthic, 900).map(
        (developed) => overallOf(developed) - overallOf(highWorkEthic),
      ),
    );
    const lowGain = mean(
      sampleDeveloped(lowWorkEthic, 900).map(
        (developed) => overallOf(developed) - overallOf(lowWorkEthic),
      ),
    );
    expect(highGain).toBeGreaterThan(lowGain);
  });

  it("declines physical attributes more than mental attributes for veterans", () => {
    const player = createVeteranPlayer();
    const physicalChanges: number[] = [];
    const mentalChanges: number[] = [];
    for (const developed of sampleDeveloped(player, 1000)) {
      for (const key of PHYSICAL_KEYS) {
        physicalChanges.push(
          developed.attributes[key] - player.attributes[key],
        );
      }
      for (const key of MENTAL_KEYS) {
        mentalChanges.push(developed.attributes[key] - player.attributes[key]);
      }
    }
    expect(mean(physicalChanges)).toBeLessThan(mean(mentalChanges));
  });

  it("recalculates development stage from age", () => {
    expect(developmentStageForAge(24)).toBe("developing");
    expect(developmentStageForAge(25)).toBe("prime");
    expect(developmentStageForAge(30)).toBe("prime");
    expect(developmentStageForAge(31)).toBe("declining");

    const stale = createPlayer({
      age: 31,
      attributes: uniformPlayerAttributes(80),
      potential: { overall: 80 },
      development: { stage: "developing" },
    });
    const developed = developPlayer(stale, createSeededRng(42));
    expect(developed.development.stage).toBe("declining");
  });
});
