import type { OwnerHubId, OwnerNavGroup } from "@/application/owner-nav-config";

/** View transition types the page content maps to slide animations. */
export const HUB_FORWARD = "hub-forward";
export const HUB_BACK = "hub-back";

/**
 * Which way a move between hubs goes. Hubs are ordered as the bar lists them
 * (Home, Team, League, Front Office, Media, Offseason when present); Settings
 * counts as after the last hub. Null when it does not change hub, or either
 * hub is unknown, so the move falls back to the plain crossfade.
 */
export function hubDirection(
  groups: readonly OwnerNavGroup[],
  from: OwnerHubId | undefined,
  to: OwnerHubId | undefined,
): "forward" | "back" | null {
  if (!from || !to || from === to) return null;
  const rank = (id: OwnerHubId) => {
    if (id === "settings") return groups.length;
    return groups.findIndex((group) => group.id === id);
  };
  const fromRank = rank(from);
  const toRank = rank(to);
  if (fromRank === -1 || toRank === -1) return null;
  return toRank > fromRank ? "forward" : "back";
}

/**
 * Transition types for a navigation from one hub to another: a slide in the
 * direction moved, or none (the page's default crossfade applies).
 */
export function hubTransitionTypes(
  groups: readonly OwnerNavGroup[],
  from: OwnerHubId | undefined,
  to: OwnerHubId | undefined,
): string[] {
  const direction = hubDirection(groups, from, to);
  if (direction === "forward") return [HUB_FORWARD];
  if (direction === "back") return [HUB_BACK];
  return [];
}
