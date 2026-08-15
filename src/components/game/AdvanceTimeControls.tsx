"use client";

import { useFormStatus } from "react-dom";
import {
  advanceDayAction,
  advanceUntilPhaseAction,
  advanceWeekAction,
} from "@/application/actions";

function AdvanceButton(props: {
  label: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const disabled = props.disabled || pending;
  const primaryClass =
    "rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500";
  const secondaryClass =
    "rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-amber-600 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500";

  return (
    <button
      type="submit"
      disabled={disabled}
      aria-busy={pending}
      className={props.primary ? primaryClass : secondaryClass}
    >
      {pending ? "Advancing…" : props.label}
    </button>
  );
}

/**
 * Wraps existing advance day/week/phase server actions.
 * Does not implement a second time-advance mechanism.
 */
export function AdvanceTimeControls(props: {
  saveId: string;
  returnPath: string;
  simulationFrequency: string;
  disabled?: boolean;
}) {
  const preferWeekly = props.simulationFrequency === "weekly";

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Advance time">
      <form action={advanceDayAction}>
        <input type="hidden" name="saveId" value={props.saveId} />
        <input type="hidden" name="returnPath" value={props.returnPath} />
        <AdvanceButton
          label="Advance day"
          primary={!preferWeekly}
          disabled={props.disabled}
        />
      </form>
      <form action={advanceWeekAction}>
        <input type="hidden" name="saveId" value={props.saveId} />
        <input type="hidden" name="returnPath" value={props.returnPath} />
        <AdvanceButton
          label="Advance 7 days"
          primary={preferWeekly}
          disabled={props.disabled}
        />
      </form>
      <form action={advanceUntilPhaseAction}>
        <input type="hidden" name="saveId" value={props.saveId} />
        <input type="hidden" name="returnPath" value={props.returnPath} />
        <AdvanceButton label="Until next phase" disabled={props.disabled} />
      </form>
    </div>
  );
}
