"use client";

import { buttonClass } from "@/components/ui/Button";
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
        className={`${buttonClass({ variant: "primary" })} w-full`}
      >
        {busy ? "Simulating…" : "Simulate to date"}
      </button>
      {props.disabled ? (
        <p className="text-sm text-warning">
          Time advance is blocked until pending decisions are resolved.
        </p>
      ) : (
        <p className="text-sm text-zinc-500">
          Simulates all games through this date, including yours. CPU games use
          a fast box-score path.
        </p>
      )}
    </div>
  );
}
