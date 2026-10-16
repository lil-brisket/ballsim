import Link from "next/link";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { TeamBadge } from "@/components/ui/TeamBadge";
import {
  cn,
  focusRingClass,
  touchTargetClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import { parseCalendarDate } from "@/domain/calendar-date";
import type { OwnerDashboardTeam } from "@/state/owner-dashboard";
import type { RecentFormView } from "@/state/recent-form-selectors";

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

function formatGameDate(isoDate: string): string {
  try {
    const { year, month, day } = parseCalendarDate(isoDate);
    const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return utc.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return isoDate;
  }
}

/** Last-five results, oldest to newest, as W/L dots. */
function FormDots(props: { form: RecentFormView }) {
  if (props.form.games.length === 0) {
    return null;
  }
  const oldestFirst = [...props.form.games].reverse();
  return (
    <p className="flex items-center gap-1.5">
      <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-zinc-400">
        Form
      </span>
      <span
        className="flex gap-1"
        role="img"
        aria-label={`Last ${oldestFirst.length} games, oldest to newest: ${props.form.marks
          .split("")
          .reverse()
          .join(" ")}`}
      >
        {oldestFirst.map((game) => (
          <span
            key={game.gameId}
            aria-hidden
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-[0.6rem] font-bold text-zinc-950",
              game.won ? "bg-win" : "bg-loss",
            )}
          >
            {game.won ? "W" : "L"}
          </span>
        ))}
      </span>
      {props.form.streak ? (
        <span className="font-mono text-xs text-zinc-300">
          {props.form.streak}
        </span>
      ) : null}
    </p>
  );
}

/**
 * Front Office hero: your team vs the next opponent, with one dominant action.
 * Replaces the separate FrontOfficeHeader and NextGamePanel.
 *
 * "Simulate to next game" links to the calendar's next-game focus, exactly as
 * the old header did; the simulate flow itself still lives on the calendar.
 */
export function MatchupBanner(props: {
  saveId: string;
  saveName: string;
  leagueName: string;
  currentDate: string;
  seasonYear: number;
  seasonPhaseLabel: string;
  team: OwnerDashboardTeam;
  teamCity: string;
  teamName: string;
  teamBranding: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoId: string;
  };
  recentForm: RecentFormView;
  /** When true, elevate visual weight (normal-day focal). */
  isFocal?: boolean;
}) {
  const { team, saveId } = props;
  const nextGame = team.upcomingGames[0];
  const calendarHref = `/dashboard/${saveId}/calendar`;
  const rotationHref = `/dashboard/${saveId}/team-management/lineups`;
  const teamLabel = `${props.teamCity} ${props.teamName}`;

  return (
    <ArenaPanel
      as="header"
      hero
      glow={props.isFocal}
      density="comfortable"
      className="space-y-6"
      aria-labelledby="front-office-title"
    >
      <div className="enter-up flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-team-ink">
          Front Office
          <span className="mx-2 text-zinc-600">·</span>
          {props.seasonYear} {props.seasonPhaseLabel}
        </p>
        <p className="text-xs text-zinc-300">
          {formatLongDate(props.currentDate)}
          <span className="mx-2 text-zinc-600">·</span>
          {props.saveName} · {props.leagueName}
        </p>
      </div>

      <div
        className="enter-up grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <div className="flex items-center gap-4">
          <TeamBadge
            branding={props.teamBranding}
            name={teamLabel}
            size="xl"
            decorative
          />
          <div className="min-w-0">
            <h1
              id="front-office-title"
              className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-zinc-50 sm:text-4xl"
            >
              {teamLabel}
            </h1>
            <div className="mt-2 flex flex-wrap items-end gap-x-5 gap-y-2">
              <ScoreNumeral
                value={`${team.wins}–${team.losses}`}
                label="Record"
                size="md"
                tone="team"
              />
              <ScoreNumeral
                value={team.leagueRank == null ? "—" : `#${team.leagueRank}`}
                label="Rank"
                size="md"
              />
            </div>
          </div>
        </div>

        {nextGame ? (
          <>
            <p
              aria-hidden
              className="font-display text-2xl font-bold uppercase tracking-[0.3em] text-zinc-500 md:text-center"
            >
              {nextGame.home ? "vs" : "@"}
            </p>
            <div className="flex items-center gap-4 md:flex-row-reverse md:text-end">
              <TeamBadge
                branding={nextGame.opponentBranding}
                name={nextGame.opponentName}
                size="xl"
                decorative
              />
              <div className="min-w-0">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-zinc-400">
                  Next game · {formatGameDate(nextGame.date)}
                </p>
                <TeamEntityLink
                  saveId={saveId}
                  teamId={nextGame.opponentTeamId}
                  className={cn(
                    "block rounded text-left font-display text-2xl font-bold uppercase leading-tight tracking-wide text-zinc-50 hover:text-team-ink sm:text-3xl md:text-right",
                    focusRingClass,
                  )}
                >
                  {nextGame.opponentName}
                </TeamEntityLink>
                <p className="mt-0.5 text-sm text-zinc-300">
                  {nextGame.home ? "Home game" : "Road game"}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="md:col-span-2">
            <EmptyState message="No upcoming scheduled games." />
          </div>
        )}
      </div>

      <div
        className="enter-up flex flex-wrap items-center justify-between gap-4"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        <FormDots form={props.recentForm} />
        {nextGame ? (
          <Link
            href={`/dashboard/${saveId}/games/${nextGame.gameId}`}
            className={cn(
              touchTargetTextClass,
              "text-sm text-zinc-300 hover:text-team-ink",
              focusRingClass,
            )}
          >
            View game
          </Link>
        ) : null}
      </div>

      {team.rosterProblems.length > 0 ? (
        <div className="rounded-lg border border-loss/40 bg-loss/10 px-3 py-2 text-xs text-rose-100">
          <p className="font-medium">Availability</p>
          <ul className="mt-1 space-y-0.5">
            {team.rosterProblems.slice(0, 3).map((problem) => (
              <li key={problem.playerId}>
                <PlayerEntityLink
                  saveId={saveId}
                  playerId={problem.playerId}
                  className="text-rose-100 underline-offset-2 hover:underline"
                >
                  {problem.name}
                </PlayerEntityLink>
                <span className="text-rose-200/80"> — {problem.kind}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        className="enter-up flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
        style={{ "--i": 3 } as React.CSSProperties}
      >
        <Link
          href={`${calendarHref}?focus=next-game`}
          className={cn(
            touchTargetClass,
            "w-full rounded-xl border-2 border-team-ink bg-team px-8 py-3 font-display text-xl font-extrabold uppercase tracking-wide text-on-team shadow-team-glow hover:brightness-110 sm:w-auto",
            focusRingClass,
          )}
        >
          Simulate to next game
        </Link>
        <Link
          href={calendarHref}
          className={cn(
            touchTargetTextClass,
            "text-sm text-zinc-300 underline-offset-4 hover:text-team-ink hover:underline",
            focusRingClass,
          )}
        >
          Open calendar
        </Link>
        <Link
          href={rotationHref}
          className={cn(
            touchTargetTextClass,
            "text-sm text-zinc-300 underline-offset-4 hover:text-team-ink hover:underline",
            focusRingClass,
          )}
        >
          Review rotation
        </Link>
        <p className="text-xs text-zinc-400 sm:ml-auto sm:max-w-xs sm:text-end">
          Advances until the next team game or a blocking decision.
        </p>
      </div>
    </ArenaPanel>
  );
}
