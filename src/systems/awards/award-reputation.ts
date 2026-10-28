import type { AwardDefinitionId, AwardResult } from "@/domain/entities/awards";
import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  AWARD_REPUTATION_CONFIG,
  seasonLengthFactor,
} from "@/systems/awards/awards-config";

/**
 * Award-based reputation / expectation bonus for free agency.
 * Does NOT modify OVR, potential, attributes, or projected performance.
 * Year-end awards count in proportion to the length of the season they were
 * won over (see seasonLengthFactor), read from the winner's stored season
 * record, so a later change of schedule length does not re-weight them;
 * monthly awards count in full.
 */
/**
 * Regular-season games in the season an award was won: the winner's team
 * record stored on the result, else today's schedule length.
 */
function seasonGamesOf(result: AwardResult, state: GameState): number {
  const record = result.context?.statSnapshot?.teamRecord;
  const games = record ? record.wins + record.losses : 0;
  return games > 0 ? games : state.settings.regularSeason.gamesPerTeam;
}

export function computeAwardReputationBonus(
  playerId: PlayerId,
  state: GameState,
): number {
  const currentYear = state.competition.season.year;
  let bonus = 0;

  for (const result of Object.values(state.business.awards.results)) {
    if (result.winner.subjectId !== playerId) continue;
    if (result.winner.subjectType !== "player") continue;

    const weight =
      AWARD_REPUTATION_CONFIG.weights[
        result.awardId as keyof typeof AWARD_REPUTATION_CONFIG.weights
      ] ?? 0;
    if (weight <= 0) continue;
    const scaledWeight =
      result.cadence === "yearly"
        ? weight * seasonLengthFactor(seasonGamesOf(result, state))
        : weight;

    const seasonsAgo = Math.max(0, currentYear - result.seasonYear);
    const decayed =
      scaledWeight * Math.pow(AWARD_REPUTATION_CONFIG.seasonDecay, seasonsAgo);
    bonus += decayed;
  }

  return Math.min(AWARD_REPUTATION_CONFIG.maxBonus, bonus);
}

export function awardIdsForPlayer(
  playerId: PlayerId,
  state: GameState,
): AwardDefinitionId[] {
  return Object.values(state.business.awards.results)
    .filter(
      (result) =>
        result.winner.subjectType === "player" &&
        result.winner.subjectId === playerId,
    )
    .map((result) => result.awardId);
}
