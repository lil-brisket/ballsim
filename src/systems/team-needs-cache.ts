import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

/**
 * A per-team result that depends only on the team's roster, the players, the
 * contracts and the season. CPU trade search asks for the same team's needs
 * for every candidate it weighs against one unchanged state, so results are
 * cached on those objects' identity (the same approach as getTeamPayroll).
 */
export type TeamRosterCache<T> = WeakMap<
  GameState["world"]["players"],
  WeakMap<GameState["business"]["contracts"], WeakMap<object, Map<number, T>>>
>;

export function createTeamRosterCache<T>(): TeamRosterCache<T> {
  return new WeakMap();
}

export function cachedForTeamRoster<T>(
  cache: TeamRosterCache<T>,
  state: GameState,
  teamId: TeamId,
  compute: () => T,
): T {
  const team = state.world.teams[teamId];
  if (!team) {
    return compute();
  }
  let byContracts = cache.get(state.world.players);
  if (byContracts === undefined) {
    byContracts = new WeakMap();
    cache.set(state.world.players, byContracts);
  }
  let byTeam = byContracts.get(state.business.contracts);
  if (byTeam === undefined) {
    byTeam = new WeakMap();
    byContracts.set(state.business.contracts, byTeam);
  }
  let byYear = byTeam.get(team);
  if (byYear === undefined) {
    byYear = new Map();
    byTeam.set(team, byYear);
  }
  const year = state.competition.season.year;
  if (byYear.has(year)) {
    return byYear.get(year)!;
  }
  const value = compute();
  byYear.set(year, value);
  return value;
}
