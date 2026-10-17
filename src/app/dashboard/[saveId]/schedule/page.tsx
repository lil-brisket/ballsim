import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { loadLeagueScheduleView } from "@/application/game-service";
import { LeagueGameRow } from "@/components/basketball/LeagueGameRow";
import { TeamFilter } from "@/components/league/TeamFilter";
import {
  parseTeamFilterParam,
  resolveTeamFilterId,
} from "@/components/league/team-filter-utils";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { formatGameDate } from "@/presentation/game-date";
import {
  shiftFocusDate,
  groupLeagueScheduleRowsByDate,
} from "@/state/league-schedule-selectors";
import { cn, focusRingClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Schedule" };

type SchedulePageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{
    error?: string;
    date?: string;
    team?: string;
    status?: string;
  }>;
};

export default async function SchedulePage({
  params,
  searchParams,
}: SchedulePageProps) {
  const { saveId } = await params;
  const query = await searchParams;

  const teamParam = query.team;
  const statusFilter =
    query.status === "final" || query.status === "upcoming"
      ? query.status
      : "all";

  const baseView = await loadLeagueScheduleView(saveId, {
    focusDate: query.date,
    status: statusFilter,
  });
  if (!baseView) {
    notFound();
  }

  const teamValue = parseTeamFilterParam(teamParam, baseView.myTeamId);
  const teamId = resolveTeamFilterId(teamValue, baseView.myTeamId);
  const focusDate = query.date || baseView.currentDate;

  const view =
    teamId == null
      ? baseView
      : await loadLeagueScheduleView(saveId, {
          focusDate,
          teamId,
          status: statusFilter,
        });
  if (!view) {
    notFound();
  }

  const currentDate = view.currentDate;
  const base = `/dashboard/${saveId}/schedule`;

  function href(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    const next = {
      date:
        (overrides.date ?? focusDate) !== currentDate
          ? (overrides.date ?? focusDate)
          : undefined,
      team: teamValue === "all" ? undefined : String(teamValue),
      status: statusFilter === "all" ? undefined : statusFilter,
      ...overrides,
    };
    for (const [k, v] of Object.entries(next)) {
      if (v) {
        params.set(k, v);
      }
    }
    if (params.get("date") === currentDate) {
      params.delete("date");
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  const prevDate = shiftFocusDate(focusDate, -1);
  const nextDate = shiftFocusDate(focusDate, 1);

  return (
    <div className="space-y-4">
      <PageHeader title="Schedule" />
      {query.error ? <ErrorState message={query.error} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={href({ date: prevDate })}
          className={cn(
            "rounded-md border border-zinc-700 px-2 py-1 text-sm text-zinc-300 hover:border-team-ink",
            focusRingClass,
          )}
        >
          ← Prev
        </Link>
        <Link
          href={href({ date: undefined })}
          className={cn(
            "rounded-md border px-3 py-1 text-sm",
            focusDate === view.currentDate
              ? "border-team-ink text-team-ink"
              : "border-zinc-700 text-zinc-300 hover:border-team-ink",
            focusRingClass,
          )}
        >
          Today
        </Link>
        <Link
          href={href({ date: nextDate })}
          className={cn(
            "rounded-md border border-zinc-700 px-2 py-1 text-sm text-zinc-300 hover:border-team-ink",
            focusRingClass,
          )}
        >
          Next →
        </Link>
        <span className="text-sm text-zinc-400">
          {formatGameDate(focusDate, { weekday: true })}
        </span>
      </div>

      <Suspense
        fallback={<p className="text-sm text-zinc-500">Loading filters…</p>}
      >
        <TeamFilter
          teams={view.teams}
          myTeamId={view.myTeamId}
          value={teamValue}
        />
      </Suspense>

      <div className="flex flex-wrap gap-2" aria-label="Status filter">
        {(
          [
            ["all", "All"],
            ["upcoming", "Upcoming"],
            ["final", "Final"],
          ] as const
        ).map(([id, label]) => (
          <Link
            key={id}
            href={href({
              status: id === "all" ? undefined : id,
            })}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              statusFilter === id
                ? "border-team-ink text-team-ink"
                : "border-zinc-700 text-zinc-400",
              focusRingClass,
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {view.emptyReason ? (
        <EmptyState message={view.emptyReason} />
      ) : (
        <>
          <section>
            <SectionHeading
              className="mb-2"
              title={
                focusDate === view.currentDate
                  ? `${formatGameDate(focusDate, { weekday: true })} — Today`
                  : formatGameDate(focusDate, { weekday: true })
              }
            />
            {view.today.length === 0 ? (
              <p className="text-sm text-zinc-600">No games on this date.</p>
            ) : (
              <ul className="space-y-2">
                {view.today.map((game) => (
                  <li key={game.gameId} className="space-y-1">
                    <LeagueGameRow
                      saveId={saveId}
                      gameId={game.gameId}
                      date={game.date}
                      homeTeamId={game.homeTeamId}
                      awayTeamId={game.awayTeamId}
                      homeAbbreviation={game.homeAbbreviation}
                      awayAbbreviation={game.awayAbbreviation}
                      homeBranding={game.homeBranding}
                      awayBranding={game.awayBranding}
                      homeScore={game.homeScore}
                      awayScore={game.awayScore}
                      status={game.status}
                      competitionType={game.competitionType}
                      canWatch={game.canWatch}
                    />
                    {game.canManageEvent ? (
                      <Link
                        href={`/dashboard/${saveId}/schedule/${game.gameId}/event`}
                        className="ml-3 text-sm text-team-ink underline-offset-4 hover:underline"
                      >
                        Manage event
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {view.upcoming.length > 0 ? (
            <section>
              <SectionHeading className="mb-2" title="Upcoming" />
              <ul className="space-y-2">
                {view.upcoming.map((game) => (
                  <li key={game.gameId}>
                    <LeagueGameRow
                      saveId={saveId}
                      gameId={game.gameId}
                      date={game.date}
                      homeTeamId={game.homeTeamId}
                      awayTeamId={game.awayTeamId}
                      homeAbbreviation={game.homeAbbreviation}
                      awayAbbreviation={game.awayAbbreviation}
                      homeBranding={game.homeBranding}
                      awayBranding={game.awayBranding}
                      homeScore={game.homeScore}
                      awayScore={game.awayScore}
                      status={game.status}
                      competitionType={game.competitionType}
                      canWatch={game.canWatch}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {view.recent.length > 0 ? (
            <section>
              <SectionHeading
                className="mb-2"
                title={statusFilter === "final" ? "Results" : "Recent Results"}
              />
              {statusFilter === "final" ? (
                <div className="space-y-4">
                  {groupLeagueScheduleRowsByDate(view.recent).map((group) => (
                    <div key={group.date} className="space-y-2">
                      <h3 className="text-sm font-medium text-zinc-300">
                        {formatGameDate(group.date, { weekday: true })}
                      </h3>
                      <ul className="space-y-2">
                        {group.games.map((game) => (
                          <li key={game.gameId}>
                            <LeagueGameRow
                              saveId={saveId}
                              gameId={game.gameId}
                              date={game.date}
                              homeTeamId={game.homeTeamId}
                              awayTeamId={game.awayTeamId}
                              homeAbbreviation={game.homeAbbreviation}
                              awayAbbreviation={game.awayAbbreviation}
                              homeBranding={game.homeBranding}
                              awayBranding={game.awayBranding}
                              homeScore={game.homeScore}
                              awayScore={game.awayScore}
                              status={game.status}
                              competitionType={game.competitionType}
                              canWatch={game.canWatch}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="space-y-2">
                  {view.recent.map((game) => (
                    <li key={game.gameId}>
                      <LeagueGameRow
                        saveId={saveId}
                        gameId={game.gameId}
                        date={game.date}
                        homeTeamId={game.homeTeamId}
                        awayTeamId={game.awayTeamId}
                        homeAbbreviation={game.homeAbbreviation}
                        awayAbbreviation={game.awayAbbreviation}
                        homeBranding={game.homeBranding}
                        awayBranding={game.awayBranding}
                        homeScore={game.homeScore}
                        awayScore={game.awayScore}
                        status={game.status}
                        competitionType={game.competitionType}
                        canWatch={game.canWatch}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
