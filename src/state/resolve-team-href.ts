import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { isOwnedFranchise } from "@/state/owner-context";

/**
 * Best owner-mode destination for a team entity.
 * Active franchise → /team; other owned → /teams; else → /league.
 */
export function resolveTeamHref(
  state: GameState,
  teamId: TeamId,
  saveId: string,
): string {
  if (teamId === state.user.activeOwnerTeamId) {
    return `/dashboard/${saveId}/team`;
  }
  if (isOwnedFranchise(state, teamId)) {
    return `/dashboard/${saveId}/teams`;
  }
  return `/dashboard/${saveId}/league`;
}
