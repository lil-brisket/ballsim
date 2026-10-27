import Link from "next/link";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { LeagueScheduleWeekDay } from "@/state/league-schedule-selectors";

function dayParts(iso: string): { weekday: string; day: string } {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return {
    weekday: new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "short",
    }).format(date),
    day: new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
    }).format(date),
  };
}

const arrowClass = cn(
  "flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-surface-line text-muted hover:border-team-ink hover:text-team-ink",
  focusRingClass,
);

/**
 * Seven-day picker centred on the focus date: game count per day, a dot when
 * the controlled team plays, and prev/next arrows that step one day.
 */
export function ScheduleWeekStrip(props: {
  week: LeagueScheduleWeekDay[];
  focusDate: string;
  currentDate: string;
  hrefFor: (date: string) => string;
  prevHref: string;
  nextHref: string;
}) {
  return (
    <nav aria-label="Schedule dates" className="flex gap-2">
      <Link
        href={props.prevHref}
        aria-label="Previous day"
        className={arrowClass}
      >
        ‹
      </Link>
      <ol className="grid min-w-0 flex-1 grid-cols-5 gap-1.5 sm:grid-cols-7">
        {props.week.map((day, index) => {
          const { weekday, day: label } = dayParts(day.date);
          const selected = day.date === props.focusDate;
          const isToday = day.date === props.currentDate;
          return (
            <li
              key={day.date}
              // Keep the strip readable on phones: show the middle five days.
              className={cn(index === 0 || index === 6 ? "max-sm:hidden" : "")}
            >
              <Link
                href={props.hrefFor(day.date)}
                aria-current={selected ? "date" : undefined}
                className={cn(
                  "flex h-full flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center",
                  selected
                    ? "border-team-ink bg-team-ink/10"
                    : "border-surface-line hover:border-faint",
                  focusRingClass,
                )}
              >
                <span
                  className={cn(
                    "text-xs font-medium uppercase tracking-wide",
                    isToday ? "text-team-ink" : "text-faint",
                  )}
                >
                  {isToday ? "Today" : weekday}
                </span>
                <span
                  className={cn(
                    "font-display text-sm",
                    selected ? "text-ink" : "text-soft",
                  )}
                >
                  {label}
                </span>
                <span className="flex items-center gap-1 text-xs text-faint">
                  {day.myTeamPlays ? (
                    <span
                      aria-label="Your team plays"
                      className="h-1.5 w-1.5 rounded-full bg-team-ink"
                    />
                  ) : null}
                  {day.games === 0
                    ? "—"
                    : `${day.games} ${day.games === 1 ? "game" : "games"}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <Link href={props.nextHref} aria-label="Next day" className={arrowClass}>
        ›
      </Link>
    </nav>
  );
}
