/**
 * Owner Mode navigation: hubs across the top, each with one row of sub-tabs.
 * Contextual tabs (Playoffs, All-Star, Members, Free Agency) and the Offseason
 * hub are derived from season state.
 */

import type { GameState } from "@/state/game-state";
import {
  computeOwnerNavBadges,
  type OwnerNavBadge,
  type OwnerNavBadgeKey,
} from "@/state/owner-nav-badges";
import { isOffseasonPeriod } from "@/state/owner-season-context";
import { isInSeasonSigningOpen } from "@/systems/league-rules/free-agency-rules";
import type { SeasonPhase } from "@/domain/entities/season";

export type OwnerNavItem = {
  /** Path under /dashboard/<saveId> ("" is Home). */
  href: string;
  label: string;
  icon?: string;
  badgeKey?: OwnerNavBadgeKey;
  /** Other path prefixes that open this tab (e.g. a merged legacy page). */
  also?: readonly string[];
  /** Populated by ownerNavGroupsForState — not set on static config. */
  badge?: OwnerNavBadge;
};

export type OwnerHubId =
  | "home"
  | "team"
  | "league"
  | "front-office"
  | "media"
  | "offseason"
  | "settings";

/** A hub: one top-level destination and its sub-tabs. */
export type OwnerNavGroup = {
  id: OwnerHubId;
  label: string;
  /** Landing path of the hub. */
  href: string;
  icon: string;
  items: readonly OwnerNavItem[];
  /** Path prefixes inside the hub that have no tab of their own. */
  also?: readonly string[];
  /** Most urgent badge among the hub's tabs. Set by ownerNavGroupsForState. */
  badge?: OwnerNavBadge;
};

const HOME_HUB: OwnerNavGroup = {
  id: "home",
  label: "Home",
  href: "",
  icon: "home",
  items: [
    { href: "", label: "Home", icon: "home" },
    {
      href: "/calendar",
      label: "Schedule",
      icon: "calendar",
      badgeKey: "calendar",
      also: ["/schedule"],
    },
  ],
  also: ["/notifications", "/games"],
};

const TEAM_HUB: OwnerNavGroup = {
  id: "team",
  label: "Team",
  href: "/team",
  icon: "team",
  items: [
    { href: "/team", label: "Overview", icon: "team" },
    { href: "/roster", label: "Roster", icon: "roster", badgeKey: "roster" },
    { href: "/roster/injuries", label: "Injuries", icon: "injuries" },
    {
      href: "/team-management/lineups",
      label: "Lineups",
      icon: "lineups",
    },
    { href: "/development", label: "Development", icon: "development" },
    {
      href: "/development-league",
      label: "Dev League",
      icon: "development",
    },
    { href: "/team/history", label: "History", icon: "awards" },
  ],
  also: ["/players", "/team-management"],
};

const LEAGUE_HUB: OwnerNavGroup = {
  id: "league",
  label: "League",
  href: "/league",
  icon: "league",
  items: [
    { href: "/league", label: "Overview", icon: "league" },
    { href: "/league/standings", label: "Standings", icon: "standings" },
    {
      href: "/league/player-stats",
      label: "Player Stats",
      icon: "standings",
    },
    { href: "/league/team-stats", label: "Team Stats", icon: "standings" },
    {
      href: "/league/transactions",
      label: "Transactions",
      icon: "transactions",
    },
    {
      href: "/awards",
      label: "Awards",
      icon: "awards",
      also: ["/season-events/fan-voting"],
    },
    { href: "/history", label: "History", icon: "awards" },
  ],
};

const FRONT_OFFICE_HUB: OwnerNavGroup = {
  id: "front-office",
  label: "Front Office",
  href: "/finances",
  icon: "finances",
  items: [
    { href: "/finances", label: "Finances", icon: "finances" },
    {
      href: "/team/contracts",
      label: "Contracts",
      icon: "contracts",
      badgeKey: "contracts",
    },
    { href: "/trades", label: "Trades", icon: "transactions" },
    {
      href: "/staff-coaching/staff",
      label: "Staff",
      icon: "staff",
      badgeKey: "staff",
      also: ["/staff-coaching", "/staff"],
    },
    { href: "/franchise", label: "Franchise", icon: "franchise" },
    {
      href: "/business",
      label: "Business",
      icon: "finances",
      also: ["/sponsorships"],
    },
  ],
};

