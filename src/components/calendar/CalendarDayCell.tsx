import type { CalendarDayCell as CalendarDayCellData } from "@/systems/calendar";
import type { TeamId } from "@/domain/ids";
import {
  ATTENTION_INDICATOR_DOT,
  collectAttentionIndicators,
} from "@/components/calendar/event-attention-tiers";

const MAX_VISIBLE_DOTS = 4;

function dayNumber(isoDate: string): string {
  const day = isoDate.slice(8, 10);
  return String(Number(day));
}

export function CalendarDayCell(props: {
  cell: CalendarDayCellData;
  selected: boolean;
  onSelect: (date: string) => void;
  userTeamId?: TeamId | null;
}) {
  const { cell, selected, onSelect, userTeamId } = props;
  const indicators = collectAttentionIndicators(cell.events, userTeamId);
  const visible = indicators.slice(0, MAX_VISIBLE_DOTS);
  const overflow = Math.max(0, indicators.length - visible.length);
  const ariaLabel = [
    cell.date,
    cell.isToday ? "today" : null,
    cell.events.length > 0 ? `${cell.events.length} events` : "no events",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      onClick={() => onSelect(cell.date)}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={[
        "flex min-h-[4.5rem] flex-col gap-1 rounded-md border p-1.5 text-left transition-colors sm:min-h-[5.25rem] sm:p-2",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
        cell.inMonth ? "border-zinc-800 bg-zinc-950/50" : "border-zinc-900/80 bg-zinc-950/20",
        cell.isToday ? "border-amber-600/60 bg-amber-950/25" : "",
        selected ? "ring-2 ring-amber-500/80" : "hover:border-zinc-600",
        cell.isPast && !cell.isToday ? "opacity-70" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={[
          "font-mono text-xs sm:text-sm",
          cell.inMonth ? "text-zinc-200" : "text-zinc-600",
          cell.isToday ? "font-semibold text-amber-300" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {dayNumber(cell.date)}
      </span>
      <span className="mt-auto flex flex-wrap items-center gap-0.5">
        {visible.map((kind) => (
          <span
            key={kind}
            title={kind.replace("_", " ")}
            className={`inline-block h-1.5 w-1.5 rounded-full ${ATTENTION_INDICATOR_DOT[kind]}`}
            aria-hidden
          />
        ))}
        {overflow > 0 ? (
          <span className="ml-0.5 font-mono text-[10px] text-zinc-500">
            +{overflow}
          </span>
        ) : null}
      </span>
    </button>
  );
}
