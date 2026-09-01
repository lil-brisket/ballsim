"use client";

import type { CalendarMonthGrid } from "@/systems/calendar";
import { CalendarDayCell } from "@/components/calendar/CalendarDayCell";

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

export function CalendarMonthView(props: {
  grid: CalendarMonthGrid;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onChangeMonth: (year: number, month: number) => void;
  onJumpToday: () => void;
}) {
  const title = `${MONTH_NAMES[props.grid.month - 1]} ${props.grid.year}`;
  const prev = shiftMonth(props.grid.year, props.grid.month, -1);
  const next = shiftMonth(props.grid.year, props.grid.month, 1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium text-zinc-100">{title}</h2>
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
    </div>
  );
}
