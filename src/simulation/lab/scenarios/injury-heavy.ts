import type { Player } from "@/domain/entities/player";
import type { Rng } from "@/domain/rng";
import { generateValidationRosters } from "@/simulation/validation/run-validation";

/**
 * Scenario: injury-heavy
 * Base generator: generateValidationRosters
 * Transformation: none at roster generation. After each Lab game, rotation-on
 * GameState is passed through processPostGameInjuryExposures (post-game only;
 * mid-game injury is not wired in production).
 * RNG stream: deriveSeed(seed, "injury-heavy")
 * Determinism: same seed ⇒ identical player ids and attributes
 */
export function buildInjuryHeavyRosters(rng: Rng): {
  homePlayers: Player[];
  awayPlayers: Player[];
} {
  return generateValidationRosters(rng);
}

export const INJURY_HEAVY_SCENARIO_ID = "injury-heavy";