const MEDIA_HUB: OwnerNavGroup = {
  id: "media",
  label: "Media",
  href: "/media",
  icon: "media",
  items: [
    { href: "/media", label: "Media Hub", icon: "media", badgeKey: "media" },
  ],
};

const OFFSEASON_HUB: OwnerNavGroup = {
  id: "offseason",
  label: "Offseason",
  href: "/offseason",
  icon: "offseason",
  items: [
    {
      href: "/offseason",
      label: "Offseason Hub",
      icon: "offseason",
      badgeKey: "offseason",
    },
    { href: "/draft", label: "Draft", icon: "draft" },
    { href: "/scouting", label: "Scouting", icon: "scouting" },
  ],
};

const SETTINGS_HUB: OwnerNavGroup = {
  id: "settings",
  label: "Settings",
  href: "/settings",
  icon: "settings",
  items: [
    { href: "/settings", label: "League", icon: "settings" },
    { href: "/settings/rules", label: "Rules", icon: "settings" },
    { href: "/settings/ai", label: "AI Management", icon: "settings" },
    { href: "/settings/tools", label: "Tools", icon: "settings" },
  ],
};

/**
 * Static hubs (canonical routes only). The Offseason hub and contextual tabs
 * are added by ownerNavGroupsForState.
 */
export const OWNER_NAV_GROUPS: readonly OwnerNavGroup[] = [
  HOME_HUB,
  TEAM_HUB,
  LEAGUE_HUB,
  FRONT_OFFICE_HUB,
  MEDIA_HUB,
  SETTINGS_HUB,
];

const FREE_AGENCY_ITEM: OwnerNavItem = {
  href: "/free-agency",
  label: "Free Agency",
  icon: "freeAgency",
};

const OFFSEASON_WITH_FREE_AGENCY: OwnerNavGroup = {
  ...OFFSEASON_HUB,
  items: [...OFFSEASON_HUB.items, FREE_AGENCY_ITEM],
};

const PLAYOFFS_ITEM: OwnerNavItem = {
  href: "/playoffs",
  label: "Playoffs",
  icon: "playoffs",
};

const ALL_STAR_ITEM: OwnerNavItem = {
  href: "/season-events/all-star",
  label: "All-Star",
  icon: "awards",
};

const PROPOSE_TRADE_ITEM: OwnerNavItem = {
  href: "/trades/propose",
  label: "Propose Trade",
  icon: "transactions",
};

const LEAGUE_MEMBERS_ITEM: OwnerNavItem = {
  href: "/league-members",
  label: "Members",
  icon: "league",
};

/** Online leagues list their members under League. */
function sharedLeagueItems(state: GameState): OwnerNavItem[] {
  return state.user.participation.mode === "online"
    ? [LEAGUE_MEMBERS_ITEM]
    : [];
}

/** Shared leagues propose trades to other humans; a tab of its own. */
function sharedTradeItems(state: GameState): OwnerNavItem[] {
  return state.user.participation.mode === "single" ? [] : [PROPOSE_TRADE_ITEM];
}

function isPlayoffsNavPhase(phase: SeasonPhase): boolean {
  return phase === "playoffs" || phase === "postseason";
}

function allStarItems(state: GameState): OwnerNavItem[] {
  const allStar = state.competition.seasonEvents?.allStar;
  if (
    allStar &&
    (allStar.status === "selections_announced" ||
      allStar.status === "completed" ||
      allStar.status === "voting")
  ) {
    return [ALL_STAR_ITEM];
  }
  return [];
}

