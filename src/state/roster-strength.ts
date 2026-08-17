import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

/**
 * Mean roster overall for a team. Shared by owner objectives and the owner
 * dashboard — do not duplicate this calculation elsewhere.
 */
export function meanRosterOverall(state: GameState, teamId: TeamId): number {
  const team = state.world.teams[teamId];
  if (!team || team.roster.length === 0) {
    return 0;
  }
  let total = 0;
  let count = 0;
  for (const playerId of team.roster) {
    const player = state.world.players[playerId];
    if (!player) {
      continue;
    }
    total += calculatePlayerOverall(player.position, player.attributes);
    count += 1;
  }
  return count === 0 ? 0 : total / count;
}
