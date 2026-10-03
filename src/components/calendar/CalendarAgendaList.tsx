"use client";

import type { CalendarDayCell as CalendarDayCellData } from "@/systems/calendar";
import {
  calendarDayAriaLabel,
  formatShortDate,
} from "@/components/calendar/CalendarDayCell";
import { cn, touchTargetClass } from "@/components/ui/styles";

export function CalendarAgendaList(props: {
  days: readonly CalendarDayCellData[];
  selectedDate: string;
  disabled?: boolean;
  onSelectDate: (date: string) => void;
}) {
  const disabled = props.disabled === true;
  const days = props.days.filter((cell) => cell.inMonth);

  return (
    <ul className="space-y-2">
      {days.map((cell) => {
        const teamGame = cell.teamGame;
        const specialCount = cell.specialEvents.length;
        const selected = cell.date === props.selectedDate;
        const summary = teamGame
          ? `${teamGame.homeAwayLabel} vs ${teamGame.opponentAbbreviation}${
              teamGame.resultLabel ? ` · ${teamGame.resultLabel}` : ""
            }`
          : specialCount > 0
            ? specialCount === 1
              ? "Event"
              : `${specialCount} events`
            : "No team game";

        return (
          <li key={cell.date}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!disabled) props.onSelectDate(cell.date);
              }}
              aria-label={calendarDayAriaLabel(cell)}
              aria-pressed={selected}
              className={cn(
                touchTargetClass,
                "w-full justify-between gap-3 rounded-lg border px-3 text-left",
                cell.isToday
                  ? "border-amber-500 bg-amber-950/40"
                  : "border-zinc-800 bg-zinc-950/50",
                cell.isNextTeamGame && !cell.isToday
                  ? "border-sky-700/50 ring-2 ring-sky-500/70"
                  : "",
                selected ? "ring-2 ring-amber-500/80" : "",
                disabled ? "cursor-not-allowed opacity-50" : "",
              )}
            >
              <span className="min-w-0">
                <span className="block font-mono text-xs text-zinc-400">
                  {formatShortDate(cell.date)}
                </span>
                <span
                  className={cn(
                    "block truncate text-sm",
                    cell.isToday ? "font-medium text-amber-200" : "text-zinc-100",
                  )}
                >
                  {summary}
                </span>
              </span>
              {cell.isToday ? (
                <span className="shrink-0 font-mono text-[0.65rem] uppercase tracking-wide text-amber-400">
                  Today
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
