import Link from "next/link";
import type { CalendarEventView } from "@/domain/entities/calendar-event";
import {
  CALENDAR_EVENT_CATEGORIES,
  type CalendarEventCategory,
} from "@/domain/entities/calendar-event";
import { StatusBadge } from "@/components/owner/StatusBadge";

const CATEGORY_LABELS: Record<CalendarEventCategory, string> = {
  game: "Games",
  transaction: "Transactions",
  injury: "Injuries",
  league: "League",
  team: "Team",
  deadline: "Deadlines",
  news: "News",
  action_required: "Action Required",
};

function lifecycleBadge(lifecycle: CalendarEventView["lifecycle"]): {
  label: string;
  tone: string;
} | null {
  switch (lifecycle) {
    case "scheduled":
      return { label: "Scheduled", tone: "info" };
    case "occurred":
      return { label: "Occurred", tone: "completed" };
    case "action_required":
      return { label: "Action Required", tone: "warning" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" };
    default:
      return null;
  }
}

function groupByCategory(
  events: readonly CalendarEventView[],
): { category: CalendarEventCategory; events: CalendarEventView[] }[] {
  const buckets = new Map<CalendarEventCategory, CalendarEventView[]>();
  for (const event of events) {
    const list = buckets.get(event.category);
    if (list) {
      list.push(event);
    } else {
      buckets.set(event.category, [event]);
    }
  }
  return CALENDAR_EVENT_CATEGORIES.filter((category) =>
    buckets.has(category),
  ).map((category) => ({
    category,
    events: buckets.get(category)!,
  }));
}

export function CalendarDayDetail(props: {
  date: string;
  events: readonly CalendarEventView[];
  currentDate: string;
  onClose?: () => void;
  teamGame?: {
    gameId: string;
    opponentLabel: string;
    home: boolean;
    status: string;
    scoreLabel: string | null;
  } | null;
}) {
  const isFuture = props.date > props.currentDate;
  const isToday = props.date === props.currentDate;
  const groups = groupByCategory(props.events);

  return (
    <aside className="flex h-full flex-col rounded-lg border border-zinc-800 bg-zinc-950/50">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div>
          <h3 className="text-base font-medium text-zinc-100">Day detail</h3>
          <p className="mt-0.5 font-mono text-sm text-amber-400/90">
            {props.date}
            {isToday ? (
              <span className="ml-2 text-xs uppercase tracking-wide text-amber-300">
                today
              </span>
            ) : null}
            {isFuture ? (
              <span className="ml-2 text-xs uppercase tracking-wide text-zinc-500">
                upcoming
              </span>
            ) : null}
          </p>
        </div>
        {props.onClose ? (
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500 lg:hidden"
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <section className="space-y-2 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-3">
          <h4 className="text-xs uppercase tracking-wide text-zinc-500">Your team</h4>
          {props.teamGame ? (
            <div className="space-y-1">
              <p className="text-sm text-zinc-100">
                {props.teamGame.home ? "vs" : "@"} {props.teamGame.opponentLabel}
              </p>
              <p className="text-xs text-zinc-400">
                {props.teamGame.status}
                {props.teamGame.scoreLabel ? ` · ${props.teamGame.scoreLabel}` : ""}
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No Game</p>
          )}
        </section>
        {groups.length === 0 ? (
          <p className="text-sm text-zinc-500">No events on this date.</p>
        ) : (
          groups.map((group) => (
            <section key={group.category} className="space-y-2">
              <h4 className="text-xs uppercase tracking-wide text-zinc-500">
                {CATEGORY_LABELS[group.category]}
              </h4>
              <ul className="space-y-2">
                {group.events.map((event) => {
                  const badge = lifecycleBadge(event.lifecycle);
                  const body = (
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-zinc-100">
                          {event.title}
                        </span>
                        {badge ? (
                          <StatusBadge label={badge.label} tone={badge.tone} />
                        ) : null}
                        {event.blocking ? (
                          <StatusBadge label="Blocking" tone="critical" />
                        ) : null}
                      </div>
                      {event.description ? (
                        <p className="text-xs text-zinc-400">
                          {event.description}
                        </p>
                      ) : null}
                    </div>
                  );
                  return (
                    <li
                      key={event.id}
                      className="rounded-md border border-zinc-800/80 bg-zinc-900/40 px-3 py-2"
                    >
                      {event.href ? (
                        <Link
                          href={event.href}
                          className="block hover:border-amber-600/40"
                        >
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
        {isFuture ? (
          <p className="text-xs text-zinc-600">
            Future dates show scheduled and action-required items only. Projected
            trades and speculative injuries are never shown.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
