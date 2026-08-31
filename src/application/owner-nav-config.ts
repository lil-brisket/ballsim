/**
 * Owner Mode primary navigation.
 * Only destinations with a real page and existing player-facing UI/actions.
 */

import type { GameState } from "@/state/game-state";
import { assessRelocation } from "@/state/relocation-assessment";

export type OwnerNavItem = {
  href: string;
  label: string;
};

export type OwnerNavGroup = {
  id: string;
  label: string;
  items: readonly OwnerNavItem[];
};

export const OWNER_NAV_GROUPS: readonly OwnerNavGroup[] = [
  {
    id: "dashboard",
    label: "Overview",
    items: [
      { href: "", label: "Dashboard" },
      { href: "/teams", label: "My Teams" },
    ],
  },
  {
    id: "team",
    label: "Team",
    items: [
      { href: "/team", label: "Team" },
      { href: "/team-management", label: "Team Management" },
      { href: "/roster", label: "Roster" },
      { href: "/development-league", label: "Development League" },
      { href: "/contracts", label: "Contracts" },
    ],
  },
  {
    id: "league",
    label: "League",
    items: [
      { href: "/league", label: "League" },
      { href: "/standings", label: "Standings" },
      { href: "/awards", label: "Awards" },
      { href: "/schedule", label: "Schedule" },
      { href: "/draft", label: "Draft" },
      { href: "/scouting", label: "Scouting" },
      { href: "/free-agency", label: "Free Agency" },
    ],
  },
  {
    id: "franchise",
    label: "Franchise",
    items: [
      { href: "/finances", label: "Finances" },
      { href: "/staff", label: "Staff" },
      { href: "/facilities", label: "Facilities" },
      { href: "/business", label: "Marketing" },
      { href: "/sponsorships", label: "Sponsorships" },
      { href: "/relocation", label: "Relocation" },
      { href: "/history", label: "History" },
      { href: "/media", label: "Media" },
    ],
  },
  {
    id: "events",
    label: "Events",
    items: [
      { href: "/notifications", label: "Notifications" },
      { href: "/transactions", label: "Transactions" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [{ href: "/settings", label: "Settings" }],
  },
] as const;

export function flattenOwnerNavItems(): readonly OwnerNavItem[] {
  return OWNER_NAV_GROUPS.flatMap((group) => group.items);
}

/**
 * Contextual nav: hide Relocation until consider/strong_case/in_progress.
 * League page always stays (economy); expansion controls are gated on the page.
 */
export function ownerNavGroupsForState(state: GameState): OwnerNavGroup[] {
  const relocation = assessRelocation(state);
  const showRelocation =
    relocation.status === "consider" ||
    relocation.status === "strong_case" ||
    relocation.status === "in_progress" ||
    relocation.status === "blocked_tenure" ||
    relocation.status === "watch";

  return OWNER_NAV_GROUPS.map((group) => {
    if (group.id !== "franchise") {
      return { ...group, items: [...group.items] };
    }
    return {
      ...group,
      items: group.items.filter(
        (item) => item.href !== "/relocation" || showRelocation,
      ),
    };
  });
}
