"use client";

import Link from "next/link";
import { parseCalendarDate } from "@/domain/calendar-date";

export type SimulationPauseReasonItem = {
  id: string;
  title: string;
  detail?: string;
  href?: string;
  hrefLabel?: string;
};

/**
 * Explicit "why did it stop?" pause experience.
 */
export function SimulationPausedBanner(props: {
  reason: "draft_clock" | "owner_decision" | null;
  message: string | null;
  resolveHref: string | null;
  currentDate: string;
  /** Optional structured reasons when available from summary/attention. */
  reasons?: SimulationPauseReasonItem[];
  continueHref?: string | null;
}) {
  if (!props.reason || !props.message) {
    return null;
  }

  const reasons =
    props.reasons && props.reasons.length > 0
      ? props.reasons
      : [
          {
            id: props.reason,
            title: props.message,
            href: props.resolveHref ?? undefined,
            hrefLabel:
              props.reason === "draft_clock"
                ? "Open Draft"
                : "Review Decision",
          },
        ];

  let longDate = props.currentDate;
  try {
    const { year, month, day } = parseCalendarDate(props.currentDate);
    const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    longDate = utc.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    // keep iso
  }

  return (
    <div
      role="status"
      className="space-y-4 rounded-xl border border-amber-700/50 bg-amber-950/40 px-4 py-4"
    >
      <div>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-amber-400">
          Simulation Paused
        </p>
        <h2 className="mt-1 text-lg font-medium text-amber-100">{longDate}</h2>
        {reasons.length > 1 ? (
          <p className="mt-1 text-sm text-amber-200/90">
            {reasons.length} items need your attention
          </p>
        ) : null}
      </div>

      <ul className="space-y-2">
        {reasons.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-amber-800/40 bg-amber-950/30 px-3 py-2"
          >
            <p className="text-sm font-medium text-amber-50">{item.title}</p>
            {item.detail ? (
              <p className="mt-0.5 text-xs text-amber-200/80">{item.detail}</p>
            ) : null}
            {item.href ? (
              <Link
                href={item.href}
                className="mt-2 inline-block text-xs font-medium text-amber-300 hover:text-amber-200"
              >
                {item.hrefLabel ?? "Review"} →
              </Link>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        {props.resolveHref ? (
          <Link
            href={props.resolveHref}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
          >
            {reasons.length > 1 ? "Review Actions" : "Resolve Decision"}
          </Link>
        ) : null}
        {props.continueHref ? (
          <Link
            href={props.continueHref}
            className="rounded-md border border-amber-700/60 px-4 py-2 text-sm text-amber-200 hover:border-amber-500"
          >
            Continue Anyway
          </Link>
        ) : null}
      </div>
    </div>
  );
}
