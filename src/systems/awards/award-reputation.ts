import type { AwardDefinitionId } from "@/domain/entities/awards";
import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { AWARD_REPUTATION_CONFIG } from "@/systems/awards/awards-config";

/**
 * Award-based reputation / expectation bonus for free agency.
 * Does NOT modify OVR, potential, attributes, or projected performance.
 */
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

    const seasonsAgo = Math.max(0, currentYear - result.seasonYear);
    const decayed =
      weight * Math.pow(AWARD_REPUTATION_CONFIG.seasonDecay, seasonsAgo);
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
