import {
  RATING_MAX,
  RATING_MIN,
  type Player,
} from "@/domain/entities/player";
import type { Rng } from "@/domain/rng";
import { PASS_RESOLUTION_CONFIG } from "@/systems/pass-resolution-config";

export type ResolvePassInput = {
  passer: Player;
  /**
   * Present because passing is a passer → receiver interaction.
   * v1 does not read receiver ratings; a future model may.
   */
  receiver: Player;
  /**
   * Already-computed pressure on the passer, integer 1–99.
   * Callers may pass perimeterDefense through in v1.
   * This resolver must not derive pressure from a defender.
   */
  defensivePressure: number;
};

export type PassProbabilities = {
  passSuccessProbability: number;
  /** Derived exactly as `1 - passSuccessProbability`. Never clamped independently. */
  turnoverProbability: number;
  /**
   * Public name for P(assist opportunity | completed pass).
   * Not a credited box-score assist.
   */
  assistProbability: number;
};

export type PassResolution = {
  outcome: "complete" | "turnover";
  /**
   * Intermediate precursor for future possession/game logic.
   * True only when outcome is "complete" and the assist-opportunity roll succeeds.
   * This resolver never updates player or game statistics.
   */
  assistOpportunity: boolean;
  passSuccessProbability: number;
  turnoverProbability: number;
  assistProbability: number;
};

/**
 * Pure pass and assist-opportunity probabilities. Does not consume RNG.
 *
 * Pass success is clamped first. Turnover is then derived as
 * `1 - passSuccessProbability` (no independent clamp or renormalization).
 *
 * `assistProbability` is P(assist opportunity | completed pass) and uses a
 * separate baseline/coefficient from pass success. v1 does not use receiver
 * ratings and does not inspect defensive ratings to derive pressure.
 */
export function calculatePassProbabilities(
  input: ResolvePassInput,
): PassProbabilities {
  validateResolvePassInput(input);

  const passingNormalized = input.passer.attributes.passing / RATING_MAX;
  const ballHandlingNormalized =
    input.passer.attributes.ballHandling / RATING_MAX;
  const pressureNormalized = input.defensivePressure / RATING_MAX;

  const unclampedPassSuccess =
    PASS_RESOLUTION_CONFIG.baselinePassSuccess +
    passingNormalized * PASS_RESOLUTION_CONFIG.passingImpact +
    ballHandlingNormalized * PASS_RESOLUTION_CONFIG.ballHandlingImpact -
    pressureNormalized * PASS_RESOLUTION_CONFIG.defensivePressureImpact;

  const passSuccessProbability = clamp(
    unclampedPassSuccess,
    PASS_RESOLUTION_CONFIG.minPassSuccess,
    PASS_RESOLUTION_CONFIG.maxPassSuccess,
  );
  const turnoverProbability = 1 - passSuccessProbability;

  const assistOpportunityProbability = clamp(
    PASS_RESOLUTION_CONFIG.baselineAssist +
      passingNormalized * PASS_RESOLUTION_CONFIG.assistPassingImpact,
    PASS_RESOLUTION_CONFIG.minAssist,
    PASS_RESOLUTION_CONFIG.maxAssist,
  );

  return {
    passSuccessProbability,
    turnoverProbability,
    assistProbability: assistOpportunityProbability,
  };
}

/**
 * Resolves a pass attempt: computes probabilities, then Bernoulli rolls.
 * Does not mutate input. Does not credit box-score assists.
 *
 * RNG call order:
 *   1. rng.chance(passSuccessProbability) — complete vs turnover
 *   2. rng.chance(assistProbability) — only when the pass completes
 *
 * A turnover never consumes the assist-opportunity roll.
 */
export function resolvePass(
  input: ResolvePassInput,
  rng: Rng,
): PassResolution {
  const probabilities = calculatePassProbabilities(input);
  const completed = rng.chance(probabilities.passSuccessProbability);

  if (!completed) {
    return {
      outcome: "turnover",
      assistOpportunity: false,
      ...probabilities,
    };
  }

  const assistOpportunity = rng.chance(probabilities.assistProbability);
  return {
    outcome: "complete",
    assistOpportunity,
    ...probabilities,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function validateResolvePassInput(input: ResolvePassInput): void {
  if (input.passer == null) {
    throw new Error("Pass resolution requires a passer.");
  }
  if (input.receiver == null) {
    throw new Error("Pass resolution requires a receiver.");
  }
  if (input.passer.id === input.receiver.id) {
    throw new Error("Pass passer and receiver must be different players.");
  }

  assertRating(input.passer.attributes.passing, "passer.passing");
  assertRating(input.passer.attributes.ballHandling, "passer.ballHandling");
  assertRating(input.defensivePressure, "defensivePressure");
}

function assertRating(value: number, field: string): void {
  if (
    !Number.isInteger(value) ||
    value < RATING_MIN ||
    value > RATING_MAX
  ) {
    throw new Error(
      `Pass ${field} must be an integer between ${RATING_MIN} and ${RATING_MAX}.`,
    );
  }
}
