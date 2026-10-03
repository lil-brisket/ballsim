"use client";

import { useSimulationActivity } from "@/components/game/simulation-activity";

export function SimulationPreviewAction(props: {
  saveId: string;
  returnPath: string;
  targetDate: string;
  disabled?: boolean;
  canSimulate: boolean;
  simulating?: boolean;
  onSimulate: (targetDate: string) => void;
}) {
  const { simulationPending } = useSimulationActivity();
  if (!props.canSimulate) {
    return null;
  }

  const busy = props.simulating === true || simulationPending;
  const disabled = props.disabled === true || busy;

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled}
        aria-busy={busy || undefined}
        onClick={() => {
          if (!disabled) {
            props.onSimulate(props.targetDate);
          }
        }}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
      >
        {busy ? "Simulating…" : "Simulate to date"}
      </button>
      {props.disabled ? (
        <p className="text-xs text-amber-400">
          Time advance is blocked until pending decisions are resolved.
        </p>
      ) : (
        <p className="text-xs text-zinc-500">
          Simulates all games through this date, including yours. CPU games
          use a fast box-score path.
        </p>
      )}
    </div>
  );
}
