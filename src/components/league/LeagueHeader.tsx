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

export function LeagueHeader(props: {
  leagueName: string;
  seasonYear: number;
  seasonPhaseLabel: string;
  currentDate: string;
  userTeamLabel: string;
  playoffBanner?: string | null;
}) {
  return (
    <header
      className={cn(panelClass, "space-y-2 p-4 sm:p-5")}
      aria-label="League"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-amber-500">
            League
          </p>
          <h1 className="mt-1 text-2xl font-medium text-zinc-50">
            {props.leagueName}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {formatLongDate(props.currentDate)}
            <span className="mx-2 text-zinc-700">·</span>
            {props.seasonYear} · {props.seasonPhaseLabel}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Your team · {props.userTeamLabel}
          </p>
        </div>
        {props.playoffBanner ? (
          <p className="rounded-md border border-amber-800/40 bg-amber-950/30 px-3 py-1.5 text-sm text-amber-300">
            {props.playoffBanner}
          </p>
        ) : null}
      </div>
    </header>
  );
}

export function MyTeamContextStrip(props: {
  saveId: string;
  teamId: string;
  city: string;
  name: string;
  abbreviation: string;
  wins: number;
  losses: number;
  conferenceRank: number;
  conferenceName: string;
  gamesBack: number;
  streakLabel: string | null;
  leagueLeader: { abbreviation: string; wins: number; losses: number };
  cutoffTeam: { abbreviation: string; wins: number; losses: number } | null;
}) {
  const confShort = props.conferenceName.replace(/ Conference$/i, "");
  const gb =
    props.gamesBack === 0
      ? "—"
      : props.gamesBack % 1 === 0
        ? `${props.gamesBack} GB`
        : `${props.gamesBack.toFixed(1)} GB`;

  return (
    <section
      className={cn(panelClass, "p-4")}
      aria-label="Your team in the league"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-zinc-500">
            Your Team
          </p>
          <p className="text-lg font-medium text-zinc-50">
            {props.city} {props.name}
          </p>
          <p className="font-mono text-sm text-zinc-200">
            {props.wins}–{props.losses}
            <span className="mx-2 text-zinc-700">·</span>#{props.conferenceRank}{" "}
            {confShort}
            <span className="mx-2 text-zinc-700">·</span>
            {gb}
            {props.streakLabel ? (
              <>
                <span className="mx-2 text-zinc-700">·</span>
                {props.streakLabel}
              </>
            ) : null}
          </p>
        </div>
        <Link
          href={`/dashboard/${props.saveId}/team`}
          className={cn(
            "rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500",
            focusRingClass,
          )}
        >
          View Team
        </Link>
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="font-mono text-[0.65rem] uppercase tracking-wide text-zinc-500">
            League Leader
          </dt>
          <dd className="mt-0.5 text-sm text-zinc-200">
            {props.leagueLeader.abbreviation}{" "}
            <span className="font-mono text-zinc-400">
              {props.leagueLeader.wins}–{props.leagueLeader.losses}
            </span>
          </dd>
        </div>
        {props.cutoffTeam ? (
          <div>
            <dt className="font-mono text-[0.65rem] uppercase tracking-wide text-zinc-500">
              Playoff Cutoff
            </dt>
            <dd className="mt-0.5 text-sm text-zinc-200">
              {props.cutoffTeam.abbreviation}{" "}
              <span className="font-mono text-zinc-400">
                {props.cutoffTeam.wins}–{props.cutoffTeam.losses}
              </span>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
