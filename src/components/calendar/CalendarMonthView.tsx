"use client";

import type { CalendarMonthGrid } from "@/systems/calendar";
import { collectLegendMilestones } from "@/systems/calendar/league-milestone-markers";
import {
  CalendarDayCell,
  formatShortDate,
} from "@/components/calendar/CalendarDayCell";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(index / 12),
    month: (index % 12) + 1,
  };
}

function CalendarMilestoneLegend(props: { grid: CalendarMonthGrid }) {
  const monthMarkers = props.grid.weeks
    .flat()
    .flatMap((cell) => cell.leagueMilestones);
  const legend = collectLegendMilestones(monthMarkers);

  if (legend.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">
        League milestones
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {legend.map((milestone) => (
          <span
            key={milestone.key}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-300"
          >
            <span
              className={[
                "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                milestone.chipClass,
              ].join(" ")}
            >
              {milestone.shortLabel}
            </span>
            <span className="text-zinc-500">{milestone.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function CalendarMonthView(props: {
  grid: CalendarMonthGrid;
  selectedDate: string;
  currentDate: string;
  nextTeamGameDate: string | null;
  onSelectDate: (date: string) => void;
  onChangeMonth: (year: number, month: number) => void;
  onJumpToday: () => void;
  onJumpNextGame: () => void;
}) {
  const title = `${MONTH_NAMES[props.grid.month - 1]} ${props.grid.year}`;
  const prev = shiftMonth(props.grid.year, props.grid.month, -1);
  const next = shiftMonth(props.grid.year, props.grid.month, 1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-medium text-zinc-100">{title}</h2>
          <p className="text-xs text-zinc-500">
            Current date{" "}
            <span className="font-mono font-medium text-amber-300">
              {props.currentDate}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => props.onChangeMonth(prev.year, prev.month)}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={props.onJumpToday}
            className="rounded-md border border-amber-700/50 bg-amber-950/30 px-3 py-1.5 text-sm text-amber-200 hover:border-amber-500"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => props.onChangeMonth(next.year, next.month)}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600"
          >
            Next
          </button>
          {props.nextTeamGameDate ? (
            <button
              type="button"
              onClick={props.onJumpNextGame}
              className="rounded-md border border-sky-700/50 bg-sky-950/30 px-3 py-1.5 text-sm text-sky-200 hover:border-sky-500"
            >
              Next Game → {formatShortDate(props.nextTeamGameDate)}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="px-1 py-1 text-center text-[10px] uppercase tracking-wide text-zinc-500 sm:text-xs"
          >
            {day}
          </div>
        ))}
        {props.grid.weeks.flatMap((week) =>
          week.map((cell) => (
            <CalendarDayCell
              key={cell.date}
              cell={cell}
              selected={cell.date === props.selectedDate}
              onSelect={props.onSelectDate}
            />
          )),
        )}
      </div>

      <CalendarMilestoneLegend grid={props.grid} />
    </div>
  );
}
