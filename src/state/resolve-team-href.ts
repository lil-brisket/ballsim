import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

/**
 * Best owner-mode destination for a team entity.
 * Active franchise → /team; other owned and unowned → /league.
 * Franchise switching happens via the header OwnerTeamSwitcher.
 */
export function resolveTeamHref(
  state: GameState,
  teamId: TeamId,
  saveId: string,
): string {
  if (teamId === state.user.activeOwnerTeamId) {
    return `/dashboard/${saveId}/team`;
  }
  return `/dashboard/${saveId}/league`;
}
