/**
 * Franchise membership selectors for top-league vs Development League.
 *
 * Invariants:
 * - Player.teamId = franchise ownership
 * - Team.roster = top-league active roster only
 * - DL-assigned players have teamId set but are NOT on Team.roster
 */

import type { Player } from "@/domain/entities/player";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

export function isPlayerDlAssigned(
  player: Player | null | undefined,
): boolean {
  return player?.developmentLeague?.status === "assigned";
}

/** Top-league roster IDs — authoritative for roster size / top-league sim. */
export function getTopLeagueRosterPlayerIds(
  teamId: TeamId,
  state: GameState,
): PlayerId[] {
  const team = state.world.teams[teamId];
  if (team == null) {
    return [];
  }
  return [...team.roster];
}

/** Players assigned to this franchise's Development League squad. */
export function getDevelopmentLeagueRosterPlayerIds(
  teamId: TeamId,
  state: GameState,
): PlayerId[] {
  const ids: PlayerId[] = [];
  for (const player of Object.values(state.world.players)) {
    if (
      player.teamId === teamId &&
      player.developmentLeague?.status === "assigned" &&
      !player.retired
    ) {
      ids.push(player.id);
    }
  }
  return ids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * All players owned by the franchise (top-league roster + DL-assigned).
 * Never assume Team.roster alone covers franchise ownership.
 */
export function getFranchisePlayerIds(
  teamId: TeamId,
  state: GameState,
): PlayerId[] {
  const seen = new Set<string>();
  const ids: PlayerId[] = [];
  for (const playerId of getTopLeagueRosterPlayerIds(teamId, state)) {
    if (!seen.has(playerId)) {
      seen.add(playerId);
      ids.push(playerId);
    }
  }
  for (const playerId of getDevelopmentLeagueRosterPlayerIds(teamId, state)) {
    if (!seen.has(playerId)) {
      seen.add(playerId);
      ids.push(playerId);
    }
  }
  // Also include any player with teamId matching but neither list (edge/migration)
  for (const player of Object.values(state.world.players)) {
    if (
      player.teamId === teamId &&
      !player.retired &&
      !seen.has(player.id)
    ) {
      seen.add(player.id);
      ids.push(player.id);
    }
  }
  return ids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function getTopLeagueRosterPlayers(
  teamId: TeamId,
  state: GameState,
): Player[] {
  const players: Player[] = [];
  for (const playerId of getTopLeagueRosterPlayerIds(teamId, state)) {
    const player = state.world.players[playerId];
    if (player != null) {
      players.push(player);
    }
  }
  return players;
}

export function getDevelopmentLeagueRosterPlayers(
  teamId: TeamId,
  state: GameState,
): Player[] {
  const players: Player[] = [];
  for (const playerId of getDevelopmentLeagueRosterPlayerIds(teamId, state)) {
    const player = state.world.players[playerId];
    if (player != null) {
      players.push(player);
    }
  }
  return players;
}

export function getFranchisePlayers(
  teamId: TeamId,
  state: GameState,
): Player[] {
  const players: Player[] = [];
  for (const playerId of getFranchisePlayerIds(teamId, state)) {
    const player = state.world.players[playerId];
    if (player != null) {
      players.push(player);
    }
  }
  return players;
}

/** Top-league roster size (excludes DL-assigned players). */
export function getTopLeagueRosterSize(
  teamId: TeamId,
  state: GameState,
): number {
  return getTopLeagueRosterPlayerIds(teamId, state).length;
}
