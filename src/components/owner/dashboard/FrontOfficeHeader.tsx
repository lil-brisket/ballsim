import Link from "next/link";
import { parseCalendarDate } from "@/domain/calendar-date";
import { cn, focusRingClass, panelClass } from "@/components/ui/styles";

function formatLongDate(isoDate: string): string {
  try {
    const { year, month, day } = parseCalendarDate(isoDate);
    const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return utc.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return isoDate;
  }
}

export function FrontOfficeHeader(props: {
  saveId: string;
  saveName: string;
  leagueName: string;
  currentDate: string;
  seasonYear: number;
  seasonPhaseLabel: string;
  teamCity: string;
  teamName: string;
  wins: number;
  losses: number;
  leagueRank: number;
  nextOpponentLabel?: string | null;
}) {
  const calendarHref = `/dashboard/${props.saveId}/calendar`;

  return (
    <header
      className={cn(panelClass, "space-y-3 p-4 sm:p-5")}
      aria-label="Front Office"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-amber-500">
            Front Office
          </p>
          <h1 className="mt-1 text-2xl font-medium text-zinc-50">
            {props.teamCity} {props.teamName}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {formatLongDate(props.currentDate)}
            <span className="mx-2 text-zinc-700">·</span>
            {props.seasonYear} · {props.seasonPhaseLabel}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {props.saveName} · {props.leagueName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={calendarHref}
            className={cn(
              "rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500",
              focusRingClass,
            )}
          >
            Open Calendar
          </Link>
          <Link
            href={`${calendarHref}?focus=next-game`}
            className={cn(
              "rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600",
              focusRingClass,
            )}
            title="Simulate until the next team game or a blocking decision, whichever comes first"
          >
            Simulate to next game
          </Link>
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-800 pt-3 text-sm">
        <div>
          <dt className="font-mono text-[0.65rem] uppercase tracking-wide text-zinc-500">
            Record
          </dt>
          <dd className="font-mono text-zinc-100">
            {props.wins}–{props.losses}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[0.65rem] uppercase tracking-wide text-zinc-500">
            Rank
          </dt>
          <dd className="font-mono text-zinc-100">#{props.leagueRank}</dd>
        </div>
        {props.nextOpponentLabel ? (
          <div>
            <dt className="font-mono text-[0.65rem] uppercase tracking-wide text-zinc-500">
              Next
            </dt>
            <dd className="text-zinc-100">{props.nextOpponentLabel}</dd>
          </div>
        ) : null}
      </dl>
    </header>
  );
}
