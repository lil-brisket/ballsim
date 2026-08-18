import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

/** Inclusive age ceiling for "young" roster metrics used by owner objectives. */
export const YOUNG_PLAYER_AGE_MAX = 24;

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

/** Mean overall of players aged {@link YOUNG_PLAYER_AGE_MAX} or younger. */
export function meanYoungRosterOverall(
  state: GameState,
  teamId: TeamId,
): number {
  const team = state.world.teams[teamId];
  if (!team || team.roster.length === 0) {
    return 0;
  }
  let total = 0;
  let count = 0;
  for (const playerId of team.roster) {
    const player = state.world.players[playerId];
    if (!player || player.age > YOUNG_PLAYER_AGE_MAX) {
      continue;
    }
    total += calculatePlayerOverall(player.position, player.attributes);
    count += 1;
  }
  return count === 0 ? 0 : total / count;
}

/** Share of roster that is young (0–100). */
export function youngRosterSharePct(state: GameState, teamId: TeamId): number {
  const team = state.world.teams[teamId];
  if (!team || team.roster.length === 0) {
    return 0;
  }
  let young = 0;
  let counted = 0;
  for (const playerId of team.roster) {
    const player = state.world.players[playerId];
    if (!player) {
      continue;
    }
    counted += 1;
    if (player.age <= YOUNG_PLAYER_AGE_MAX) {
      young += 1;
    }
  }
  return counted === 0 ? 0 : Math.round((young / counted) * 100);
}

/** Mean roster age; 0 if empty. */
export function meanRosterAge(state: GameState, teamId: TeamId): number {
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
    total += player.age;
    count += 1;
  }
  return count === 0 ? 0 : total / count;
}
