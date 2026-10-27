import { PageHeader } from "@/components/ui/PageHeader";
import { ViewSwitch } from "@/components/ui/ViewSwitch";
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
        <ViewSwitch
          aria-label={header.navLabel}
          className="mb-6 max-w-full flex-wrap"
          activeKey={props.activeTab}
          items={tabs.map((id) => ({
            key: id,
            label: TAB_LABELS[id],
            href: historyHubHref(props.saveId, props.route, { tab: id }),
          }))}
        />
      ) : null}
    </>
  );
}
