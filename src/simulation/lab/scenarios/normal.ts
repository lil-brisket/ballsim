import type { Player } from "@/domain/entities/player";
import type { Rng } from "@/domain/rng";
import { generateValidationRosters } from "@/simulation/validation/run-validation";

/**
 * Scenario: normal
 * Base generator: generateValidationRosters (src/simulation/validation/run-validation.ts)
 * Transformation: none
 * RNG stream: deriveSeed(seed, "{scenarioId}:roster") for rosters;
 * each game uses deriveSeed(seed, "{scenarioId}:game:{n}")
 * Determinism: same seed ⇒ identical player ids and attributes
 */
export function buildNormalRosters(
  rng: Rng,
  rosterSize?: number,
): { homePlayers: Player[]; awayPlayers: Player[] } {
  return generateValidationRosters(rng, rosterSize);
}

export const NORMAL_SCENARIO_ID = "normal";
