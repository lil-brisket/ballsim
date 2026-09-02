"use client";

import { useFormStatus } from "react-dom";
import {
  advanceDayAction,
  advanceWeekAction,
  advanceMonthAction,
  simulateToEndOfSeasonAction,
  simulateToNextDeadlineAction,
  simulateToNextDecisionAction,
  simulateToNextGameAction,
  simulateToNextImportantAction,
} from "@/application/actions";
import type { SimulationTarget } from "@/systems/calendar";

function ShortcutButton(props: {
  label: string;
  pendingLabel: string;
  hint?: string | null;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const disabled = props.disabled || pending;
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-busy={pending}
      title={props.hint ?? undefined}
      className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
    >
      {pending ? props.pendingLabel : props.label}
    </button>
  );
}

function targetHint(target: SimulationTarget | null): string | null {
  if (!target) return "No target found";
  const title = target.event?.title;
  return title
    ? `${target.date} · ${title} (${target.daysUntil}d)`
    : `${target.date} (${target.daysUntil}d)`;
}

export function SimulationShortcuts(props: {
  saveId: string;
  returnPath: string;
  disabled?: boolean;
  nextTargets: {
    nextGame: SimulationTarget | null;
    nextImportant: SimulationTarget | null;
    nextDecision: SimulationTarget | null;
    nextDeadline: SimulationTarget | null;
  };
}) {
  const { nextTargets } = props;

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        Simulation shortcuts
      </p>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Simulation shortcuts"
      >
        <form action={advanceDayAction}>
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />
          <ShortcutButton
            label="1 Day"
            pendingLabel="Simulating…"
            disabled={props.disabled}
          />
        </form>
        <form action={simulateToNextGameAction}>
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />
          <ShortcutButton
            label="Next Game"
            pendingLabel="Simulating…"
            hint={targetHint(nextTargets.nextGame)}
            disabled={props.disabled || !nextTargets.nextGame}
          />
        </form>
        <form action={simulateToNextImportantAction}>
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />
          <ShortcutButton
            label="Next Important Event"
            pendingLabel="Simulating…"
            hint={targetHint(nextTargets.nextImportant)}
            disabled={props.disabled || !nextTargets.nextImportant}
          />
        </form>
        <form action={simulateToNextDecisionAction}>
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />
          <ShortcutButton
            label="Next Decision"
            pendingLabel="Simulating…"
            hint={targetHint(nextTargets.nextDecision)}
            disabled={props.disabled}
          />
        </form>

        <form action={advanceWeekAction}>
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />
          <ShortcutButton
            label="Next Week"
            pendingLabel="Simulating…"
            disabled={props.disabled}
          />
        </form>
        <form action={advanceMonthAction}>
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />
          <ShortcutButton
            label="Next Month"
            pendingLabel="Simulating…"
            disabled={props.disabled}
          />
        </form>
        <form action={simulateToEndOfSeasonAction}>
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />
          <ShortcutButton
            label="End of Season"
            pendingLabel="Simulating…"
            disabled={props.disabled}
          />
        </form>
        <form action={simulateToNextDeadlineAction}>
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />
          <ShortcutButton
            label="Next Deadline"
            pendingLabel="Simulating…"
            hint={targetHint(nextTargets.nextDeadline)}
            disabled={props.disabled || !nextTargets.nextDeadline}
          />
        </form>
      </div>
    </div>
  );
}
