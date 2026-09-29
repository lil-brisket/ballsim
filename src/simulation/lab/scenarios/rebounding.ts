import type { Player } from "@/domain/entities/player";
import { RATING_MAX } from "@/domain/entities/player";
import type { Rng } from "@/domain/rng";
import { asTeamId } from "@/domain/ids";
import { generateValidationRosters } from "@/simulation/validation/run-validation";
import { clonePlayerWithAttributeClamps } from "@/simulation/lab/scenarios/clamp-attributes";

const REBOUND_KEYS = ["rebounding"] as const;

/**
 * Scenario: rebounding
 * Base generator: generateValidationRosters
 * Transformation: clamp rebounding to [90, RATING_MAX]
 * RNG stream: deriveSeed(seed, "rebounding")
 * Determinism: same seed ⇒ identical player ids and attributes
 */
export function buildReboundingRosters(rng: Rng): {
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
        REBOUND_KEYS,
        90,
        RATING_MAX,
        `reb_home_${index}`,
        homeId,
      ),
    ),
    awayPlayers: awayPlayers.map((player, index) =>
      clonePlayerWithAttributeClamps(
        player,
        REBOUND_KEYS,
        90,
        RATING_MAX,
        `reb_away_${index}`,
        awayId,
      ),
    ),
  };
}

export const REBOUNDING_SCENARIO_ID = "rebounding";
