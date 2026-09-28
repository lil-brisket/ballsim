import Link from "next/link";
import { MediaUnreadBadge } from "@/components/media-hub/MediaUnreadBadge";
import { cn, focusRingClass } from "@/components/ui/styles";
import type {
  MediaHubTab,
  MediaLatestFilter,
} from "@/domain/entities/media-item";

export type { MediaHubTab, MediaLatestFilter };

const TABS: ReadonlyArray<{ id: MediaHubTab; label: string }> = [
  { id: "latest", label: "Latest" },
  { id: "team", label: "Your Team" },
  { id: "transactions", label: "Transactions" },
  { id: "games", label: "Games" },
  { id: "injuries", label: "Injuries" },
  { id: "league", label: "League" },
  { id: "social", label: "Social" },
];

const LATEST_FILTERS: ReadonlyArray<{
  id: MediaLatestFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "game", label: "Games" },
  { id: "player", label: "Players" },
  { id: "trends", label: "Trends" },
];

function tabHref(
  saveId: string,
  tab: MediaHubTab,
  filter?: MediaLatestFilter,
): string {
  const params = new URLSearchParams();
  if (tab !== "latest") {
    params.set("tab", tab);
  }
  if (tab === "latest" && filter && filter !== "all") {
    params.set("filter", filter);
  }
  const qs = params.toString();
  return qs ? `/dashboard/${saveId}/media?${qs}` : `/dashboard/${saveId}/media`;
}

export function MediaTabNav(props: {
  saveId: string;
  activeTab: MediaHubTab;
  latestFilter?: MediaLatestFilter;
  unreadCount: number;
}) {
  const { saveId, activeTab, latestFilter = "all", unreadCount } = props;

  return (
    <div className="space-y-3">
      <nav
        className="flex flex-nowrap gap-2 overflow-x-auto"
        aria-label="Media hub tabs"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={tabHref(saveId, tab.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm",
                focusRingClass,
                active
                  ? "border-amber-600 bg-amber-950/30 text-amber-300"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200",
              )}
            >
              {tab.label}
              {tab.id === "latest" ? (
                <MediaUnreadBadge count={unreadCount} />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {activeTab === "latest" ? (
        <div
          className="flex flex-nowrap gap-2 overflow-x-auto"
          aria-label="Latest filters"
        >
          {LATEST_FILTERS.map((filter) => {
            const active = latestFilter === filter.id;
            return (
              <Link
                key={filter.id}
                href={tabHref(saveId, "latest", filter.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs",
                  focusRingClass,
                  active
                    ? "border-amber-600 text-amber-400"
                    : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300",
                )}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
