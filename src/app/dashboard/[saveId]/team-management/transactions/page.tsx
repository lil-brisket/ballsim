import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadTeamManagementView } from "@/application/game-service";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeamHubSubNav } from "@/components/team/TeamHubSubNav";
import { formatGameDate } from "@/presentation/game-date";

export const metadata: Metadata = { title: "Transactions" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{
    error?: string;
    scope?: string;
    type?: string;
    sort?: string;
    page?: string;
  }>;
};

const FILTER_TYPES = [
  "all",
  "FreeAgentSigned",
  "ContractSigned",
  "PlayerTraded",
  "DraftPickTraded",
  "PlayerReleased",
  "PlayerWaived",
  "PlayerBoughtOut",
  "DraftPickMade",
  "StaffHired",
  "StaffFired",
  "CoachHired",
] as const;

export default async function TeamManagementTransactionsPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const query = await searchParams;
  const view = await loadTeamManagementView(saveId, {
    scope: query.scope === "league" ? "league" : "team",
    type: query.type,
    sort: query.sort,
    page: Number(query.page ?? "0") || 0,
  });
  if (!view) {
    notFound();
  }

  const scope = query.scope === "league" ? "league" : "team";
  const type = FILTER_TYPES.includes(
    query.type as (typeof FILTER_TYPES)[number],
  )
    ? query.type!
    : "all";
  const sort = query.sort ?? "newest";
  const base = `/dashboard/${saveId}/team-management/transactions`;
  const { transactions } = view;
  const totalPages = Math.max(
    1,
    Math.ceil(transactions.total / transactions.pageSize),
  );

  function href(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    const next = {
      scope,
      type,
      sort,
      page: String(transactions.page),
      ...overrides,
    };
    for (const [key, value] of Object.entries(next)) {
      if (value && value !== "all" && value !== "0" && value !== "team") {
        params.set(key, value);
      }
      if (key === "scope" && value === "league") {
        params.set("scope", "league");
      }
      if (key === "type" && value && value !== "all") {
        params.set("type", value);
      }
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  return (
    <>
      <TeamHubSubNav saveId={saveId} active="transactions" />
      <PageHeader title="Transactions" />
      <p className="mb-3 text-sm text-zinc-400">
        Prefer the league ledger?{" "}
        <Link
          href={`/dashboard/${saveId}/transactions`}
          className="text-team-ink underline-offset-4 hover:underline"
        >
          Open Transactions Hub
        </Link>
      </p>
      {query.error ? <ErrorState message={query.error} /> : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href={href({ scope: "team", page: "0" })}
          className={`rounded-full border px-3 py-1 text-sm ${
            scope === "team"
              ? "border-team-ink text-team-ink"
              : "border-zinc-700 text-zinc-400"
          }`}
        >
          My team
        </Link>
        <Link
          href={href({ scope: "league", page: "0" })}
          className={`rounded-full border px-3 py-1 text-sm ${
            scope === "league"
              ? "border-team-ink text-team-ink"
              : "border-zinc-700 text-zinc-400"
          }`}
        >
          League-wide
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_TYPES.map((filterType) => (
          <Link
            key={filterType}
            href={href({ type: filterType, page: "0" })}
            className={`rounded-full border px-3 py-1 text-sm ${
              type === filterType
                ? "border-team-ink text-team-ink"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            {filterType === "all" ? "All" : filterType}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {(
          [
            ["newest", "Newest first"],
            ["oldest", "Oldest first"],
            ["type", "Type"],
            ["team", "Team"],
            ["player", "Player"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={href({ sort: value, page: "0" })}
            className={`rounded-full border px-3 py-1 ${
              sort === value
                ? "border-team-ink text-team-ink"
                : "border-zinc-700 text-zinc-400"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {transactions.rows.length === 0 ? (
        <EmptyState message="No matching transactions this season." />
      ) : (
        <DataTable headers={["Date", "Type", "Details"]}>
          {transactions.rows.map((entry) => (
            <tr key={entry.id} className="border-t border-zinc-800">
              <td className="px-3 py-2 text-zinc-500">
                {formatGameDate(entry.occurredOn)}
              </td>
              <td className="px-3 py-2 text-zinc-400">{entry.type}</td>
              <td className="px-3 py-2 text-zinc-100">{entry.description}</td>
            </tr>
          ))}
        </DataTable>
      )}

      <div className="flex items-center gap-3 text-sm text-zinc-400">
        <span>
          Page {transactions.page + 1} of {totalPages} ({transactions.total}{" "}
          total)
        </span>
        {transactions.page > 0 ? (
          <Link
            href={href({ page: String(transactions.page - 1) })}
            className="text-team-ink underline-offset-4 hover:underline"
          >
            Previous
          </Link>
        ) : null}
        {transactions.page + 1 < totalPages ? (
          <Link
            href={href({ page: String(transactions.page + 1) })}
            className="text-team-ink underline-offset-4 hover:underline"
          >
            Next
          </Link>
        ) : null}
      </div>
    </>
  );
}
