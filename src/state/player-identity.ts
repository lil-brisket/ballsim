import type { PlayerPosition } from "@/domain/entities/player";
import type { GameState } from "@/state/game-state";

export type PlayerIdentity = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  position: PlayerPosition;
  jerseyNumber: number;
  retired: boolean;
};

/**
 * Who a player id is: the live row, else the retired-player archive (the
 * row of a long-retired player is not in the per-action save). Null for an
 * unknown id.
 */
export function getPlayerIdentity(
  state: GameState,
  playerId: string,
): PlayerIdentity | null {
  const source =
    state.world.players[playerId] ?? state.world.retiredPlayers[playerId];
  if (!source) return null;
  return {
    id: playerId,
    firstName: source.firstName,
    lastName: source.lastName,
    displayName: `${source.firstName} ${source.lastName}`,
    position: source.position,
    jerseyNumber: source.jerseyNumber,
    retired:
      state.world.players[playerId] === undefined ||
      state.world.players[playerId]!.retired === true,
  };
}
