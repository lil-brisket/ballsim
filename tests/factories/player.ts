import {
  asPlayerId,
  asTeamId,
  type PlayerId,
  type TeamId,
} from "@/domain/ids";
import type { Player, PlayerPosition, PlayerRatings } from "@/domain/entities/player";

export type CreatePlayerOverrides = {
  id?: PlayerId | string;
  teamId?: TeamId | string | null;
  firstName?: string;
  lastName?: string;
  position?: PlayerPosition;
  age?: number;
  ratings?: Partial<PlayerRatings>;
};

/**
 * Deterministic Player factory. Defaults are stable; pass overrides to customize.
 */
export function createPlayer(overrides: CreatePlayerOverrides = {}): Player {
  const defaultRatings: PlayerRatings = {
    overall: 70,
    offense: 68,
    defense: 72,
  };

  const teamId =
    overrides.teamId === undefined
      ? asTeamId("team_test")
      : overrides.teamId === null
        ? null
        : asTeamId(String(overrides.teamId));

  return {
    id: asPlayerId(overrides.id ?? "player_test"),
    teamId,
    firstName: overrides.firstName ?? "Alex",
    lastName: overrides.lastName ?? "Rivera",
    position: overrides.position ?? "PG",
    age: overrides.age ?? 24,
    ratings: {
      ...defaultRatings,
      ...overrides.ratings,
    },
  };
}
