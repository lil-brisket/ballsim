"use client";

import { useFormStatus } from "react-dom";
import { simulateToDateAction } from "@/application/actions";

function SimulateSubmitButton(props: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  const disabled = props.disabled || pending;
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-busy={pending}
      className="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
    >
      {pending ? "Simulating…" : "Simulate to date"}
    </button>
  );
}

/**
 * Sole calendar simulation control — calls simulateToDateAction.
 * No stop-condition UI; empty stop conditions advance through to the target.
 */
export function SimulationPreviewAction(props: {
  saveId: string;
  returnPath: string;
  targetDate: string;
  disabled?: boolean;
  canSimulate: boolean;
}) {
  if (!props.canSimulate) {
    return null;
  }

  return (
    <form action={simulateToDateAction} className="space-y-2">
      <input type="hidden" name="saveId" value={props.saveId} />
      <input type="hidden" name="returnPath" value={props.returnPath} />
      <input type="hidden" name="targetDate" value={props.targetDate} />
      <SimulateSubmitButton disabled={props.disabled} />
      {props.disabled ? (
        <p className="text-xs text-amber-400">
          Time advance is blocked until pending decisions are resolved.
        </p>
      ) : (
        <p className="text-xs text-zinc-500">
          Uses the existing Owner Mode simulation pipeline.
        </p>
      )}
    </form>
  );
}
