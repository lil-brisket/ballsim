"use client";

import { useSimulationActivity } from "@/components/game/simulation-activity";
import { focusRingClass } from "@/components/ui/styles";

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
        className={`inline-flex min-h-11 w-full items-center justify-center rounded-md bg-team px-4 py-2 text-sm font-medium text-on-team hover:brightness-110 disabled:opacity-40 ${focusRingClass}`}
      >
        {busy ? "Simulating…" : "Simulate to date"}
      </button>
      {props.disabled ? (
        <p className="text-xs text-warning">
          Time advance is blocked until pending decisions are resolved.
        </p>
      ) : (
        <p className="text-xs text-zinc-500">
          Simulates all games through this date, including yours. CPU games use
          a fast box-score path.
        </p>
      )}
    </div>
  );
}
