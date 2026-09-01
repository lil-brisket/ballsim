"use client";

import { useFormStatus } from "react-dom";
import { simulateToDateAction } from "@/application/actions";
import type { SimulationRangePreview } from "@/systems/calendar";

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

export function SimulateUntilPanel(props: {
  saveId: string;
  returnPath: string;
  targetDate: string;
  currentDate: string;
  preview: SimulationRangePreview | null;
  disabled?: boolean;
}) {
  const canSimulate =
    !props.disabled &&
    props.targetDate > props.currentDate &&
    props.preview !== null;

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
      <div>
        <h3 className="text-base font-medium text-zinc-100">Simulate until</h3>
        <p className="mt-1 font-mono text-sm text-amber-400/90">
          {props.targetDate}
        </p>
      </div>

      {props.targetDate <= props.currentDate ? (
        <p className="text-sm text-zinc-500">
          Select a future date to preview and confirm a simulation jump. Selecting
          a date alone does not advance time.
        </p>
      ) : props.preview ? (
        <div className="space-y-2 text-sm text-zinc-300">
          <p>
            <span className="text-zinc-500">Range:</span> {props.preview.fromDate}{" "}
            → {props.preview.toDate}{" "}
            <span className="font-mono text-zinc-400">
              ({props.preview.days} day{props.preview.days === 1 ? "" : "s"})
            </span>
          </p>
          <p>
            Your team games:{" "}
            <span className="font-mono text-zinc-100">
              {props.preview.yourTeam.games}
            </span>{" "}
            <span className="text-zinc-500">
              ({props.preview.yourTeam.home} home / {props.preview.yourTeam.away}{" "}
              away)
            </span>
          </p>
          <p>
            League games scheduled:{" "}
            <span className="font-mono text-zinc-100">
              {props.preview.league.games}
            </span>
          </p>
          {props.preview.deadlines.length > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Deadlines in range
              </p>
              <ul className="mt-1 space-y-0.5">
                {props.preview.deadlines.map((deadline) => (
                  <li key={deadline.id} className="text-zinc-400">
                    {deadline.date}: {deadline.title}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {props.preview.potentialInterruptions.length > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-500/80">
                May stop early
              </p>
              <ul className="mt-1 space-y-0.5 text-amber-200/80">
                {props.preview.potentialInterruptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {props.preview.systemsProcessing.length > 0 ? (
            <p className="text-xs text-zinc-500">
              Systems: {props.preview.systemsProcessing.join(", ")}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Unable to build a simulation preview.</p>
      )}

      <form action={simulateToDateAction} className="space-y-3">
        <input type="hidden" name="saveId" value={props.saveId} />
        <input type="hidden" name="returnPath" value={props.returnPath} />
        <input type="hidden" name="targetDate" value={props.targetDate} />

        <fieldset className="space-y-2" disabled={!canSimulate}>
          <legend className="text-xs uppercase tracking-wide text-zinc-500">
            Stop conditions
          </legend>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              name="stopBlockingDecision"
              value="1"
              defaultChecked
              className="rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500"
            />
            Stop on blocking decision
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              name="stopUserTeamGame"
              value="1"
              defaultChecked
              className="rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500"
            />
            Stop on your team&apos;s game
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              name="stopImportantEvent"
              value="1"
              defaultChecked
              className="rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500"
            />
            Stop on important event
          </label>
        </fieldset>

        <SimulateSubmitButton disabled={!canSimulate} />
        {props.disabled ? (
          <p className="text-xs text-amber-400">
            Time advance is blocked until pending decisions are resolved.
          </p>
        ) : null}
      </form>
    </div>
  );
}
