"use client";

import { useEffect, useState } from "react";
import { formatDurationMs } from "@/components/dev/sim-lab/format";
import { SimulationProgressBanner } from "@/components/game/SimulationProgressBanner";

export function useLabRunElapsed(pending: boolean): number {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!pending) {
      setElapsedMs(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - started);
    }, 250);
    return () => window.clearInterval(id);
  }, [pending]);

  return elapsedMs;
}

export function LabBusyBanner(props: { pending: boolean; elapsedMs: number }) {
  if (!props.pending) {
    return null;
  }
  return (
    <SimulationProgressBanner
      seasonYear={1}
      phase="Simulation Lab"
      currentDate={`elapsed ${formatDurationMs(props.elapsedMs)}`}
      busy
    />
  );
}
