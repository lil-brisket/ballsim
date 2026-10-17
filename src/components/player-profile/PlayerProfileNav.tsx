import { Tabs } from "@/components/ui/Tabs";

export const PLAYER_PROFILE_TABS = [
  "overview",
  "attributes",
  "stats",
  "development",
  "gamelog",
  "career",
  "contract",
] as const;

export type PlayerProfileTab = (typeof PLAYER_PROFILE_TABS)[number];

const TAB_LABELS: Record<PlayerProfileTab, string> = {
  overview: "Overview",
  attributes: "Attributes",
  stats: "Statistics",
  development: "Development",
  gamelog: "Game Log",
  career: "Career",
  contract: "Contract",
};

export function isPlayerProfileTab(value: string): value is PlayerProfileTab {
  return (PLAYER_PROFILE_TABS as readonly string[]).includes(value);
}

/** Parses `?tab=`; the retired `trends` id maps to `development`. */
export function resolvePlayerProfileTab(
  value: string | undefined,
): PlayerProfileTab {
  if (!value) return "overview";
  if (value === "trends") return "development";
  return isPlayerProfileTab(value) ? value : "overview";
}

export function PlayerProfileNav(props: {
  saveId: string;
  playerId: string;
  activeTab: PlayerProfileTab;
}) {
  const base = `/dashboard/${props.saveId}/players/${props.playerId}`;

  return (
    <Tabs
      aria-label="Player profile sections"
      activeKey={props.activeTab}
      items={PLAYER_PROFILE_TABS.map((tab) => ({
        key: tab,
        label: TAB_LABELS[tab],
        href: tab === "overview" ? base : `${base}?tab=${tab}`,
      }))}
    />
  );
}
