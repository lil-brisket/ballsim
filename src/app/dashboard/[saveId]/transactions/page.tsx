import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { DataTable } from "@/components/owner/DataTable";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";

type TransactionsPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string; type?: string }>;
};

const FILTER_TYPES = [
  "all",
  "ContractSigned",
  "FreeAgentSigned",
  "PlayerTraded",
  "PlayerReleased",
  "DraftPickMade",
  "RevenueRecorded",
  "ExpenseRecorded",
  "GameCompleted",
] as const;

export default async function TransactionsPage({
  params,
  searchParams,
}: TransactionsPageProps) {
  const { saveId } = await params;
  const { error, type } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const filter = type && FILTER_TYPES.includes(type as (typeof FILTER_TYPES)[number])
    ? type
    : "all";
  const rows =
    filter === "all"
      ? view.eventLog
      : view.eventLog.filter((entry) => entry.type === filter);

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Bounded event log (things that happened)"
      />
      {error ? <ErrorState message={error} /> : null}

      <div className="flex flex-wrap gap-2">
        {FILTER_TYPES.map((filterType) => (
          <a
            key={filterType}
            href={
              filterType === "all"
                ? `/dashboard/${saveId}/transactions`
                : `/dashboard/${saveId}/transactions?type=${filterType}`
            }
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === filterType
                ? "border-amber-600 text-amber-400"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            {filterType === "all" ? "All" : filterType}
          </a>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No matching events in the log." />
      ) : (
        <DataTable headers={["Date", "Type", "Description", "Amount"]}>
          {rows.map((entry) => (
            <tr key={entry.id} className="border-t border-zinc-800">
              <td className="px-3 py-2 font-mono text-zinc-500">
                {entry.occurredOn}
              </td>
              <td className="px-3 py-2 text-zinc-400">{entry.type}</td>
              <td className="px-3 py-2 text-zinc-100">{entry.description}</td>
              <td className="px-3 py-2">
                {entry.amount !== null ? (
                  <MoneyDisplay amount={entry.amount} />
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
