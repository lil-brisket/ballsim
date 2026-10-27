"use client";

import {
  cn,
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { RosterPageView } from "@/state/roster-page-selectors";
import { ViewSwitch } from "@/components/ui/ViewSwitch";
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
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  const { view } = props;

  function tabHref(next: RosterManagementTab): string {
    return `/dashboard/${view.saveId}/roster${
      next === "roster" ? "" : `?tab=${next}`
    }`;
  }
  const returnPath = tabHref(tab);

  return (
    <div className="space-y-6">
      <RosterManagementHeader view={view} />

      <ViewSwitch
        aria-label="Roster management"
        className="max-w-full flex-wrap"
        activeKey={tab}
        items={TABS.map((entry) => ({
          key: entry.id,
          label: entry.label,
          href: tabHref(entry.id),
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
                    className={cn(
                      linkClass,
                      touchTargetTextClass,
                      focusRingClass,
                    )}
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
