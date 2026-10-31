import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import type { OwnerDashboardTeam } from "@/state/owner-dashboard";
import type { RecentFormView } from "@/state/recent-form-selectors";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import {
  cn,
  focusRingClass,
  linkClass,
  panelClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import { formatGameDate } from "@/presentation/game-date";
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
  const rotationHref = `/dashboard/${props.saveId}/team-management/lineups`;

  return (
    <Section
      title="Next Game"
      action={
        <Link
          href={scheduleHref}
          className={cn(
            touchTargetTextClass,
            linkClass,
            "text-sm",
            focusRingClass,
          )}
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
            "border-team-ink/50 bg-surface-raised/80 shadow-[0_0_0_1px_rgb(var(--team-ink-rgb)/0.12)]",
        )}
      >
        {!nextGame ? (
          <EmptyState message="No upcoming scheduled games." />
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted">
                {formatGameDate(nextGame.date, { weekday: true })}
              </p>
              <p
                className={cn(
                  "mt-1 inline-flex items-center gap-2 text-ink",
                  props.isFocal ? "text-xl" : "text-lg",
                )}
              >
                <span>{nextGame.home ? "vs" : "@"}</span>
                {nextGame.opponentBranding ? (
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-line-strong"
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
                    "font-medium text-ink hover:text-team-ink",
                    focusRingClass,
                  )}
                >
                  {nextGame.opponentName}
                </TeamEntityLink>
              </p>
              <p className="mt-1 text-sm text-muted">
                You {props.teamRecord}
                {props.recentForm.streak
                  ? ` · Form ${props.recentForm.marks} (${props.recentForm.streak})`
                  : null}
              </p>
            </div>

            {props.team.rosterProblems.length > 0 ? (
              <div className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-ink">
                <p className="font-medium">Availability</p>
                <ul className="mt-1 space-y-0.5">
                  {props.team.rosterProblems.slice(0, 3).map((problem) => (
                    <li key={problem.playerId}>
                      <PlayerEntityLink
                        saveId={props.saveId}
                        playerId={problem.playerId}
                        className="text-danger-ink hover:text-team-ink"
                      >
                        {problem.name}
                      </PlayerEntityLink>
                      <span className="text-danger-ink/80">
                        {" "}
                        — {problem.kind}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap">
              <Link
                href={
                  nextGame.gameId
                    ? `/dashboard/${props.saveId}/games/${nextGame.gameId}`
                    : scheduleHref
                }
                className={cn(
                  buttonClass({ variant: "secondary" }),
                  "w-full sm:w-auto",
                )}
              >
                View game
              </Link>
              <Link
                href={rotationHref}
                className={cn(
                  buttonClass({ variant: "secondary" }),
                  "w-full sm:w-auto",
                )}
              >
                Review rotation
              </Link>
              <Link
                href={calendarDateHref(props.saveId, nextGame.date)}
                className={cn(
                  buttonClass({ variant: "secondary" }),
                  "w-full sm:w-auto",
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
