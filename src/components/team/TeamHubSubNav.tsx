import { Tabs } from "@/components/ui/Tabs";

/**
 * The single sub-navigation row for team pages. Roster and Lineups remain
 * sibling routes (`/roster`, `/team-management/lineups`); Contracts is nested
 * at `/team/contracts` by Issue #56.
 */
const LINKS = [
  { key: "team", suffix: "/team", label: "Team Hub" },
  { key: "roster", suffix: "/roster", label: "Roster" },
  { key: "injuries", suffix: "/roster/injuries", label: "Injuries" },
  {
    key: "lineupRotation",
    suffix: "/team-management/lineups",
    label: "Lineup & Rotation",
  },
  { key: "contracts", suffix: "/team/contracts", label: "Contracts" },
  { key: "history", suffix: "/team/history", label: "History" },
  {
    key: "transactions",
    suffix: "/team-management/transactions",
    label: "Transactions",
  },
] as const;

export type TeamHubSubNavKey = (typeof LINKS)[number]["key"];

export function TeamHubSubNav(props: {
  saveId: string;
  active: TeamHubSubNavKey;
}) {
  const base = `/dashboard/${props.saveId}`;
  return (
    <Tabs
      aria-label="Team management"
      className="mb-6"
      activeKey={props.active}
      items={LINKS.map((link) => ({
        key: link.key,
        label: link.label,
        href: `${base}${link.suffix}`,
      }))}
    />
  );
}
