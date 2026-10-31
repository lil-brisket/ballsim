/**
 * A read-only roster for any team in the league, for scouting. Player info
 * (ratings, contract, availability) is public; nothing user-private (rotation
 * roles, trade block) is set on the rows.
 */

import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  toSheetPlayerView,
  type SheetPlayerView,
} from "@/state/roster-sheet-view";

export type TeamRosterPickerEntry = {
  teamId: string;
  label: string;
  href: string;
};

export type TeamRosterView = {
  teamId: string;
  city: string;
  name: string;
  abbreviation: string;
  record: { wins: number; losses: number };
  isUserTeam: boolean;
  players: SheetPlayerView[];
  teams: TeamRosterPickerEntry[];
};

export function toTeamRosterView(
  state: GameState,
  teamId: TeamId,
  saveId: string,
): TeamRosterView | null {
  const team = state.world.teams[teamId];
  if (!team) return null;
  const standing = state.competition.standings.byTeamId[teamId];

  const players: SheetPlayerView[] = [];
  for (const playerId of team.roster) {
    const row = toSheetPlayerView(state, playerId);
    if (row) players.push(row);
  }

  const teams = Object.values(state.world.teams)
    .sort(
      (a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name),
    )
    .map((entry) => ({
      teamId: String(entry.id),
      label: entry.abbreviation,
      href: `/dashboard/${saveId}/league/teams/${entry.id}`,
    }));

  return {
    teamId: String(team.id),
    city: team.city,
    name: team.name,
    abbreviation: team.abbreviation,
    record: { wins: standing?.wins ?? 0, losses: standing?.losses ?? 0 },
    isUserTeam: state.user.activeOwnerTeamId === teamId,
    players,
    teams,
  };
}
