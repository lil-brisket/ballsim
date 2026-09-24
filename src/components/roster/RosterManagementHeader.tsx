"use client";

import type { RosterPageView } from "@/state/roster-page-selectors";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { Metric } from "@/components/ui/Metric";
import { cn, panelClass } from "@/components/ui/styles";

export function RosterManagementHeader(props: {
  view: RosterPageView;
}) {
  const { team, summary } = props.view;
  return (
    <header
      className={cn(panelClass, "flex flex-wrap items-start justify-between gap-4 px-4 py-3")}
      aria-label="Roster summary"
    >
      <div>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
          Roster Management
        </p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-50">
          {team.city} {team.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">{team.abbreviation}</p>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Metric
          label="Roster"
          value={`${summary.rosterCount} / ${summary.rosterMax}`}
          density="compact"
          mono
        />
        <Metric
          label="Rotation"
          value={String(summary.rotationPlayerCount)}
          density="compact"
          mono
        />
        <Metric
          label="Injured"
          value={String(summary.injuredCount)}
          density="compact"
          mono
        />
        <Metric
          label="On Block"
          value={String(summary.tradeBlockPlayerCount)}
          density="compact"
          mono
        />
        <Metric
          label="Payroll"
          value={<MoneyDisplay amount={summary.payroll} />}
          density="compact"
        />
        <Metric
          label="Cap Space"
          value={<MoneyDisplay amount={summary.capSpace} />}
          density="compact"
        />
        {summary.openSpots > 0 ? (
          <Metric
            label="Open Spots"
            value={String(summary.openSpots)}
            density="compact"
            mono
          />
        ) : null}
      </div>
    </header>
  );
}
