/**
 * Owner Mode primary navigation.
 * Only destinations with a real page and existing player-facing UI/actions.
 */

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
    items: [{ href: "", label: "Dashboard" }],
  },
  {
    id: "team",
    label: "Team",
    items: [
      { href: "/team", label: "Team" },
      { href: "/roster", label: "Roster" },
      { href: "/contracts", label: "Contracts" },
    ],
  },
  {
    id: "league",
    label: "League",
    items: [
      { href: "/league", label: "League" },
      { href: "/standings", label: "Standings" },
      { href: "/schedule", label: "Schedule" },
      { href: "/draft", label: "Draft" },
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
