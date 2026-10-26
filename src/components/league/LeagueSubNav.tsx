import { Tabs } from "@/components/ui/Tabs";

/**
 * The single sub-navigation row for League pages (Issue #184). Standings
 * moved here from its own sidebar entry; `/standings` redirects to it.
 */
const LINKS = [
  { key: "overview", suffix: "/league", label: "Overview" },
  { key: "standings", suffix: "/league/standings", label: "Standings" },
  { key: "teamStats", suffix: "/league/team-stats", label: "Team Stats" },
  {
    key: "playerStats",
    suffix: "/league/player-stats",
    label: "Player Stats",
  },
] as const;

export type LeagueSubNavKey = (typeof LINKS)[number]["key"];

export function LeagueSubNav(props: {
  saveId: string;
  active: LeagueSubNavKey;
}) {
  const base = `/dashboard/${props.saveId}`;
  return (
    <Tabs
      aria-label="League"
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
