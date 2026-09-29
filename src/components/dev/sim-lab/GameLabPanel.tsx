"use client";

import { useState, useTransition } from "react";
import { runGameLabAction } from "@/app/dev/sim-lab/actions";
import type { GameLabSuccess } from "@/application/sim-lab";
import {
  LabBusyBanner,
  useLabRunElapsed,
} from "@/components/dev/sim-lab/LabBusyBanner";
import { LabReportView } from "@/components/dev/sim-lab/LabReportView";
import {
  labFieldClass,
  labPrimaryButtonClass,
} from "@/components/dev/sim-lab/format";
import { ErrorState } from "@/components/ui/EmptyState";
import { panelClass } from "@/components/ui/styles";

export function GameLabPanel(props: {
  scenarioIds: readonly string[];
  maxGames: number;
}) {
  const defaultScenario = props.scenarioIds[0] ?? "normal";
  const [seed, setSeed] = useState(42);
  const [games, setGames] = useState(25);
  const [scenarioId, setScenarioId] = useState(defaultScenario);
  const [rotation, setRotation] = useState<"on" | "off">("on");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GameLabSuccess | null>(null);
  const [pending, startTransition] = useTransition();
  const elapsedMs = useLabRunElapsed(pending);

  function onRun() {
    setError(null);
    startTransition(async () => {
      const next = await runGameLabAction({
        seed,
        games,
        scenarioId,
        rotation,
      });
      if (!next.ok) {
        setResult(null);
        setError(next.error);
        return;
      }
      setResult(next);
    });
  }

  return (
    <div className="space-y-4">
      <div
        className={`${panelClass} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4`}
      >
        <label className="text-sm text-zinc-400">
          Seed
          <input
            className={`${labFieldClass} mt-1`}
            type="number"
            value={seed}
            disabled={pending}
            onChange={(event) => setSeed(Number(event.target.value))}
          />
        </label>
        <label className="text-sm text-zinc-400">
          Games (max {props.maxGames})
          <input
            className={`${labFieldClass} mt-1`}
            type="number"
            min={1}
            max={props.maxGames}
            value={games}
            disabled={pending}
            onChange={(event) => setGames(Number(event.target.value))}
          />
        </label>
        <label className="text-sm text-zinc-400">
          Scenario
          <select
            className={`${labFieldClass} mt-1`}
            value={scenarioId}
            disabled={pending}
            onChange={(event) => setScenarioId(event.target.value)}
          >
            {props.scenarioIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-zinc-400">
          Rotation
          <select
            className={`${labFieldClass} mt-1`}
            value={rotation}
            disabled={pending}
            onChange={(event) =>
              setRotation(event.target.value === "off" ? "off" : "on")
            }
          >
            <option value="on">on</option>
            <option value="off">off</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        className={labPrimaryButtonClass}
        disabled={pending}
        onClick={onRun}
      >
        {pending ? "Running games…" : "Run game batch"}
      </button>
      <LabBusyBanner pending={pending} elapsedMs={elapsedMs} />

      {error ? <ErrorState message={error} /> : null}
      {result ? (
        <LabReportView
          report={result.report}
          wallMs={result.wallMs}
          channelExitPr={result.channelExitPr}
          channelExitNightly={result.channelExitNightly}
        />
      ) : null}
    </div>
  );
}
