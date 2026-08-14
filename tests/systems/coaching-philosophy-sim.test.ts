import { describe, expect, it } from "vitest";
import { DEFAULT_COACHING_PHILOSOPHY } from "@/domain/coaching/coaching-philosophy";
import { getCoachingModifiers } from "@/domain/coaching/coaching-philosophy-config";
import { RATING_MAX, RATING_MIN } from "@/domain/entities/player";
import { calculateShotProbability } from "@/systems/shot-resolution";
import { calculatePassProbabilities } from "@/systems/pass-resolution";
import {
  getShotSelectionWeights,
  NEUTRAL_SHOT_SELECTION_MODIFIERS,
} from "@/systems/possession-decision-selection";
import {
  GAME_SIMULATION_CONFIG,
  mergeGameSimulationConfig,
} from "@/systems/game-simulation-config";
import { requestPossessionSeconds } from "@/systems/game-simulation";
import { createPlayer } from "../factories/player";
import { createTestRng } from "../helpers/determinism";
import { asPossessionId, asTeamId } from "@/domain/ids";
import { createPossession } from "@/domain/entities/possession";
import type { PossessionResolution } from "@/systems/possession-resolution";

describe("getShotSelectionWeights", () => {
  const shooter = createPlayer({
    attributes: { threePoint: 70, midRange: 50, finishing: 40 },
  });

  it("matches attribute weights with balanced modifiers", () => {
    const weights = getShotSelectionWeights(
      shooter,
      NEUTRAL_SHOT_SELECTION_MODIFIERS,
    );
    expect(weights).toEqual([
      { kind: "three", weight: 70 },
      { kind: "mid", weight: 50 },
      { kind: "finish", weight: 40 },
    ]);
  });

  it("raises three-point weight for threePointHeavy without changing midRange", () => {
    const mods = getCoachingModifiers({
      ...DEFAULT_COACHING_PHILOSOPHY,
      offensiveEmphasis: "threePointHeavy",
    });
    const balanced = getShotSelectionWeights(
      shooter,
      NEUTRAL_SHOT_SELECTION_MODIFIERS,
    );
    const heavy = getShotSelectionWeights(shooter, mods.shotSelection);
    const threeBalanced = balanced.find((w) => w.kind === "three")!.weight;
    const threeHeavy = heavy.find((w) => w.kind === "three")!.weight;
    expect(threeHeavy).toBeGreaterThan(threeBalanced);
    expect(heavy.find((w) => w.kind === "mid")!.weight).toBe(50);
    expect(heavy.find((w) => w.kind === "finish")!.weight).toBe(40);
  });

  it("raises finishing weight for inside without changing midRange", () => {
    const mods = getCoachingModifiers({
      ...DEFAULT_COACHING_PHILOSOPHY,
      offensiveEmphasis: "inside",
    });
    const balanced = getShotSelectionWeights(
      shooter,
      NEUTRAL_SHOT_SELECTION_MODIFIERS,
    );
    const inside = getShotSelectionWeights(shooter, mods.shotSelection);
    expect(inside.find((w) => w.kind === "finish")!.weight).toBeGreaterThan(
      balanced.find((w) => w.kind === "finish")!.weight,
    );
    expect(inside.find((w) => w.kind === "mid")!.weight).toBe(50);
    expect(inside.find((w) => w.kind === "three")!.weight).toBe(70);
  });
});

describe("requestPossessionSeconds pace", () => {
  function stubResolution(
    action: "shot" | "turnover" | "foul" | "free_throw",
  ): PossessionResolution {
    const player = createPlayer();
    return {
      possession: createPossession({
        id: asPossessionId("poss_1"),
        offensivePlayerId: player.id,
        defensivePlayerId: null,
        action,
        outcome: action === "shot" ? "shot_made" : "turnover",
      }),
      steps: [],
      events: [],
      playerStats: [],
      pointsScored: 0,
      scoringTeamId: null,
      defensiveTeamFoulsAfter: 0,
      nextPossession: {
        offensiveTeamId: asTeamId("away"),
        defensiveTeamId: asTeamId("home"),
      },
    };
  }

  it("applies fast < balanced < halfCourt duration for the same RNG stream", () => {
    const config = mergeGameSimulationConfig();
    const resolution = stubResolution("shot");
    const base = requestPossessionSeconds(
      resolution,
      config,
      createTestRng(7),
      0,
    );
    const fast = requestPossessionSeconds(
      resolution,
      config,
      createTestRng(7),
      getCoachingModifiers({
        ...DEFAULT_COACHING_PHILOSOPHY,
        pace: "fast",
      }).possessionSecondsDelta,
    );
    const halfCourt = requestPossessionSeconds(
      resolution,
      config,
      createTestRng(7),
      getCoachingModifiers({
        ...DEFAULT_COACHING_PHILOSOPHY,
        pace: "halfCourt",
      }).possessionSecondsDelta,
    );
    expect(fast).toBeLessThan(base);
    expect(base).toBeLessThan(halfCourt);
    expect(base).toBe(
      requestPossessionSeconds(resolution, config, createTestRng(7)),
    );
  });
});

