"use client";

import { useState } from "react";
import { GameLabPanel } from "@/components/dev/sim-lab/GameLabPanel";
import { ScheduleLabPanel } from "@/components/dev/sim-lab/ScheduleLabPanel";
import { SeasonLabPanel } from "@/components/dev/sim-lab/SeasonLabPanel";
import type { SimLabPageConfig } from "@/components/dev/sim-lab/config";
import { Tabs } from "@/components/ui/Tabs";
import { SectionHeading } from "@/components/ui/SectionHeading";

type LabTab = "games" | "seasons" | "schedule";

const TABS: Array<{ id: LabTab; label: string }> = [
  { id: "games", label: "Game batches" },
  { id: "seasons", label: "Multi-season" },
  { id: "schedule", label: "Full schedule" },
];

export function SimLabWorkspace(props: { config: SimLabPageConfig }) {
  const [tab, setTab] = useState<LabTab>("games");

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-8 text-zinc-100">
      <SectionHeading as="h1" size="lg" title="Simulation Lab" />
      <p className="mt-2 max-w-3xl text-sm text-zinc-400">
        Dev-only QA for production simulateGame and advanceSimulation. Not
        linked from Owner Mode navigation. Multi-season and 82-game schedule
        runs stay on the server and can take minutes — keep this tab open.
      </p>

      <Tabs
        className="mt-6"
        aria-label="Simulation lab sections"
        activeKey={tab}
        items={TABS.map((item) => ({
          key: item.id,
          label: item.label,
          onSelect: () => setTab(item.id),
        }))}
      />

      <div className="mt-6">
        {tab === "games" ? (
          <GameLabPanel
            scenarioIds={props.config.scenarioIds}
            maxGames={props.config.maxGames}
          />
        ) : null}
        {tab === "seasons" ? (
          <SeasonLabPanel
            presets={props.config.presets}
            maxSeasonsCbl={props.config.maxSeasonsCbl}
            maxSeasonsStandard={props.config.maxSeasonsStandard}
          />
        ) : null}
        {tab === "schedule" ? (
          <ScheduleLabPanel presets={props.config.presets} />
        ) : null}
      </div>
    </main>
  );
}
