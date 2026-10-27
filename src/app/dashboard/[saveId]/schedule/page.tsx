import type { Metadata } from "next";
import { SectionHeading } from "@/components/ui/SectionHeading";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { loadLeagueScheduleView } from "@/application/game-service";
import { LeagueGameRow } from "@/components/basketball/LeagueGameRow";
import { ScheduleGameCard } from "@/components/league/ScheduleGameCard";
import { ScheduleWeekStrip } from "@/components/league/ScheduleWeekStrip";
import { TeamFilter } from "@/components/league/TeamFilter";
import {
  parseTeamFilterParam,
  resolveTeamFilterId,
} from "@/components/league/team-filter-utils";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ViewSwitch } from "@/components/ui/ViewSwitch";
import { ScheduleViewSwitch } from "@/components/calendar/ScheduleViewSwitch";
import {
  formatGameDate,
  formatRelativeGameDay,
} from "@/presentation/game-date";
import {
  shiftFocusDate,
  groupLeagueScheduleRowsByDate,
  type LeagueScheduleGameRow,
} from "@/state/league-schedule-selectors";
import { cn, focusRingClass, panelClass } from "@/components/ui/styles";

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

/** Panel whose body scrolls on its own so the page itself stays put. */
function SchedulePanel(props: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(panelClass, "flex min-h-0 flex-col", props.className)}
    >
      <header className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
        <SectionHeading
          as="h2"
          size="sm"
          titleClassName="font-display uppercase tracking-wide"
          title={props.title}
        />
        {props.meta ? (
          <span className="text-sm text-faint">{props.meta}</span>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{props.children}</div>
    </section>
  );
}

function GameList(props: { saveId: string; games: LeagueScheduleGameRow[] }) {
  return (
    <ul className="space-y-1.5">
      {props.games.map((game) => (
        <li key={game.gameId}>
          <LeagueGameRow
            saveId={props.saveId}
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
  );
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? "game" : "games"}`;
}

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

  const isToday = focusDate === currentDate;
  const hasSide = view.upcoming.length > 0 || view.recent.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Schedule"
        subtitle={
          <span>
            {formatGameDate(focusDate, { weekday: true, year: true })}
            <span className="text-faint">
              {" · "}
              {formatRelativeGameDay(focusDate, currentDate)}
            </span>
          </span>
        }
        actions={
          <>
            <ScheduleViewSwitch saveId={saveId} active="list" />
            {isToday ? null : (
              <Link
                href={href({ date: undefined })}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-md border border-line-strong px-4 text-sm text-soft hover:border-team-ink hover:text-team-ink",
                  focusRingClass,
                )}
              >
                Back to today
              </Link>
            )}
          </>
        }
      />
      {query.error ? <ErrorState message={query.error} /> : null}

      <ScheduleWeekStrip
        week={view.week}
        focusDate={focusDate}
        currentDate={currentDate}
        hrefFor={(date) => href({ date })}
        prevHref={href({ date: shiftFocusDate(focusDate, -1) })}
        nextHref={href({ date: shiftFocusDate(focusDate, 1) })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Suspense
          fallback={<p className="text-sm text-faint">Loading filters…</p>}
        >
          <TeamFilter
            teams={view.teams}
            myTeamId={view.myTeamId}
            value={teamValue}
          />
        </Suspense>
        <ViewSwitch
          aria-label="Status filter"
          activeKey={statusFilter}
          items={[
            { key: "all", label: "All", href: href({ status: undefined }) },
            {
              key: "upcoming",
              label: "Upcoming",
              href: href({ status: "upcoming" }),
            },
            { key: "final", label: "Final", href: href({ status: "final" }) },
          ]}
        />
      </div>

      {view.emptyReason ? (
        <EmptyState message={view.emptyReason} />
      ) : (
        <div
          className={cn(
            "grid gap-4 lg:h-[calc(100dvh-27rem)] lg:min-h-80",
            hasSide && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
          )}
        >
          <SchedulePanel
            title={
              isToday ? "Today" : formatGameDate(focusDate, { weekday: true })
            }
            meta={
              view.today.length === 0
                ? undefined
                : countLabel(view.today.length)
            }
          >
            {view.today.length === 0 ? (
              <p className="py-6 text-center text-sm text-faint">
                No games on this date.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {view.today.map((game) => (
                  <ScheduleGameCard
                    key={game.gameId}
                    saveId={saveId}
                    game={game}
                    myTeamId={view.myTeamId}
                  />
                ))}
              </div>
            )}
          </SchedulePanel>

          {hasSide ? (
            <div className="flex min-h-0 flex-col gap-4">
              {view.upcoming.length > 0 ? (
                <SchedulePanel title="Upcoming" className="lg:flex-1">
                  <GameList saveId={saveId} games={view.upcoming} />
                </SchedulePanel>
              ) : null}
              {view.recent.length > 0 ? (
                <SchedulePanel
                  title={
                    statusFilter === "final" ? "Results" : "Recent Results"
                  }
                  className="lg:flex-1"
                >
                  {statusFilter === "final" ? (
                    <div className="space-y-3">
                      {groupLeagueScheduleRowsByDate(view.recent).map(
                        (group) => (
                          <div key={group.date} className="space-y-1.5">
                            <SectionHeading
                              as="h3"
                              size="sm"
                              tone="muted"
                              title={
                                <>
                                  {formatGameDate(group.date, {
                                    weekday: true,
                                  })}
                                </>
                              }
                            />
                            <GameList saveId={saveId} games={group.games} />
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <GameList saveId={saveId} games={view.recent} />
                  )}
                </SchedulePanel>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
