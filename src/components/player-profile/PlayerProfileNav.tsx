import Link from "next/link";
import { cn, focusRingClass } from "@/components/ui/styles";

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
    <nav
      className="flex gap-1 overflow-x-auto border-b border-zinc-800"
      aria-label="Player profile sections"
    >
      {PLAYER_PROFILE_TABS.map((tab) => {
        const href = tab === "overview" ? base : `${base}?tab=${tab}`;
        const active = props.activeTab === tab;
        return (
          <Link
            key={tab}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-3 font-mono text-xs uppercase tracking-[0.14em] transition-colors",
              active
                ? "border-amber-500 text-amber-300"
                : "border-transparent text-zinc-400 hover:text-zinc-100",
              focusRingClass,
            )}
          >
            {TAB_LABELS[tab]}
          </Link>
        );
      })}
    </nav>
  );
}
