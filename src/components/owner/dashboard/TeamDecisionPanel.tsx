import Link from "next/link";
import { cn, focusRingClass, linkClass } from "@/components/ui/styles";
import type { OwnerDashboardTeam } from "@/state/owner-dashboard";
import { EmptyState } from "@/components/ui/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { Section } from "@/components/ui/Section";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { formatGameDate } from "@/presentation/game-date";
import { groupRankLabel, leagueRankLabel } from "@/presentation/rank-label";

export function TeamDecisionPanel(props: {
  team: OwnerDashboardTeam;
  saveId: string;
}) {
  const { team, saveId } = props;
  const standingLine =
    team.conferenceRank !== null && team.conferenceName
      ? `${team.wins}–${team.losses} · ${groupRankLabel(team.conferenceName, team.conferenceRank)}`
      : `${team.wins}–${team.losses} · ${leagueRankLabel(team.leagueRank)}`;

  const payrollContext =
    team.payrollVsLeaguePct !== null
      ? `${team.payrollVsLeaguePct >= 0 ? "+" : ""}${Math.round(team.payrollVsLeaguePct)}% vs league`
      : null;

  const nextGame = team.upcomingGames[0];

  return (
    <Section
      title="Team"
      action={
        <Link
          href={`/dashboard/${saveId}/team`}
          className={cn(linkClass, "text-sm", focusRingClass)}
        >
          View Team
        </Link>
      }
    >
      <div className="space-y-3 rounded-xl border border-line bg-surface-raised/50 px-4 py-4">
        <div>
          <p className="text-sm text-muted">Performance</p>
          <p className="mt-1 text-lg text-ink">{standingLine}</p>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-faint">Strength</dt>
            <dd className="tabular-nums text-ink">{team.strength}</dd>
          </div>
          <div>
            <dt className="text-faint">Payroll</dt>
            <dd className="text-ink">
              <MoneyDisplay amount={team.payroll} />
              {payrollContext ? (
                <span className="ml-2 text-sm text-faint">
                  {payrollContext}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>

        {team.rosterProblems.length > 0 ? (
          <div className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-ink">
            <p className="font-medium">Roster concerns</p>
            <ul className="mt-1 space-y-0.5 text-sm text-danger-ink/90">
              {team.rosterProblems.slice(0, 3).map((problem) => (
                <li key={problem.playerId}>
                  {problem.name} — {problem.kind}
                </li>
              ))}
            </ul>
            <Link
              href={`/dashboard/${saveId}/roster`}
              className={cn(linkClass, "mt-2 inline-block text-sm")}
            >
              Review Roster
            </Link>
          </div>
        ) : null}

        <div>
          <p className="text-sm font-medium text-soft">Upcoming</p>
          {team.upcomingGames.length === 0 ? (
            <EmptyState message="No upcoming scheduled games." />
          ) : (
            <ul className="mt-2 space-y-1.5">
              {team.upcomingGames.map((game) => (
                <li
                  key={game.gameId}
                  className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm"
                >
                  <span className="text-muted">
                    {formatGameDate(game.date, { weekday: true })}
                  </span>
                  <span className="inline-flex items-center gap-2 text-ink">
                    <span>{game.home ? "vs" : "@"}</span>
                    {game.opponentBranding ? (
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded border border-line-strong"
                        style={{
                          backgroundColor: game.opponentBranding.primaryColor,
                        }}
                      >
                        <TeamLogoMark
                          branding={game.opponentBranding}
                          size="sm"
                          decorative
                        />
                      </span>
                    ) : null}
                    <span>{game.opponentAbbreviation}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {nextGame ? (
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-faint">
              <span>Next:</span>
              <span>{nextGame.home ? "vs" : "@"}</span>
              {nextGame.opponentBranding ? (
                <span
                  className="inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded border border-line-strong"
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
              <span>
                {nextGame.opponentAbbreviation} on{" "}
                {formatGameDate(nextGame.date, { weekday: true })}
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
