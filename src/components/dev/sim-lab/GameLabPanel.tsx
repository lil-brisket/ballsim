"use client";

import { useState, useTransition } from "react";
import { runGameLabAction } from "@/app/dev/sim-lab/actions";
import type { GameLabSuccess } from "@/application/sim-lab";
import {
  LabBusyBanner,
  useLabRunElapsed,
} from "@/components/dev/sim-lab/LabBusyBanner";
import { LabReportView } from "@/components/dev/sim-lab/LabReportView";
import {} from "@/components/dev/sim-lab/format";
import { ErrorState } from "@/components/ui/EmptyState";
import { panelClass } from "@/components/ui/styles";
import { Button } from "@/components/ui/Button";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { Select } from "@/components/ui/Select";

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
        <div className="text-sm text-zinc-400">
          <span className="block">Seed</span>
          <NumberStepper
            className="mt-1"
            aria-label="Seed"
            value={seed}
            disabled={pending}
            onValueChange={setSeed}
          />
        </div>
        <div className="text-sm text-zinc-400">
          <span className="block">Games (max {props.maxGames})</span>
          <NumberStepper
            className="mt-1"
            aria-label="Games"
            min={1}
            max={props.maxGames}
            value={games}
            disabled={pending}
            onValueChange={setGames}
          />
        </div>
        <label className="text-sm text-zinc-400">
          Scenario
          <Select
            wrapperClassName="mt-1 w-full"
            value={scenarioId}
            disabled={pending}
            onChange={(event) => setScenarioId(event.target.value)}
          >
            {props.scenarioIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm text-zinc-400">
          Rotation
          <Select
            wrapperClassName="mt-1 w-full"
            value={rotation}
            disabled={pending}
            onChange={(event) =>
              setRotation(event.target.value === "off" ? "off" : "on")
            }
          >
            <option value="on">on</option>
            <option value="off">off</option>
          </Select>
        </label>
      </div>

      <Button variant="primary" disabled={pending} onClick={onRun}>
        {pending ? "Running games…" : "Run game batch"}
      </Button>
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