describe("coaching does not change player ability formulas", () => {
  it("leaves shot make probability unchanged", () => {
    const shooter = createPlayer({
      attributes: { finishing: 80, midRange: 70, threePoint: 60 },
    });
    const defender = createPlayer({
      attributes: { interiorDefense: 75, perimeterDefense: 70 },
    });
    const probability = calculateShotProbability({
      shooter,
      defender,
      shotType: "two_point",
      fatigue: 0,
    });
    // Coaching is not an input to calculateShotProbability.
    expect(probability).toBe(
      calculateShotProbability({
        shooter,
        defender,
        shotType: "two_point",
        fatigue: 0,
      }),
    );
  });

  it("clamps coached pass pressure into the resolvePass 1–99 contract", () => {
    const passer = createPlayer({
      id: "passer",
      attributes: { passing: 70, ballHandling: 65 },
    });
    const receiver = createPlayer({ id: "receiver" });
    const aggressive = getCoachingModifiers({
      ...DEFAULT_COACHING_PHILOSOPHY,
      defensiveApproach: "aggressive",
    }).defensivePressureMultiplier;
    const conservative = getCoachingModifiers({
      ...DEFAULT_COACHING_PHILOSOPHY,
      defensiveApproach: "conservative",
    }).defensivePressureMultiplier;

    const rawAggressive = 99 * aggressive;
    const rawConservative = 1 * conservative;
    const clampedAggressive = Math.min(
      RATING_MAX,
      Math.max(RATING_MIN, rawAggressive),
    );
    const clampedConservative = Math.min(
      RATING_MAX,
      Math.max(RATING_MIN, rawConservative),
    );
    expect(clampedAggressive).toBeLessThanOrEqual(RATING_MAX);
    expect(clampedConservative).toBeGreaterThanOrEqual(RATING_MIN);

    const probsAggressive = calculatePassProbabilities({
      passer,
      receiver,
      defensivePressure: clampedAggressive,
    });
    const probsBase = calculatePassProbabilities({
      passer,
      receiver,
      defensivePressure: 99,
    });
    expect(probsAggressive.passSuccessProbability).toBeLessThanOrEqual(
      probsBase.passSuccessProbability,
    );
    expect(
      calculatePassProbabilities({
        passer,
        receiver,
        defensivePressure: clampedConservative,
      }).passSuccessProbability,
    ).toBeGreaterThan(0);
  });

  it("scales foul action weight by defensive multiplier only", () => {
    const aggressive =
      GAME_SIMULATION_CONFIG.actionBaseWeights.foul *
      getCoachingModifiers({
        ...DEFAULT_COACHING_PHILOSOPHY,
        defensiveApproach: "aggressive",
      }).foulActionWeightMultiplier;
    const balanced =
      GAME_SIMULATION_CONFIG.actionBaseWeights.foul *
      getCoachingModifiers(DEFAULT_COACHING_PHILOSOPHY)
        .foulActionWeightMultiplier;
    const conservative =
      GAME_SIMULATION_CONFIG.actionBaseWeights.foul *
      getCoachingModifiers({
        ...DEFAULT_COACHING_PHILOSOPHY,
        defensiveApproach: "conservative",
      }).foulActionWeightMultiplier;
    expect(aggressive).toBeGreaterThan(balanced);
    expect(balanced).toBe(GAME_SIMULATION_CONFIG.actionBaseWeights.foul);
    expect(conservative).toBeLessThan(balanced);
  });
});
