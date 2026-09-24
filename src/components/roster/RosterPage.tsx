"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { RosterPageView } from "@/state/roster-page-selectors";
import { EmptyState } from "@/components/owner/EmptyState";
import { DepthChart } from "@/components/roster/DepthChart";
import { FreeAgentRosterView } from "@/components/roster/FreeAgentRosterView";
import { RosterManagementHeader } from "@/components/roster/RosterManagementHeader";
import { RosterManagementTable } from "@/components/roster/RosterManagementTable";
import { RosterNeeds } from "@/components/roster/RosterNeeds";
import { TradeBlockRosterView } from "@/components/roster/TradeBlockView";
import { TradeFinderView } from "@/components/roster/TradeFinderView";
import { cn, focusRingClass } from "@/components/ui/styles";

export type RosterManagementTab =
  | "roster"
  | "free-agents"
  | "trade-block"
  | "trade-finder";

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
    router.replace(
      `/dashboard/${view.saveId}/roster${qs ? `?${qs}` : ""}`,
      { scroll: false },
    );
  }

  return (
    <div className="space-y-6">
      <RosterManagementHeader view={view} />

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Roster management"
      >
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              focusRingClass,
              tab === entry.id
                ? "bg-amber-600/20 text-amber-300"
                : "border border-zinc-700 text-zinc-400 hover:border-zinc-500",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "roster" ? (
        <div className="space-y-6">
          <RosterNeeds needs={view.rosterNeeds} />
          {view.roster.length === 0 ? (
            <EmptyState message="No players on the roster." />
          ) : (
            <section aria-label="Roster table" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
                  Roster
                </h2>
                <p className="text-xs text-zinc-600">
                  <Link
                    href={view.lineupHref}
                    className="text-amber-400 hover:text-amber-300"
                  >
                    Edit lineups
                  </Link>
                  {" · "}
                  <Link
                    href={view.rotationsHref}
                    className="text-amber-400 hover:text-amber-300"
                  >
                    Edit rotations
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
          saveId={view.saveId}
          roster={view.roster}
          suggestedOutgoingPlayerId={
            view.tradeFinder.suggestedOutgoingPlayerId
          }
        />
      ) : null}
    </div>
  );
}
