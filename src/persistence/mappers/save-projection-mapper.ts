import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";

/**
 * Query-oriented Team row for a save. Domain Team remains in GameState JSON.
 */
export type SaveTeamProjection = {
  teamId: string;
  name: string;
  city: string;
  abbreviation: string;
  conferenceId: string;
  divisionId: string;
  arenaId: string;
  reputation: number;
};

/**
 * Query-oriented Player row for a save. Domain Player remains in GameState JSON.
 */
export type SavePlayerProjection = {
  playerId: string;
  teamId: string | null;
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  overall: number;
  potentialOverall: number;
  availability: string;
  retired: boolean;
};

export type SaveProjections = {
  teams: SaveTeamProjection[];
  players: SavePlayerProjection[];
};

/**
 * Extract listing projections from authoritative GameState.
 * Sorted by domain id so writes are deterministic.
 */
export function projectSaveEntities(state: GameState): SaveProjections {
  const teams = Object.values(state.world.teams)
    .map((team) => ({
      teamId: team.id,
      name: team.name,
      city: team.city,
      abbreviation: team.abbreviation,
      conferenceId: team.conferenceId,
      divisionId: team.divisionId,
      arenaId: team.arenaId,
      reputation: team.reputation,
    }))
    .sort((a, b) => (a.teamId < b.teamId ? -1 : a.teamId > b.teamId ? 1 : 0));

  const players = Object.values(state.world.players)
    .map((player) => ({
      playerId: player.id,
      teamId: player.teamId,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      age: player.age,
      overall: calculatePlayerOverall(player.position, player.attributes),
      potentialOverall: player.potential.overall,
      availability: player.availability,
      retired: player.retired === true,
    }))
    .sort((a, b) =>
      a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0,
    );

  return { teams, players };
}
