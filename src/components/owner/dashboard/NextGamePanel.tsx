import Link from "next/link";
import type { OwnerDashboardTeam } from "@/state/owner-dashboard";
import type { RecentFormView } from "@/state/recent-form-selectors";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { cn, focusRingClass, panelClass } from "@/components/ui/styles";
import { parseCalendarDate } from "@/domain/calendar-date";

function calendarDateHref(saveId: string, isoDate: string): string {
  try {
    const { year, month } = parseCalendarDate(isoDate);
    return `/dashboard/${saveId}/calendar?year=${year}&month=${month}&date=${isoDate}`;
  } catch {
    return `/dashboard/${saveId}/calendar?date=${isoDate}`;
  }
}

export function NextGamePanel(props: {
  team: OwnerDashboardTeam;
  saveId: string;
  teamRecord: string;
  recentForm: RecentFormView;
  /** When true, elevate visual weight (normal-day focal). */
  isFocal?: boolean;
}) {
  const nextGame = props.team.upcomingGames[0];
  const scheduleHref = `/dashboard/${props.saveId}/schedule`;
  const rotationHref = `/dashboard/${props.saveId}/team-management/rotations`;

  return (
    <Section
      title="Next Game"
      action={
        <Link
          href={scheduleHref}
          className="text-sm text-amber-400 hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          Schedule
        </Link>
      }
    >
      <div
        className={cn(
          panelClass,
          "px-4 py-4",
          props.isFocal &&
            "border-amber-700/50 bg-zinc-900/80 shadow-[0_0_0_1px_rgba(245,158,11,0.12)]",
        )}
      >
        {!nextGame ? (
          <EmptyState message="No upcoming scheduled games." />
        ) : (
          <div className="space-y-4">
            <div>
              <p className="font-mono text-xs text-zinc-500">{nextGame.date}</p>
              <p
                className={cn(
                  "mt-1 inline-flex items-center gap-2 text-zinc-50",
                  props.isFocal ? "text-xl" : "text-lg",
                )}
              >
                <span>{nextGame.home ? "vs" : "@"}</span>
                {nextGame.opponentBranding ? (
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-zinc-700"
                    style={{
                      backgroundColor: nextGame.opponentBranding.primaryColor,
                    }}
                  >
                    <TeamLogoMark
                      branding={nextGame.opponentBranding}
                      size="sm"
                      decorative
                    />
                  </span>
                ) : null}
                <TeamEntityLink
                  saveId={props.saveId}
                  teamId={nextGame.opponentTeamId}
                  className={cn(
                    "font-medium text-zinc-50 hover:text-amber-400",
                    focusRingClass,
                  )}
                >
                  {nextGame.opponentName}
                </TeamEntityLink>
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                You {props.teamRecord}
                {props.recentForm.streak
                  ? ` · Form ${props.recentForm.marks} (${props.recentForm.streak})`
                  : null}
              </p>
            </div>

            {props.team.rosterProblems.length > 0 ? (
              <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 px-3 py-2 text-xs text-rose-200">
                <p className="font-medium">Availability</p>
                <ul className="mt-1 space-y-0.5">
                  {props.team.rosterProblems.slice(0, 3).map((problem) => (
                    <li key={problem.playerId}>
                      <PlayerEntityLink
                        saveId={props.saveId}
                        playerId={problem.playerId}
                        className="text-rose-200 hover:text-amber-300"
                      >
                        {problem.name}
                      </PlayerEntityLink>
                      <span className="text-rose-300/80"> — {problem.kind}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 text-sm">
              <Link
                href={
                  nextGame.gameId
                    ? `/dashboard/${props.saveId}/games/${nextGame.gameId}`
                    : scheduleHref
                }
                className={cn(
                  "rounded-md border border-zinc-700 px-2.5 py-1 text-zinc-200 hover:border-amber-600",
                  focusRingClass,
                )}
              >
                View game
              </Link>
              <Link
                href={rotationHref}
                className={cn(
                  "rounded-md border border-zinc-700 px-2.5 py-1 text-zinc-200 hover:border-amber-600",
                  focusRingClass,
                )}
              >
                Review rotation
              </Link>
              <Link
                href={calendarDateHref(props.saveId, nextGame.date)}
                className={cn(
                  "rounded-md bg-amber-600/90 px-2.5 py-1 font-medium text-zinc-950 hover:bg-amber-500",
                  focusRingClass,
                )}
              >
                Open on Calendar
              </Link>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
