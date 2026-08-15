import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

/**
 * Extensible interest factors. v1 leaves all contributions at 0;
 * future systems may populate Money, Team Quality, etc. independently.
 */
export type PlayerInterestFactor =
  | "money"
  | "teamQuality"
  | "playingTime"
  | "location"
  | "championshipOpportunity"
  | "personality";

export const PLAYER_INTEREST_FACTORS: readonly PlayerInterestFactor[] = [
  "money",
  "teamQuality",
  "playingTime",
  "location",
  "championshipOpportunity",
  "personality",
];

export type PlayerInterest = {
  playerId: PlayerId;
  teamId: TeamId;
  score: number;
  interested: boolean;
  factors: Record<PlayerInterestFactor, number>;
};

/**
 * Pluggable interest evaluation boundary.
 * Systems accept an optional evaluator; defaults use the v1 baseline.
 */
export type EvaluatePlayerInterest = (
  playerId: PlayerId,
  teamId: TeamId,
  state: GameState,
) => PlayerInterest;

export function emptyInterestFactors(): Record<PlayerInterestFactor, number> {
  return {
    money: 0,
    teamQuality: 0,
    playingTime: 0,
    location: 0,
    championshipOpportunity: 0,
    personality: 0,
  };
}
