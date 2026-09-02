"use client";

import Link from "next/link";

export function SimulationPausedBanner(props: {
  reason: "draft_clock" | "owner_decision" | null;
  message: string | null;
  resolveHref: string | null;
  currentDate: string;
}) {
  if (!props.reason || !props.message) {
    return null;
  }

  return (
    <div
      role="status"
      className="space-y-3 rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3"
    >
      <div>
        <p className="text-sm font-medium text-amber-200">Simulation Paused</p>
        <p className="mt-0.5 font-mono text-xs text-amber-300/80">{props.currentDate}</p>
      </div>
      <p className="text-sm text-amber-100/90">{props.message}</p>
      <p className="text-xs text-amber-100/70">
        Simulation cannot continue until this is resolved.
      </p>
      {props.resolveHref ? (
        <Link
          href={props.resolveHref}
          className="inline-block rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
        >
          Resolve Decision
        </Link>
      ) : null}
    </div>
  );
}
