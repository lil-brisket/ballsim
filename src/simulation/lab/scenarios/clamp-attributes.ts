import {
  createPlayer,
  RATING_MAX,
  RATING_MIN,
  type Player,
  type PlayerAttributes,
} from "@/domain/entities/player";
import { asPlayerId, asTeamId, type TeamId } from "@/domain/ids";

export function clampRating(value: number): number {
  return Math.max(RATING_MIN, Math.min(RATING_MAX, Math.round(value)));
}

export function clonePlayerWithAttributeClamps(
  source: Player,
  keys: readonly (keyof PlayerAttributes)[],
  min: number,
  max: number,
  id: string,
  teamId: TeamId,
): Player {
  const attributes = { ...source.attributes };
  for (const key of keys) {
    attributes[key] = clampRating(
      Math.max(min, Math.min(max, attributes[key])),
    );
  }
  return createPlayer({
    ...source,
    id: asPlayerId(id),
    teamId: asTeamId(teamId),
    attributes,
    potential: { ...source.potential },
    personality: { ...source.personality },
    development: { ...source.development },
    physical: { ...source.physical },
    activeInjuries: source.activeInjuries.map((injury) => ({ ...injury })),
    injuryHistory: source.injuryHistory.map((entry) => ({ ...entry })),
  });
}
