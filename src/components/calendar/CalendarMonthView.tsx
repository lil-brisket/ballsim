"use client";

import { buttonClass } from "@/components/ui/Button";
import type { CalendarMonthGrid } from "@/systems/calendar";
import { collectLegendMilestones } from "@/systems/calendar/league-milestone-markers";
import {
  CalendarDayCell,
  formatShortDate,
} from "@/components/calendar/CalendarDayCell";
import { CalendarAgendaList } from "@/components/calendar/CalendarAgendaList";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { formatGameDate } from "@/presentation/game-date";
import { cn } from "@/components/ui/styles";
import type { TeamBrandingView } from "@/state/team-branding-view";

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
    <div className="rounded-lg border border-surface-line bg-surface-arena px-3 py-2">
      <p className="text-sm font-medium text-zinc-300">League milestones</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {legend.map((milestone) => (
          <span
            key={milestone.key}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-300"
          >
            <span
              className={[
                "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                milestone.chipClass,
              ].join(" ")}
            >
              {milestone.shortLabel}
            </span>
            <span className="text-zinc-400">{milestone.label}</span>
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
  navigationDisabled?: boolean;
  resultOverlays?: Readonly<Record<string, string>>;
  /** Branding by team id, for opponent badges on game days. */
  teamBranding?: Readonly<Record<string, TeamBrandingView>>;
  onSelectDate: (date: string) => void;
  onChangeMonth: (year: number, month: number) => void;
  onJumpToday: () => void;
  onJumpNextGame: () => void;
  layout?: "grid" | "agenda";
  simulating?: boolean;
}) {
  const title = `${MONTH_NAMES[props.grid.month - 1]} ${props.grid.year}`;
  const prev = shiftMonth(props.grid.year, props.grid.month, -1);
  const next = shiftMonth(props.grid.year, props.grid.month, 1);
  const disabled = props.navigationDisabled === true;
  const simulating = props.simulating === true;
  const lockClass = cn(
    disabled ? "pointer-events-none" : "",
    disabled && !simulating ? "opacity-60" : "",
  );
  const layout = props.layout ?? "grid";

  const liveDays = props.grid.weeks.flat().map((cell) => {
    const overlay = props.resultOverlays?.[cell.date];
    return {
      ...cell,
      isToday: cell.date === props.currentDate,
      isPast: cell.date < props.currentDate,
      isFuture: cell.date > props.currentDate,
      teamGame:
        cell.teamGame && overlay
          ? { ...cell.teamGame, resultLabel: overlay }
          : cell.teamGame,
    };
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <SectionHeading title={title} />
          <p className="text-sm text-zinc-400">
            Today is{" "}
            <span className="font-medium text-team-ink">
              {formatGameDate(props.currentDate, { weekday: true })}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => props.onChangeMonth(prev.year, prev.month)}
            className={buttonClass({ variant: "secondary" })}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={props.onJumpToday}
            className={buttonClass({ variant: "secondary" })}
          >
            Today
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => props.onChangeMonth(next.year, next.month)}
            className={buttonClass({ variant: "secondary" })}
          >
            Next
          </button>
          {props.nextTeamGameDate ? (
            <button
              type="button"
              disabled={disabled}
              onClick={props.onJumpNextGame}
              className={buttonClass({ variant: "secondary" })}
            >
              Next Game → {formatShortDate(props.nextTeamGameDate)}
            </button>
          ) : null}
        </div>
      </div>

      {layout === "agenda" ? (
        <div className={lockClass}>
          <CalendarAgendaList
            days={liveDays}
            selectedDate={props.selectedDate}
            disabled={disabled}
            onSelectDate={props.onSelectDate}
          />
        </div>
      ) : (
        <div className={cn("grid grid-cols-7 gap-1 sm:gap-1.5", lockClass)}>
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="px-1 py-1 text-center text-xs font-medium uppercase tracking-[0.14em] text-zinc-400"
            >
              {day}
            </div>
          ))}
          {liveDays.map((cell) => (
            <CalendarDayCell
              key={cell.date}
              cell={cell}
              selected={cell.date === props.selectedDate}
              disabled={disabled}
              simulating={simulating}
              opponentBranding={
                cell.teamGame
                  ? props.teamBranding?.[cell.teamGame.opponentTeamId]
                  : undefined
              }
              onSelect={props.onSelectDate}
            />
          ))}
        </div>
      )}

      <CalendarMilestoneLegend grid={props.grid} />
    </div>
  );
}
