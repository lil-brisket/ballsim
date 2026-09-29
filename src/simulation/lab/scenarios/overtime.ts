import type { Player } from "@/domain/entities/player";
import type { Rng } from "@/domain/rng";
import { generateValidationRosters } from "@/simulation/validation/run-validation";

/**
 * Scenario: overtime
 * Base generator: generateValidationRosters (same as normal)
 * Transformation: none. Relies on natural OT; Lab emits LAB_OT_PERIODS_HIGH
 * WARNING when overtimePeriodCount > 4. Production engine stays uncapped.
 * RNG stream: deriveSeed(seed, "overtime")
 * Determinism: same seed ⇒ identical player ids and attributes
 */
export function buildOvertimeRosters(rng: Rng): {
  homePlayers: Player[];
  awayPlayers: Player[];
} {
  return generateValidationRosters(rng);
}

export const OVERTIME_SCENARIO_ID = "overtime";
