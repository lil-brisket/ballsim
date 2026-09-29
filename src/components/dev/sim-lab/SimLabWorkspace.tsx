"use client";

import { useState } from "react";
import { GameLabPanel } from "@/components/dev/sim-lab/GameLabPanel";
import { ScheduleLabPanel } from "@/components/dev/sim-lab/ScheduleLabPanel";
import { SeasonLabPanel } from "@/components/dev/sim-lab/SeasonLabPanel";
import type { SimLabPageConfig } from "@/components/dev/sim-lab/config";

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
      <h1 className="text-2xl font-semibold tracking-tight text-amber-500">
        Simulation Lab
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-zinc-400">
        Dev-only QA for production simulateGame and advanceSimulation. Not
        linked from Owner Mode navigation. Multi-season and 82-game schedule
        runs stay on the server and can take minutes — keep this tab open.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((item) => {
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              className={
                active
                  ? "rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950"
                  : "rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-amber-600"
              }
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

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
