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
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { shiftFocusDate } from "@/state/league-schedule-selectors";
import { cn, focusRingClass } from "@/components/ui/styles";

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
      <PageHeader
        title="Schedule"
        subtitle="League schedule — browse all games (Calendar controls simulation)"
      />
      {query.error ? <ErrorState message={query.error} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={href({ date: prevDate })}
          className={cn(
            "rounded-md border border-zinc-700 px-2 py-1 text-sm text-zinc-300 hover:border-amber-600",
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
              ? "border-amber-600 text-amber-400"
              : "border-zinc-700 text-zinc-300 hover:border-amber-600",
            focusRingClass,
          )}
        >
          Today
        </Link>
        <Link
          href={href({ date: nextDate })}
          className={cn(
            "rounded-md border border-zinc-700 px-2 py-1 text-sm text-zinc-300 hover:border-amber-600",
            focusRingClass,
          )}
        >
          Next →
        </Link>
        <span className="font-mono text-sm text-zinc-400">{focusDate}</span>
      </div>

      <Suspense
        fallback={<p className="text-xs text-zinc-600">Loading filters…</p>}
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
              "rounded-full border px-3 py-1 text-xs",
              statusFilter === id
                ? "border-amber-600 text-amber-400"
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
            <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
              {focusDate === view.currentDate
                ? `${focusDate} — Today`
                : focusDate}
            </h2>
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
                    />
                    {game.canManageEvent ? (
                      <Link
                        href={`/dashboard/${saveId}/schedule/${game.gameId}/event`}
                        className="ml-3 text-xs text-amber-400 hover:text-amber-300"
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
              <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
                Upcoming
              </h2>
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
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {view.recent.length > 0 ? (
            <section>
              <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
                Recent Results
              </h2>
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
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
