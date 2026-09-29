import type { Player } from "@/domain/entities/player";
import { RATING_MAX } from "@/domain/entities/player";
import type { Rng } from "@/domain/rng";
import { asTeamId } from "@/domain/ids";
import { generateValidationRosters } from "@/simulation/validation/run-validation";
import { clonePlayerWithAttributeClamps } from "@/simulation/lab/scenarios/clamp-attributes";

const SHOOTING_KEYS = ["threePoint", "midRange"] as const;

/**
 * Scenario: shooting
 * Base generator: generateValidationRosters
 * Transformation: clamp threePoint and midRange to [90, RATING_MAX]
 * RNG stream: deriveSeed(seed, "shooting")
 * Determinism: same seed ⇒ identical player ids and attributes
 */
export function buildShootingRosters(rng: Rng): {
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
        SHOOTING_KEYS,
        90,
        RATING_MAX,
        `shoot_home_${index}`,
        homeId,
      ),
    ),
    awayPlayers: awayPlayers.map((player, index) =>
      clonePlayerWithAttributeClamps(
        player,
        SHOOTING_KEYS,
        90,
        RATING_MAX,
        `shoot_away_${index}`,
        awayId,
      ),
    ),
  };
}

export const SHOOTING_SCENARIO_ID = "shooting";
