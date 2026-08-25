"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  advanceDayAction,
  advanceUntilPhaseAction,
  advanceWeekAction,
} from "@/application/actions";

function AdvanceButton(props: {
  label: string;
  pendingLabel: string;
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
      {pending ? props.pendingLabel : props.label}
    </button>
  );
}

function SimulationProgressStatus(props: { message: string }) {
  const { pending } = useFormStatus();
  if (!pending) {
    return null;
  }
  return (
    <p
      role="status"
      aria-live="polite"
      className="text-sm text-amber-300/90"
    >
      {props.message}
    </p>
  );
}

/**
 * Phase-aware advance controls. Uses existing server actions only.
 * Shows descriptive pending copy so longer jumps do not feel frozen.
 */
export function AdvanceTimeControls(props: {
  saveId: string;
  returnPath: string;
  simulationFrequency: string;
  disabled?: boolean;
  untilPhaseLabel?: string;
  unresolvedWarning?: string | null;
  requiresConfirm?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
  letAiHandleAction?: (formData: FormData) => void | Promise<void>;
  continueAnywayAction?: (formData: FormData) => void | Promise<void>;
  goToHref?: string;
}) {
  const preferWeekly = props.simulationFrequency === "weekly";
  const untilLabel = props.untilPhaseLabel
    ? `Until ${props.untilPhaseLabel}`
    : "Until next phase";
  const [dialogOpen, setDialogOpen] = useState(false);

  const showWarning = Boolean(props.unresolvedWarning);

  return (
    <div className="space-y-2">
      {showWarning ? (
        <p
          role="status"
          className="text-sm text-amber-400"
        >
          ⚠ {props.unresolvedWarning}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Advance time">
        <form action={advanceDayAction} className="space-y-1">
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />
          <AdvanceButton
            label="Advance day"
            pendingLabel="Simulating day…"
            primary={!preferWeekly}
            disabled={props.disabled}
          />
          <SimulationProgressStatus message="Simulating next day — games, standings, and franchise updates…" />
        </form>
        <form action={advanceWeekAction} className="space-y-1">
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />
          <AdvanceButton
            label="Advance 7 days"
            pendingLabel="Simulating week…"
            primary={preferWeekly}
            disabled={props.disabled}
          />
          <SimulationProgressStatus message="Simulating 7 days — this may take a few seconds…" />
        </form>
        {props.requiresConfirm && showWarning ? (
          <button
            type="button"
            disabled={props.disabled}
            onClick={() => setDialogOpen(true)}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-amber-600 disabled:opacity-40"
          >
            {untilLabel}
          </button>
        ) : (
          <form action={advanceUntilPhaseAction} className="space-y-1">
            <input type="hidden" name="saveId" value={props.saveId} />
            <input type="hidden" name="returnPath" value={props.returnPath} />
            <AdvanceButton
              label={untilLabel}
              pendingLabel="Simulating until next phase…"
              disabled={props.disabled}
            />
            <SimulationProgressStatus message="Advancing until the next phase — progress continues in the background; please wait…" />
          </form>
        )}
      </div>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="phase-transition-title"
            className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-xl"
          >
            <h3
              id="phase-transition-title"
              className="text-lg font-medium text-zinc-50"
            >
              {props.confirmTitle ?? "Unresolved decisions"}
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              {props.confirmDescription ??
                props.unresolvedWarning ??
                "This phase still has unresolved decisions."}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500"
              >
                Cancel
              </button>
              {props.goToHref ? (
                <a
                  href={props.goToHref}
                  className="rounded-md border border-amber-600/60 px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-950/50"
                >
                  Handle manually
                </a>
              ) : null}
              {props.letAiHandleAction ? (
                <form action={props.letAiHandleAction}>
                  <input type="hidden" name="saveId" value={props.saveId} />
                  <input
                    type="hidden"
                    name="returnPath"
                    value={props.returnPath}
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-zinc-50 hover:bg-emerald-600"
                  >
                    Let AI Handle
                  </button>
                </form>
              ) : null}
              {props.continueAnywayAction ? (
                <form action={props.continueAnywayAction}>
                  <input type="hidden" name="saveId" value={props.saveId} />
                  <input
                    type="hidden"
                    name="returnPath"
                    value={props.returnPath}
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500"
                  >
                    Continue Anyway
                  </button>
                </form>
              ) : (
                <form action={advanceUntilPhaseAction}>
                  <input type="hidden" name="saveId" value={props.saveId} />
                  <input
                    type="hidden"
                    name="returnPath"
                    value={props.returnPath}
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500"
                  >
                    Continue Anyway
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
