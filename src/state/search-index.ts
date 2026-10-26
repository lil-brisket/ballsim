/**
 * Compact league index for the command palette: every active player (rostered
 * or free agent), the visible draft prospects and every team. Read-only; the
 * client filters it locally. Your active team's players sort first so they win
 * ties in the palette ranking.
 */

import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { toDraftBoardView } from "@/state/selectors";
import { listFreeAgents } from "@/systems/free-agency";

export type SearchIndexPlayer = {
  id: string;
  name: string;
  position: string;
  /** Team abbreviation, "FA" for a free agent or "Draft" for a prospect. */
  team: string;
  /** Null for draft prospects: their rating is hidden behind scouting. */
  overall: number | null;
  /** On the active owner team. */
  mine: boolean;
  /** A draft prospect (opens the Draft page, not the player drawer). */
  prospect: boolean;
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
  const myTeamId = getActiveOwnerTeamId(state);
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
      mine: player.teamId === myTeamId,
      prospect: false,
    });
  }
  const listed = new Set(players.map((player) => player.id));
  for (const prospect of toDraftBoardView(state)?.eligibleProspects ?? []) {
    if (listed.has(prospect.playerId)) continue;
    players.push({
      id: prospect.playerId,
      name: `${prospect.firstName} ${prospect.lastName}`,
      position: prospect.position,
      team: "Draft",
      overall: null,
      mine: false,
      prospect: true,
    });
  }
  players.sort(
    (a, b) =>
      Number(b.mine) - Number(a.mine) ||
      compare(a.name, b.name) ||
      compare(a.id, b.id),
  );

  const teams = Object.values(state.world.teams)
    .map((team) => ({
      id: team.id as string,
      name: `${team.city} ${team.name}`,
      abbreviation: team.abbreviation,
    }))
    .sort((a, b) => compare(a.name, b.name) || compare(a.id, b.id));

  return { players, teams };
}
