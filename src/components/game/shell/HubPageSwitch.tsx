import { ViewSwitch } from "@/components/ui/ViewSwitch";

/**
 * Hub tabs that stand for two routes (the second is claimed via `also` in
 * owner-nav-config). Each page renders this switch so both stay one tap away.
 */
const PAIRS = {
  roster: {
    label: "Roster views",
    items: [
      { key: "roster", label: "Roster", path: "/roster" },
      { key: "injuries", label: "Injuries", path: "/roster/injuries" },
    ],
  },
  development: {
    label: "Development views",
    items: [
      { key: "development", label: "Development", path: "/development" },
      {
        key: "development-league",
        label: "Dev League",
        path: "/development-league",
      },
    ],
  },
  stats: {
    label: "Stats views",
    items: [
      { key: "player-stats", label: "Players", path: "/league/player-stats" },
      { key: "team-stats", label: "Teams", path: "/league/team-stats" },
    ],
  },
} as const;

export type HubPageSwitchPair = keyof typeof PAIRS;

export function HubPageSwitch(props: {
  saveId: string;
  pair: HubPageSwitchPair;
  /** Key of the page being shown. */
  active: string;
  className?: string;
}) {
  const pair = PAIRS[props.pair];
  return (
    <ViewSwitch
      aria-label={pair.label}
      activeKey={props.active}
      className={props.className}
      items={pair.items.map((item) => ({
        key: item.key,
        label: item.label,
        href: `/dashboard/${props.saveId}${item.path}`,
      }))}
    />
  );
}
