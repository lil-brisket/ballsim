import Link from "next/link";
import { PageHeader } from "@/components/owner/PageHeader";
import { cn, focusRingClass } from "@/components/ui/styles";
import { historyHubHref } from "@/components/history/history-hub-links";
import type {
  HistoryHubRoute,
  HistoryHubTab,
} from "@/state/history-hub-selectors";

const TABS: ReadonlyArray<{ id: HistoryHubTab; label: string }> = [
  { id: "current", label: "Current Season" },
  { id: "awards", label: "Awards" },
  { id: "league", label: "League History" },
  { id: "teams", label: "Team Records" },
  { id: "players", label: "Player History" },
];

export function HistoryHubHeader(props: {
  saveId: string;
  route: HistoryHubRoute;
  activeTab: HistoryHubTab;
}) {
  return (
    <>
      <PageHeader
        title="League History"
        subtitle="Awards, champions, and franchise records across all seasons."
      />
      <nav
        aria-label="League history sections"
        className="mb-6 flex flex-wrap gap-2 border-b border-zinc-800 pb-3"
      >
        {TABS.map((tab) => {
          const active = tab.id === props.activeTab;
          return (
            <Link
              key={tab.id}
              href={historyHubHref(props.saveId, props.route, { tab: tab.id })}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                focusRingClass,
                active
                  ? "bg-amber-600/20 text-amber-300"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
