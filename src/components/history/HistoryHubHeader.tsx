import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn, focusRingClass } from "@/components/ui/styles";
import { historyHubHref } from "@/components/history/history-hub-links";
import {
  HISTORY_HUB_ROUTE_TABS,
  type HistoryHubRoute,
  type HistoryHubTab,
} from "@/state/history-hub-selectors";

const TAB_LABELS: Record<HistoryHubTab, string> = {
  current: "Current Season",
  awards: "Award History",
  league: "League History",
  teams: "Team Records",
  players: "Player History",
  jerseys: "Retired Jerseys",
};

const ROUTE_HEADERS: Record<
  HistoryHubRoute,
  { title: string; subtitle: string; navLabel: string }
> = {
  awards: {
    title: "Awards",
    subtitle: "Award races, winners and history.",
    navLabel: "Awards sections",
  },
  history: {
    title: "League History",
    subtitle: "Champions and season results across all seasons.",
    navLabel: "League history sections",
  },
  team: {
    title: "Team History",
    subtitle: "Franchise records, player history and retired jerseys.",
    navLabel: "Team history sections",
  },
};

export function HistoryHubHeader(props: {
  saveId: string;
  route: HistoryHubRoute;
  activeTab: HistoryHubTab;
}) {
  const header = ROUTE_HEADERS[props.route];
  const tabs = HISTORY_HUB_ROUTE_TABS[props.route];
  return (
    <>
      <PageHeader title={header.title} subtitle={header.subtitle} />
      {tabs.length > 1 ? (
        <nav
          aria-label={header.navLabel}
          className="mb-6 flex flex-wrap gap-2 border-b border-zinc-800 pb-3"
        >
          {tabs.map((id) => {
            const active = id === props.activeTab;
            return (
              <Link
                key={id}
                href={historyHubHref(props.saveId, props.route, { tab: id })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm",
                  focusRingClass,
                  active
                    ? "bg-team/15 text-team-ink"
                    : "text-zinc-400 hover:text-zinc-200",
                )}
                aria-current={active ? "page" : undefined}
              >
                {TAB_LABELS[id]}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </>
  );
}
