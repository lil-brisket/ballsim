"use client";

import type { RosterPageView } from "@/state/roster-page-selectors";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TickerBar, type TickerItem } from "@/components/ui/TickerBar";

export function RosterManagementHeader(props: { view: RosterPageView }) {
  const { team, summary } = props.view;
  const items: TickerItem[] = [
    {
      label: "Roster",
      value: `${summary.rosterCount} / ${summary.rosterMax}`,
      tone: "team",
    },
    { label: "Rotation", value: String(summary.rotationPlayerCount) },
    {
      label: "Injured",
      value: String(summary.injuredCount),
      tone: summary.injuredCount > 0 ? "loss" : "default",
    },
    { label: "On Block", value: String(summary.tradeBlockPlayerCount) },
    { label: "Payroll", value: <MoneyDisplay amount={summary.payroll} /> },
    { label: "Cap Space", value: <MoneyDisplay amount={summary.capSpace} /> },
  ];
  if (summary.openSpots > 0) {
    items.push({ label: "Open Spots", value: String(summary.openSpots) });
  }

  return (
    <ArenaPanel
      as="header"
      edge="top"
      density="compact"
      className="flex flex-wrap items-center justify-between gap-4"
      aria-label="Roster summary"
    >
      <div>
        <SectionHeading
          as="h1"
          eyebrow="Roster Management"
          title={`${team.city} ${team.name}`}
        />
        <p className="mt-1 text-sm text-zinc-300">{team.abbreviation}</p>
      </div>
      <TickerBar aria-label="Roster summary" items={items} />
    </ArenaPanel>
  );
}
