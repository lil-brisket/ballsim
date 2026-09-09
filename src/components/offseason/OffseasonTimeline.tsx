import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/owner/EmptyState";
import type { OffseasonTimelineEvent } from "@/state/offseason-hub-selectors";

const STATUS_TONE: Record<OffseasonTimelineEvent["status"], string> = {
  upcoming: "info",
  active: "active",
  completed: "completed",
};

export function OffseasonTimeline(props: {
  events: readonly OffseasonTimelineEvent[];
}) {
  if (props.events.length === 0) {
    return (
      <EmptyState message="No upcoming offseason events on the calendar." />
    );
  }

  return (
    <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
      {props.events.map((event) => {
        const content = (
          <>
            <div>
              <p className="font-medium text-zinc-100">{event.label}</p>
              <p className="font-mono text-xs text-zinc-500">
                {event.date ?? "Date pending"}
              </p>
            </div>
            <StatusBadge
              label={event.status}
              tone={STATUS_TONE[event.status]}
            />
          </>
        );

        return (
          <li key={event.key}>
            {event.href ? (
              <Link
                href={event.href}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-zinc-900/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                {content}
              </Link>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
