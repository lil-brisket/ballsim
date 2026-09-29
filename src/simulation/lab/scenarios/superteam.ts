import type { Player } from "@/domain/entities/player";
import { RATING_MAX } from "@/domain/entities/player";
import type { Rng } from "@/domain/rng";
import { asTeamId } from "@/domain/ids";
import { generateValidationRosters } from "@/simulation/validation/run-validation";
import { clonePlayerWithAttributeClamps } from "@/simulation/lab/scenarios/clamp-attributes";

const SUPERTEAM_KEYS = [
  "finishing",
  "midRange",
  "threePoint",
  "offensiveIq",
] as const;

/**
 * Scenario: superteam
 * Base generator: generateValidationRosters
 * Transformation: clamp finishing, midRange, threePoint, offensiveIq to [95, RATING_MAX]
 * RNG stream: deriveSeed(seed, "superteam") when provided as the Lab rng
 * Determinism: same seed ⇒ identical player ids and attributes
 */
export function buildSuperteamRosters(rng: Rng): {
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
        SUPERTEAM_KEYS,
        95,
        RATING_MAX,
        `super_home_${index}`,
        homeId,
      ),
    ),
    awayPlayers: awayPlayers.map((player, index) =>
      clonePlayerWithAttributeClamps(
        player,
        SUPERTEAM_KEYS,
        95,
        RATING_MAX,
        `super_away_${index}`,
        awayId,
      ),
    ),
  };
}

export const SUPERTEAM_SCENARIO_ID = "superteam";
