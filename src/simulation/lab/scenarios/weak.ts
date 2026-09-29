import type { Player } from "@/domain/entities/player";
import { RATING_MIN } from "@/domain/entities/player";
import type { Rng } from "@/domain/rng";
import { asTeamId } from "@/domain/ids";
import { generateValidationRosters } from "@/simulation/validation/run-validation";
import { clonePlayerWithAttributeClamps } from "@/simulation/lab/scenarios/clamp-attributes";

const WEAK_KEYS = [
  "finishing",
  "midRange",
  "threePoint",
  "offensiveIq",
] as const;

/**
 * Scenario: weak
 * Base generator: generateValidationRosters
 * Transformation: clamp finishing, midRange, threePoint, offensiveIq to [RATING_MIN, 25]
 * RNG stream: deriveSeed(seed, "weak")
 * Determinism: same seed ⇒ identical player ids and attributes
 */
export function buildWeakRosters(rng: Rng): {
  homePlayers: Player[];
  awayPlayers: Player[];
} {
  const { homePlayers, awayPlayers } = generateValidationRosters(rng);
  const homeId = asTeamId("team_validation_home");
  const awayId = asTeamId("team_validation_away");
  return {
    homePlayers: homePlayers.map((player, index) =>
      clonePlayerWithAttributeClamps(
        player,
        WEAK_KEYS,
        RATING_MIN,
        25,
        `weak_home_${index}`,
        homeId,
      ),
    ),
    awayPlayers: awayPlayers.map((player, index) =>
      clonePlayerWithAttributeClamps(
        player,
        WEAK_KEYS,
        RATING_MIN,
        25,
        `weak_away_${index}`,
        awayId,
      ),
    ),
  };
}

export const WEAK_SCENARIO_ID = "weak";
