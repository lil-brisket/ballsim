/**
 * Compact league index for the command palette: every active player (rostered
 * or free agent) and every team. Read-only; the client filters it locally.
 */

import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { listFreeAgents } from "@/systems/free-agency";

export type SearchIndexPlayer = {
  id: string;
  name: string;
  position: string;
  /** Team abbreviation, or "FA" for a free agent. */
  team: string;
  overall: number;
};

export type SearchIndexTeam = {
  id: string;
  /** "City Name". */
  name: string;
  abbreviation: string;
};

export type SearchIndex = {
  players: SearchIndexPlayer[];
  teams: SearchIndexTeam[];
};

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function toSearchIndex(state: GameState): SearchIndex {
  const freeAgents = new Set<string>(listFreeAgents(state).playerIds);
  const players: SearchIndexPlayer[] = [];
  for (const player of Object.values(state.world.players)) {
    if (player.retired === true) continue;
    let team: string;
    if (player.teamId) {
      const owner = state.world.teams[player.teamId];
      if (!owner) continue;
      team = owner.abbreviation;
    } else if (freeAgents.has(player.id)) {
      team = "FA";
    } else {
      continue;
    }
    players.push({
      id: player.id,
      name: `${player.firstName} ${player.lastName}`,
      position: player.position,
      team,
      overall: calculatePlayerOverall(player.position, player.attributes),
    });
  }
  players.sort((a, b) => compare(a.name, b.name) || compare(a.id, b.id));

  const teams = Object.values(state.world.teams)
    .map((team) => ({
      id: team.id as string,
      name: `${team.city} ${team.name}`,
      abbreviation: team.abbreviation,
    }))
    .sort((a, b) => compare(a.name, b.name) || compare(a.id, b.id));

  return { players, teams };
}
