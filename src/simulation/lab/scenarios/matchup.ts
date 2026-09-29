import type { Player } from "@/domain/entities/player";
import type { Rng } from "@/domain/rng";
import { asTeamId } from "@/domain/ids";
import { generateValidationRosters } from "@/simulation/validation/run-validation";
import { buildMatchupRosters } from "@/simulation/validation/matchup-rosters";

/**
 * Scenario: matchup-90-40
 * Base generator: generateValidationRosters
 * Transformation: existing buildMatchupRosters (offense keys 90 vs 40)
 * RNG stream: deriveSeed(seed, "matchup-90-40:roster") for rosters
 * Determinism: same seed ⇒ identical player ids and attributes
 *
 * Lab games use the strong-offense vs weak-offense pair.
 */
export function buildMatchupScenarioRosters(rng: Rng): {
  homePlayers: Player[];
  awayPlayers: Player[];
} {
  const { homePlayers } = generateValidationRosters(rng);
  const matchups = buildMatchupRosters(
    homePlayers,
    asTeamId("team_validation_home"),
    asTeamId("team_validation_away"),
  );
  return {
    homePlayers: matchups.strongOffense,
    awayPlayers: matchups.weakOffense,
  };
}

export const MATCHUP_SCENARIO_ID = "matchup-90-40";
