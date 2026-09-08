/**
 * Owner Mode primary navigation.
 * Persistent systems in the sidebar; contextual hubs derived from season state.
 */

import type { GameState } from "@/state/game-state";
import {
  computeOwnerNavBadges,
  type OwnerNavBadge,
  type OwnerNavBadgeKey,
} from "@/state/owner-nav-badges";
import { isOffseasonPeriod } from "@/state/owner-season-context";

export type OwnerNavItem = {
  href: string;
  label: string;
  icon?: string;
  badgeKey?: OwnerNavBadgeKey;
  /** Populated by ownerNavGroupsForState — not set on static config. */
  badge?: OwnerNavBadge;
};

export type OwnerNavGroup = {
  id: string;
  label: string;
  items: readonly OwnerNavItem[];
};

/** Static nav structure (canonical routes only). Offseason group injected at runtime. */
export const OWNER_NAV_GROUPS: readonly OwnerNavGroup[] = [
  {
    id: "home",
    label: "Home",
    items: [
      { href: "", label: "Front Office", icon: "home" },
      { href: "/teams", label: "My Teams", icon: "teams" },
    ],
  },
  {
    id: "simulation",
    label: "Simulation",
    items: [
      {
        href: "/calendar",
        label: "Calendar",
        icon: "calendar",
        badgeKey: "calendar",
      },
    ],
  },
  {
    id: "team",
    label: "Team",
    items: [
      { href: "/team", label: "Team", icon: "team" },
      { href: "/roster", label: "Roster", icon: "roster", badgeKey: "roster" },
      {
        href: "/team-management/lineups",
        label: "Lineups",
        icon: "lineups",
      },
      {
        href: "/staff-coaching",
        label: "Staff & Coaching",
        icon: "staff",
        badgeKey: "staff",
      },
      {
        href: "/contracts",
        label: "Contracts",
        icon: "contracts",
        badgeKey: "contracts",
      },
      { href: "/development", label: "Development", icon: "development" },
    ],
  },
  {
    id: "league",
    label: "League",
    items: [
      { href: "/league", label: "League", icon: "league" },
      { href: "/standings", label: "Standings", icon: "standings" },
      { href: "/schedule", label: "Schedule", icon: "schedule" },
      {
        href: "/transactions",
        label: "Transactions",
        icon: "transactions",
      },
      { href: "/draft", label: "Draft", icon: "draft" },
      { href: "/scouting", label: "Scouting", icon: "scouting" },
      { href: "/free-agency", label: "Free Agency", icon: "freeAgency" },
      { href: "/awards", label: "Awards", icon: "awards" },
    ],
  },
  {
    id: "media",
    label: "Media",
    items: [
      {
        href: "/media",
        label: "Media Hub",
        icon: "media",
        badgeKey: "media",
      },
    ],
  },
  {
    id: "franchise",
    label: "Franchise",
    items: [
      { href: "/finances", label: "Finances", icon: "finances" },
      { href: "/franchise", label: "Franchise", icon: "franchise" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [{ href: "/settings", label: "Settings", icon: "settings" }],
  },
] as const;

const OFFSEASON_GROUP: OwnerNavGroup = {
  id: "offseason",
  label: "Offseason",
  items: [
    {
      href: "/offseason",
      label: "Offseason Hub",
      icon: "offseason",
      badgeKey: "offseason",
    },
  ],
};

export function flattenOwnerNavItems(): readonly OwnerNavItem[] {
  return OWNER_NAV_GROUPS.flatMap((group) => group.items);
}

/**
 * Contextual nav: inject Offseason Hub when in offseason; attach actionable badges.
 * Relocation is never a permanent sidebar destination.
 */
export function ownerNavGroupsForState(state: GameState): OwnerNavGroup[] {
  const badges = computeOwnerNavBadges(state);
  const groups: OwnerNavGroup[] = [];

  for (const group of OWNER_NAV_GROUPS) {
    if (group.id === "simulation" && isOffseasonPeriod(state)) {
      groups.push(withBadges(group, badges));
      groups.push(withBadges(OFFSEASON_GROUP, badges));
      continue;
    }
    groups.push(withBadges(group, badges));
  }

  return groups;
}

function withBadges(
  group: OwnerNavGroup,
  badges: ReturnType<typeof computeOwnerNavBadges>,
): OwnerNavGroup {
  return {
    ...group,
    items: group.items.map((item) => {
      const badge =
        item.badgeKey && badges[item.badgeKey]
          ? badges[item.badgeKey]
          : undefined;
      return badge ? { ...item, badge } : { ...item };
    }),
  };
}
