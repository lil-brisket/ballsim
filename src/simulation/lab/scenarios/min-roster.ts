import type { Player } from "@/domain/entities/player";
import type { Rng } from "@/domain/rng";
import { generateValidationRosters } from "@/simulation/validation/run-validation";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";

/**
 * Scenario: min-roster
 * Base generator: generateValidationRosters(rng, TRADE_ROSTER_RULES.minRosterSize)
 * Transformation: none
 * RNG stream: deriveSeed(seed, "min-roster")
 * Determinism: same seed ⇒ identical player ids and attributes
 * Rotation: on (Lab default)
 */
export function buildMinRosterRosters(rng: Rng): {
  homePlayers: Player[];
  awayPlayers: Player[];
} {
  return generateValidationRosters(rng, TRADE_ROSTER_RULES.minRosterSize);
}

export const MIN_ROSTER_SCENARIO_ID = "min-roster";