export function flattenOwnerNavItems(): readonly OwnerNavItem[] {
  return OWNER_NAV_GROUPS.flatMap((group) => group.items);
}

/** Number keys 1–n jump to hubs in this order; Settings is not numbered. */
export function numberedHubs(
  groups: readonly OwnerNavGroup[],
): readonly OwnerNavGroup[] {
  return groups.filter((group) => group.id !== "settings");
}

/**
 * Hubs for the current state: inserts the Offseason hub during the offseason
 * (Free Agency moves there), adds contextual tabs and attaches badges.
 */
export function ownerNavGroupsForState(state: GameState): OwnerNavGroup[] {
  const badges = computeOwnerNavBadges(state);
  const offseason = isOffseasonPeriod(state);
  const signingOpen = !offseason && isInSeasonSigningOpen(state);
  const phase = state.competition.season.phase;
  const groups: OwnerNavGroup[] = [];

  for (const hub of OWNER_NAV_GROUPS) {
    let items = hub.items;
    if (hub.id === "league") {
      items = [
        ...items,
        ...(isPlayoffsNavPhase(phase) ? [PLAYOFFS_ITEM] : []),
        ...allStarItems(state),
        ...sharedLeagueItems(state),
      ];
    }
    if (hub.id === "front-office") {
      const tradesIndex = items.findIndex((item) => item.href === "/trades");
      items = [
        ...items.slice(0, tradesIndex + 1),
        ...sharedTradeItems(state),
        ...(signingOpen ? [FREE_AGENCY_ITEM] : []),
        ...items.slice(tradesIndex + 1),
      ];
    }
    if (hub.id === "settings" && offseason) {
      groups.push(withBadges(OFFSEASON_WITH_FREE_AGENCY, badges));
    }
    groups.push(withBadges({ ...hub, items }, badges));
  }

  return groups;
}

const BADGE_RANK: Record<OwnerNavBadge["kind"], number> = {
  critical: 3,
  actionable: 2,
  unread: 1,
};

function withBadges(
  group: OwnerNavGroup,
  badges: ReturnType<typeof computeOwnerNavBadges>,
): OwnerNavGroup {
  const items = group.items.map((item) => {
    const badge =
      item.badgeKey && badges[item.badgeKey]
        ? badges[item.badgeKey]
        : undefined;
    return badge ? { ...item, badge } : { ...item };
  });
  let hubBadge: OwnerNavBadge | undefined;
  for (const item of items) {
    if (!item.badge || item.badge.count <= 0) continue;
    if (!hubBadge || BADGE_RANK[item.badge.kind] > BADGE_RANK[hubBadge.kind]) {
      hubBadge = item.badge;
    }
  }
  return hubBadge ? { ...group, items, badge: hubBadge } : { ...group, items };
}

function matchesPrefix(path: string, prefix: string): boolean {
  if (prefix === "") return path === "";
  return path === prefix || path.startsWith(`${prefix}/`);
}

export type ActiveOwnerNav = {
  hub: OwnerNavGroup;
  /** The active sub-tab, if the path belongs to one. */
  item?: OwnerNavItem;
};

/**
 * Hub and tab for a path under /dashboard/<saveId> (e.g. "/team/contracts").
 * The longest matching prefix wins, so a tab nested under another hub's path
 * (Contracts under /team) still belongs to its own hub.
 */
export function activeOwnerNav(
  groups: readonly OwnerNavGroup[],
  path: string,
): ActiveOwnerNav | undefined {
  let best: { length: number; active: ActiveOwnerNav } | undefined;
  const consider = (prefix: string, active: ActiveOwnerNav) => {
    if (!matchesPrefix(path, prefix)) return;
    if (!best || prefix.length > best.length) {
      best = { length: prefix.length, active };
    }
  };
  for (const hub of groups) {
    for (const prefix of hub.also ?? []) consider(prefix, { hub });
    for (const item of hub.items) {
      for (const prefix of [item.href, ...(item.also ?? [])]) {
        consider(prefix, { hub, item });
      }
    }
  }
  return best?.active;
}
