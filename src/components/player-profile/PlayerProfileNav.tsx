import Link from "next/link";

export const PLAYER_PROFILE_TABS = [
  "overview",
  "attributes",
  "stats",
  "trends",
  "gamelog",
  "career",
  "contract",
] as const;

export type PlayerProfileTab = (typeof PLAYER_PROFILE_TABS)[number];

const TAB_LABELS: Record<PlayerProfileTab, string> = {
  overview: "Overview",
  attributes: "Attributes",
  stats: "Stats",
  trends: "Trends",
  gamelog: "Game Log",
  career: "Career",
  contract: "Contract",
};

export function isPlayerProfileTab(value: string): value is PlayerProfileTab {
  return (PLAYER_PROFILE_TABS as readonly string[]).includes(value);
}

export function PlayerProfileNav(props: {
  saveId: string;
  playerId: string;
  activeTab: PlayerProfileTab;
}) {
  const base = `/dashboard/${props.saveId}/players/${props.playerId}`;

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Player profile sections">
      {PLAYER_PROFILE_TABS.map((tab) => {
        const href = tab === "overview" ? base : `${base}?tab=${tab}`;
        const active = props.activeTab === tab;
        return (
          <Link
            key={tab}
            href={href}
            className={`rounded-full border px-3 py-1 text-xs ${
              active
                ? "border-amber-600 text-amber-400"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            {TAB_LABELS[tab]}
          </Link>
        );
      })}
    </nav>
  );
}
