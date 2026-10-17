"use client";

import { useState, useTransition } from "react";
import { createLeagueInviteAction } from "@/application/actions/online-league";
import { buttonClass } from "@/components/ui/Button";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { cn, focusRingClass } from "@/components/ui/styles";

const inputClass = cn(
  "min-h-11 w-24 rounded-lg border border-surface-line bg-surface-deep/60 px-3 text-sm text-zinc-100",
  focusRingClass,
);

/**
 * Host form to create a league invite. The link is returned once by the server
 * action and held only in this component's state.
 */
export function InviteCreator(props: {
  saveId: string;
  defaultDays: number;
  maxDays: number;
  maxUses: number;
}) {
  const { saveId, defaultDays, maxDays, maxUses } = props;
  const [uses, setUses] = useState(maxUses);
  const [days, setDays] = useState(defaultDays);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLink(null);
    setCopied(false);
    startTransition(async () => {
      const result = await createLeagueInviteAction(saveId, {
        maxUses: uses,
        days: days,
      });
      if (result.ok) {
        setLink(`${window.location.origin}/join/${result.token}`);
      } else {
        setError(result.error);
      }
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={create} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Max uses (1–{maxUses})
          <NumberStepper
            min={1}
            max={maxUses}
            value={uses}
            onValueChange={setUses}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Days valid (1–{maxDays})
          <NumberStepper
            min={1}
            max={maxDays}
            value={days}
            onValueChange={setDays}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className={buttonClass({ variant: "primary" })}
        >
          Create invite link
        </button>
      </form>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-rose-800/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : null}

      {link ? (
        <div className="space-y-2 rounded-lg border border-emerald-800/60 bg-emerald-950/20 p-3">
          <input
            readOnly
            aria-label="Invite link"
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className={cn(inputClass, "w-full font-mono text-xs")}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={copy}
              className={buttonClass({ variant: "secondary" })}
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <p className="text-xs text-zinc-300">
              This link is shown once. Anyone with it can join while it has uses
              left.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
