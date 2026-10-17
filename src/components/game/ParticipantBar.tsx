"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  readyAllParticipantsAction,
  setParticipantReadyAction,
  switchParticipantAction,
} from "@/application/actions";
import { buildOwnerReturnPath } from "@/components/game/OwnerTeamSwitcher";
import type { DashboardSnapshot } from "@/state/selectors";
import { buttonClass } from "@/components/ui/Button";

type Participation = NonNullable<DashboardSnapshot["participation"]>;

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
  const online = participation.mode === "online";

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
      aria-label={
        online ? "Online league players" : "Local shared league players"
      }
      className="flex flex-col gap-2 border-t border-surface-line pt-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-zinc-100">
          {online ? "Signed in as" : "Playing as"}{" "}
          <strong>{active?.displayName ?? "Unknown"}</strong>
          {activeIsHost ? (
            <span className="ml-2 rounded-full border border-team-ink px-2 py-0.5 text-xs font-medium text-team-ink">
              Host
            </span>
          ) : null}
        </p>

        {online ? (
          <Link
            href={`/dashboard/${saveId}/league-members`}
            className={buttonClass({ variant: "secondary" })}
          >
            League members
          </Link>
        ) : null}

        {(online ? [] : others).map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={pending}
            title={`Hand the device to ${p.displayName} (shared device, not a login)`}
            onClick={() =>
              submit(switchParticipantAction, { participantId: p.id })
            }
            className={buttonClass({ variant: "secondary" })}
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
            className={buttonClass({ variant: "secondary" })}
          >
            {active.isReady ? "Not ready" : "I'm ready"}
          </button>
        ) : null}

        {activeIsHost && !confirmingAll ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmingAll(true)}
            className={buttonClass({ variant: "secondary" })}
          >
            Advance for everyone
          </button>
        ) : null}
      </div>

      {activeIsHost && confirmingAll ? (
        <div
          role="alertdialog"
          aria-label="Confirm advance for everyone"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2 text-sm text-zinc-200"
        >
          <span>
            Other players may not have finished their turn. Mark everyone ready?
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => submit(readyAllParticipantsAction, {})}
            className={buttonClass({ variant: "secondary" })}
          >
            Yes, mark everyone ready
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmingAll(false)}
            className={buttonClass({ variant: "secondary" })}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div aria-live="polite" className="text-sm text-zinc-400">
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {participation.participants.map((p) => (
            <li key={p.id}>
              {p.displayName}: {p.isReady ? "✓ ready" : "waiting"}
            </li>
          ))}
        </ul>
        {participation.advanceBlockedReason ? (
          <p className="mt-1 text-warning">
            {participation.advanceBlockedReason}
          </p>
        ) : null}
      </div>
    </section>
  );
}
