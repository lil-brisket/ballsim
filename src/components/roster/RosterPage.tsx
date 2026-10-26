"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { RosterPageView } from "@/state/roster-page-selectors";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { DepthChart } from "@/components/roster/DepthChart";
import { FreeAgentRosterView } from "@/components/roster/FreeAgentRosterView";
import { RosterManagementHeader } from "@/components/roster/RosterManagementHeader";
import { RosterManagementTable } from "@/components/roster/RosterManagementTable";
import { RosterNeeds } from "@/components/roster/RosterNeeds";
import { TradeBlockRosterView } from "@/components/roster/TradeBlockView";
import { TradeFinderView } from "@/components/roster/TradeFinderView";
import { SectionHeading } from "@/components/ui/SectionHeading";

export type RosterManagementTab =
  "roster" | "free-agents" | "trade-block" | "trade-finder";

const TABS: { id: RosterManagementTab; label: string }[] = [
  { id: "roster", label: "Roster" },
  { id: "free-agents", label: "Free Agents" },
  { id: "trade-block", label: "Trade Block" },
  { id: "trade-finder", label: "Trade Finder" },
];

function parseTab(raw: string | null): RosterManagementTab {
  if (
    raw === "free-agents" ||
    raw === "trade-block" ||
    raw === "trade-finder"
  ) {
    return raw;
  }
  return "roster";
}

export function RosterPage(props: { view: RosterPageView }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  const { view } = props;
  const returnPath = `/dashboard/${view.saveId}/roster${
    tab === "roster" ? "" : `?tab=${tab}`
  }`;

  function setTab(next: RosterManagementTab) {
    const params = new URLSearchParams();
    if (next !== "roster") {
      params.set("tab", next);
    }
    const qs = params.toString();
    router.replace(`/dashboard/${view.saveId}/roster${qs ? `?${qs}` : ""}`, {
      scroll: false,
    });
  }

  return (
    <div className="space-y-6">
      <RosterManagementHeader view={view} />

      <Tabs
        aria-label="Roster management"
        activeKey={tab}
        items={TABS.map((entry) => ({
          key: entry.id,
          label: entry.label,
          onSelect: () => setTab(entry.id),
        }))}
      />

      {tab === "roster" ? (
        <div className="space-y-6">
          <RosterNeeds needs={view.rosterNeeds} />
          {view.roster.length === 0 ? (
            <EmptyState message="No players on the roster." />
          ) : (
            <section aria-label="Roster table" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionHeading as="h2" title="Roster" />
                <p className="text-sm text-muted">
                  <Link
                    href={view.lineupHref}
                    className="text-team-ink hover:underline"
                  >
                    Edit lineup &amp; rotation
                  </Link>
                </p>
              </div>
              <RosterManagementTable
                saveId={view.saveId}
                players={view.roster}
                returnPath={returnPath}
              />
            </section>
          )}
          <DepthChart saveId={view.saveId} depthChart={view.depthChart} />
        </div>
      ) : null}

      {tab === "free-agents" ? (
        <FreeAgentRosterView
          saveId={view.saveId}
          freeAgents={view.freeAgents}
          freeAgencyHubHref={view.freeAgencyHubHref}
          freeAgencyActive={view.freeAgencyActive}
        />
      ) : null}

      {tab === "trade-block" ? (
        <TradeBlockRosterView
          saveId={view.saveId}
          tradeBlock={view.tradeBlock}
          returnPath={returnPath}
        />
      ) : null}

      {tab === "trade-finder" ? (
        <TradeFinderView
          // Reset selection and offers once a trade changes what we own.
          key={[
            ...view.roster.map((player) => player.playerId),
            ...view.tradeFinder.picks.map((pick) => pick.id),
          ].join(",")}
          saveId={view.saveId}
          roster={view.roster}
          picks={view.tradeFinder.picks}
          suggestedOutgoingPlayerId={view.tradeFinder.suggestedOutgoingPlayerId}
        />
      ) : null}
    </div>
  );
}
