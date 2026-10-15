"use client";

import { useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  readyAllParticipantsAction,
  setParticipantReadyAction,
  switchParticipantAction,
} from "@/application/actions";
import { buildOwnerReturnPath } from "@/components/game/OwnerTeamSwitcher";
import type { DashboardSnapshot } from "@/state/selectors";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";

type Participation = NonNullable<DashboardSnapshot["participation"]>;

const buttonClass = cn(
  touchTargetClass,
  "rounded-lg border border-surface-line bg-surface-deep/60 px-3 text-sm text-zinc-200 hover:border-team-ink hover:text-team-ink disabled:opacity-50",
  focusRingClass,
);

/**
 * Hotseat controls for a Local Shared League: who is playing, hand the device
 * to another player, ready state, and (host only) force-advance.
 * Renders nothing for single-player saves.
 */
export function ParticipantBar(props: {
  saveId: string;
  participation: Participation | null;
}) {
  const { saveId, participation } = props;
  const [pending, startTransition] = useTransition();
  const [confirmingAll, setConfirmingAll] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!participation) {
    return null;
  }

  const active = participation.participants.find((p) => p.isActive);
  const others = participation.participants.filter((p) => !p.isActive);
  const activeIsHost = active?.isHost ?? false;

  function submit(
    action: (formData: FormData) => Promise<unknown>,
    fields: Record<string, string>,
  ) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("saveId", saveId);
      for (const [key, value] of Object.entries(fields)) {
        formData.set(key, value);
      }
      formData.set("returnPath", buildOwnerReturnPath(pathname, searchParams));
      await action(formData);
      setConfirmingAll(false);
    });
  }

  return (
    <section
      aria-label="Local shared league players"
      className="flex flex-col gap-2 border-t border-surface-line pt-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-zinc-100">
          Playing as <strong>{active?.displayName ?? "Unknown"}</strong>
          {activeIsHost ? (
            <span className="ml-2 rounded-full border border-team-ink px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-team-ink">
              Host
            </span>
          ) : null}
        </p>

        {others.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={pending}
            title={`Hand the device to ${p.displayName} (shared device, not a login)`}
            onClick={() =>
              submit(switchParticipantAction, { participantId: p.id })
            }
            className={buttonClass}
          >
            Pass to {p.displayName}
            <span className="sr-only">
              . Hand the device to {p.displayName}. This is a shared-device
              handoff, not a login.
            </span>
          </button>
        ))}

        {active ? (
          <button
            type="button"
            aria-pressed={active.isReady}
            disabled={pending}
            onClick={() =>
              submit(setParticipantReadyAction, {
                ready: active.isReady ? "false" : "true",
              })
            }
            className={buttonClass}
          >
            {active.isReady ? "Not ready" : "I'm ready"}
          </button>
        ) : null}

        {activeIsHost && !confirmingAll ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmingAll(true)}
            className={buttonClass}
          >
            Advance for everyone
          </button>
        ) : null}
      </div>

      {activeIsHost && confirmingAll ? (
        <div
          role="alertdialog"
          aria-label="Confirm advance for everyone"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-700/60 bg-amber-950/30 p-2 text-sm text-amber-100"
        >
          <span>
            Other players may not have finished their turn. Mark everyone ready?
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => submit(readyAllParticipantsAction, {})}
            className={buttonClass}
          >
            Yes, mark everyone ready
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmingAll(false)}
            className={buttonClass}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div aria-live="polite" className="text-xs text-zinc-400">
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {participation.participants.map((p) => (
            <li key={p.id}>
              {p.displayName}: {p.isReady ? "✓ ready" : "waiting"}
            </li>
          ))}
        </ul>
        {participation.advanceBlockedReason ? (
          <p className="mt-1 text-amber-300">
            {participation.advanceBlockedReason}
          </p>
        ) : null}
      </div>
    </section>
  );
}
