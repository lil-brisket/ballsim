import type { TeamId } from "@/domain/ids";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import type { GameState } from "@/state/game-state";
import { compareStandings } from "@/systems/standings";

/**
 * League-wide rank (1 = best) for every team, in `compareStandings` order:
 * win percentage, then wins, point differential and team id. This is the one
 * league rank every screen shows; conference and division ranks apply the
 * same order within their group.
 */
export function leagueRankByTeamId(state: GameState): Map<TeamId, number> {
  const standings = Object.values(state.world.teams).map(
    (team) =>
      state.competition.standings.byTeamId[team.id] ??
      createEmptyTeamStanding(team.id),
  );
  standings.sort(compareStandings);
  return new Map(standings.map((standing, i) => [standing.teamId, i + 1]));
}

/**
 * A team's league rank, or null before it has played a game (every team is
 * tied at 0–0, so a rank would only reflect the tie-break on team id).
 */
export function leagueRankForTeam(
  state: GameState,
  teamId: TeamId,
): number | null {
  const standing = state.competition.standings.byTeamId[teamId];
  if (!standing || standing.wins + standing.losses === 0) {
    return null;
  }
  return leagueRankByTeamId(state).get(teamId) ?? null;
}
