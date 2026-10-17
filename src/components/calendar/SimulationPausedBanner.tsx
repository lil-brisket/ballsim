"use client";

import { buttonClass } from "@/components/ui/Button";
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
  /** When set, the primary button re-opens the in-place interrupt instead of navigating. */
  onResolve?: () => void;
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
              props.reason === "draft_clock" ? "Open Draft" : "Review Decision",
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
      className="space-y-4 rounded-xl border border-warning/50 border-l-4 border-l-warning bg-warning/10 px-4 py-4"
    >
      <div>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-warning">
          Simulation Paused
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide text-zinc-50">
          {longDate}
        </h2>
        {reasons.length > 1 ? (
          <p className="mt-1 text-sm text-zinc-200/90">
            {reasons.length} items need your attention
          </p>
        ) : null}
      </div>

      <ul className="space-y-2">
        {reasons.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-surface-line bg-surface-arena px-3 py-2"
          >
            <p className="text-sm font-medium text-zinc-50">{item.title}</p>
            {item.detail ? (
              <p className="mt-0.5 text-xs text-zinc-200/80">{item.detail}</p>
            ) : null}
            {item.href ? (
              <Link
                href={item.href}
                className="mt-2 inline-block text-xs font-medium text-team-ink hover:underline"
              >
                {item.hrefLabel ?? "Review"} →
              </Link>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        {props.onResolve ? (
          <button
            type="button"
            onClick={props.onResolve}
            className={buttonClass({ variant: "primary" })}
          >
            {props.reason === "draft_clock" ? "Open Draft" : "Resolve Decision"}
          </button>
        ) : props.resolveHref ? (
          <Link
            href={props.resolveHref}
            className={buttonClass({ variant: "primary" })}
          >
            {reasons.length > 1 ? "Review Actions" : "Resolve Decision"}
          </Link>
        ) : null}
        {props.continueHref ? (
          <Link
            href={props.continueHref}
            className={buttonClass({ variant: "secondary" })}
          >
            Continue Anyway
          </Link>
        ) : null}
      </div>
    </div>
  );
}
