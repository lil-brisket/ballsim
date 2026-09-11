import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { loadTransactionHubView } from "@/application/game-service";
import { parseTeamFilterParam } from "@/components/league/team-filter-utils";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionTimeline } from "@/components/transactions/TransactionRow";
import {
  parseTransactionDateRange,
  parseTransactionFilterGroup,
  TRANSACTION_HUB_PAGE_SIZE,
} from "@/state/transaction-hub-selectors";
import { cn, focusRingClass } from "@/components/ui/styles";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{
    error?: string;
    type?: string;
    team?: string;
    range?: string;
    q?: string;
    limit?: string;
  }>;
};

export default async function TransactionsHubPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const query = await searchParams;
  const group = parseTransactionFilterGroup(query.type);
  const range = parseTransactionDateRange(query.range);
  const search = typeof query.q === "string" ? query.q : "";
  const limitRaw = Number(query.limit ?? TRANSACTION_HUB_PAGE_SIZE);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 200)
      : TRANSACTION_HUB_PAGE_SIZE;

  const view = await loadTransactionHubView(saveId, {
    group,
    teamParam: query.team,
    range,
    search,
    limit,
  });
  if (!view) {
    notFound();
  }

  const teamValue = parseTeamFilterParam(query.team, view.myTeamId);
  const basePath = `/dashboard/${saveId}/transactions`;

  function loadMoreHref(): string {
    const params = new URLSearchParams();
    if (group !== "all") {
      params.set("type", group);
    }
    if (range !== "season") {
      params.set("range", range);
    }
    if (teamValue !== "all") {
      params.set("team", String(teamValue));
    }
    if (search) {
      params.set("q", search);
    }
    params.set("limit", String(limit + TRANSACTION_HUB_PAGE_SIZE));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transactions"
        subtitle="Factual league transaction ledger — not media narrative"
      />
      {query.error ? <ErrorState message={query.error} /> : null}

      <Suspense
        fallback={<p className="text-xs text-zinc-600">Loading filters…</p>}
      >
        <TransactionFilters
          saveId={saveId}
          basePath={basePath}
          group={group}
          range={range}
          teamValue={teamValue}
          search={search}
          teams={view.teams}
          myTeamId={view.myTeamId}
          limit={limit}
        />
      </Suspense>

      {view.groups.length === 0 ? (
        <EmptyState message="No transactions match these filters." />
      ) : (
        <>
          <TransactionTimeline saveId={saveId} groups={view.groups} />
          <p className="text-xs text-zinc-600">
            Showing {view.shown} of {view.total}
          </p>
          {view.hasMore ? (
            <Link
              href={loadMoreHref()}
              className={cn(
                "inline-flex rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600",
                focusRingClass,
              )}
            >
              Load more
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}
