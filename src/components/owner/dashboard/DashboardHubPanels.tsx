import Link from "next/link";
import type { OwnerDashboardNextEvent } from "@/state/owner-dashboard";
import { EmptyState } from "@/components/owner/EmptyState";
import { EventCard } from "@/components/game/EventCard";
import { Section } from "@/components/owner/Section";

/** @deprecated Prefer AroundTheLeaguePanel — kept for offseason / legacy pages. */
export { AroundTheLeaguePanel as LeagueNewsPanel } from "@/components/owner/dashboard/AroundTheLeaguePanel";

/** @deprecated Prefer NextGamePanel from its own module. */
export { NextGamePanel } from "@/components/owner/dashboard/NextGamePanel";

export function NextImportantEventPanel(props: {
  event: OwnerDashboardNextEvent | null;
  saveId: string;
}) {
  const calendarHref = `/dashboard/${props.saveId}/calendar`;
  const event = props.event;

  return (
    <Section
      title="Next Important Event"
      action={
        <Link
          href={calendarHref}
          className="text-sm text-amber-400 hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          Calendar
        </Link>
      }
    >
      {!event ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4">
          <EmptyState message="No high-importance events on the horizon." />
        </div>
      ) : (
        <ul className="space-y-2">
          <EventCard
            title={event.title}
            description={
              event.description ??
              (event.daysUntil === 0
                ? "Today"
                : `${event.daysUntil} day${event.daysUntil === 1 ? "" : "s"} away`)
            }
            date={event.date}
            type={event.category}
            severity={event.blocking ? "warning" : undefined}
          />
          <li className="list-none px-1">
            <Link
              href={event.href ?? calendarHref}
              className="text-sm text-amber-400 hover:text-amber-300"
            >
              {event.href ? "Open event" : "Open Calendar"}
            </Link>
          </li>
        </ul>
      )}
    </Section>
  );
}
