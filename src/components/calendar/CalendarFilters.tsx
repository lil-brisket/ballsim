"use client";

import {
  CALENDAR_FILTERS,
  type CalendarFilter,
} from "@/domain/entities/calendar-event";

const FILTER_LABELS: Record<CalendarFilter, string> = {
  all: "All",
  game: "Games",
  team: "Team",
  league: "League",
  transaction: "Transactions",
  injury: "Injuries",
  deadline: "Deadlines",
  news: "News",
  action_required: "Action Required",
};

export function CalendarFilters(props: {
  value: CalendarFilter;
  onChange: (filter: CalendarFilter) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Calendar filters"
      className="flex flex-wrap gap-1.5"
    >
      {CALENDAR_FILTERS.map((filter) => {
        const active = props.value === filter;
        return (
          <button
            key={filter}
            type="button"
            onClick={() => props.onChange(filter)}
            aria-pressed={active}
            className={[
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              active
                ? "border-amber-600/70 bg-amber-950/50 text-amber-200"
                : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200",
            ].join(" ")}
          >
            {FILTER_LABELS[filter]}
          </button>
        );
      })}
    </div>
  );
}
