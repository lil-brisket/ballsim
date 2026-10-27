import Link from "next/link";
import { cn, focusRingClass } from "@/components/ui/styles";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatGameDate } from "@/presentation/game-date";
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
    <ul className="divide-y divide-line rounded-xl border border-line">
      {props.events.map((event) => {
        const content = (
          <>
            <div>
              <p className="font-medium text-ink">{event.label}</p>
              <p className="text-sm text-faint">
                {event.date ? formatGameDate(event.date) : "Date pending"}
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
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-surface-raised/60",
                  focusRingClass,
                )}
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
