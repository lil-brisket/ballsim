import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { loadTransactionHubView } from "@/application/game-service";
import { parseTeamFilterParam } from "@/components/league/team-filter-utils";
import { LeagueSubNav } from "@/components/league/LeagueSubNav";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionTimeline } from "@/components/transactions/TransactionRow";
import {
  parseTransactionHubQuery,
  toTransactionHubSearchParams,
  TRANSACTION_HUB_PAGE_SIZE,
} from "@/state/transaction-hub-selectors";
import { cn, focusRingClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Transactions" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{
    error?: string;
    type?: string;
    team?: string;
    range?: string;
    q?: string;
    limit?: string;
    sort?: string;
    activity?: string;
    start?: string;
    end?: string;
  }>;
};

export default async function LeagueTransactionsPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const query = await searchParams;
  const parsed = parseTransactionHubQuery(query);

  const view = await loadTransactionHubView(saveId, {
    group: parsed.group,
    teamParam: parsed.teamParam ?? query.team,
    range: parsed.range,
    search: parsed.search,
    limit: parsed.limit,
    sort: parsed.sort,
    activityMode: parsed.activityMode,
    start: parsed.start,
    end: parsed.end,
  });
  if (!view) {
    notFound();
  }

  const teamValue = parseTeamFilterParam(query.team, view.myTeamId);
  const basePath = `/dashboard/${saveId}/league/transactions`;
  const filtersActive =
    parsed.group !== "all" ||
    parsed.range !== "season" ||
    teamValue !== "all" ||
    parsed.search !== "" ||
    parsed.sort !== "newest" ||
    parsed.activityMode !== "league" ||
    Boolean(parsed.start) ||
    Boolean(parsed.end);

  function loadMoreHref(): string {
    const params = toTransactionHubSearchParams({
      group: parsed.group,
      teamParam: teamValue === "all" ? undefined : String(teamValue),
      range: parsed.range,
      start: parsed.start,
      end: parsed.end,
      sort: parsed.sort,
      activityMode: parsed.activityMode,
      search: parsed.search,
      limit: parsed.limit + TRANSACTION_HUB_PAGE_SIZE,
    });
    return `${basePath}?${params.toString()}`;
  }

  const clearFilters = (
    <Link
      href={basePath}
      className={cn(
        "text-sm text-team-ink underline-offset-4 hover:underline",
        focusRingClass,
      )}
    >
      Clear filters
    </Link>
  );

  return (
    <div className="space-y-4">
      <LeagueSubNav saveId={saveId} active="transactions" />
      <PageHeader
        title="Transactions"
        subtitle="Trades, signings, releases and draft moves around the league"
      />
      {query.error ? <ErrorState message={query.error} /> : null}

      <Suspense
        fallback={<p className="text-sm text-zinc-500">Loading filters…</p>}
      >
        <TransactionFilters
          saveId={saveId}
          basePath={basePath}
          group={parsed.group}
          range={parsed.range}
          teamValue={teamValue}
          search={parsed.search}
          teams={view.teams}
          myTeamId={view.myTeamId}
          limit={parsed.limit}
          sort={parsed.sort}
          activityMode={parsed.activityMode}
          start={parsed.start}
          end={parsed.end}
          today={view.currentDate}
        />
      </Suspense>

      {view.groups.length === 0 ? (
        <EmptyState
          title={
            parsed.activityMode === "myTeam"
              ? "Showing your franchise activity"
              : undefined
          }
          message="No transactions match these filters."
          action={filtersActive ? clearFilters : undefined}
        />
      ) : (
        <>
          <TransactionTimeline
            saveId={saveId}
            groups={view.groups}
            activityMode={parsed.activityMode}
            highlightMyTeam={
              parsed.activityMode === "league" && teamValue !== "my"
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-3">
            <p className="text-sm text-zinc-500">
              Showing {view.shown} of {view.total}
            </p>
            {view.hasMore ? (
              <Link
                href={loadMoreHref()}
                className={cn(
                  "inline-flex rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-team-ink",
                  focusRingClass,
                )}
              >
                Load more
              </Link>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
