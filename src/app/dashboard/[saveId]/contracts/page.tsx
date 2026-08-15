import { notFound } from "next/navigation";
import {
  declineTeamOptionAction,
  exerciseTeamOptionAction,
} from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import { DataTable } from "@/components/owner/DataTable";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { StatusBadge } from "@/components/owner/StatusBadge";

type ContractsPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function ContractsPage({
  params,
  searchParams,
}: ContractsPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const returnPath = `/dashboard/${saveId}/contracts`;

  return (
    <>
      <PageHeader
        title="Contracts"
        subtitle="Controlled team contracts from business.contracts"
      />
      {error ? <ErrorState message={error} /> : null}
      {view.contracts.length === 0 ? (
        <EmptyState message="No contracts for this team." />
      ) : (
        <DataTable
          headers={[
            "Player",
            "Pos",
            "Salary",
            "Years",
            "Status",
            "Options",
          ]}
        >
          {view.contracts.map((row) => (
            <tr key={row.contractId} className="border-t border-zinc-800">
              <td className="px-3 py-2 text-zinc-100">{row.playerName}</td>
              <td className="px-3 py-2 text-zinc-400">{row.position}</td>
              <td className="px-3 py-2">
                {row.salary !== null ? (
                  <MoneyDisplay amount={row.salary} />
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2 text-zinc-400">
                {row.startYear}–{row.endYear} ({row.yearsRemaining}y)
              </td>
              <td className="px-3 py-2">
                <StatusBadge label={row.status} />
              </td>
              <td className="px-3 py-2">
                {row.hasPendingTeamOption ? (
                  <div className="flex flex-wrap gap-3">
                    <ConfirmDialog
                      title="Exercise team option"
                      description={`Exercise the pending team option for ${row.playerName}.`}
                      confirmLabel="Exercise"
                    >
                      <form action={exerciseTeamOptionAction}>
                        <input type="hidden" name="saveId" value={saveId} />
                        <input
                          type="hidden"
                          name="contractId"
                          value={row.contractId}
                        />
                        <input
                          type="hidden"
                          name="returnPath"
                          value={returnPath}
                        />
                        <button
                          type="submit"
                          className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950"
                        >
                          Confirm exercise
                        </button>
                      </form>
                    </ConfirmDialog>
                    <ConfirmDialog
                      title="Decline team option"
                      description={`Decline the pending team option for ${row.playerName}.`}
                      confirmLabel="Decline"
                    >
                      <form action={declineTeamOptionAction}>
                        <input type="hidden" name="saveId" value={saveId} />
                        <input
                          type="hidden"
                          name="contractId"
                          value={row.contractId}
                        />
                        <input
                          type="hidden"
                          name="returnPath"
                          value={returnPath}
                        />
                        <button
                          type="submit"
                          className="rounded-md border border-rose-700 px-3 py-1.5 text-sm text-rose-300"
                        >
                          Confirm decline
                        </button>
                      </form>
                    </ConfirmDialog>
                  </div>
                ) : row.hasPendingPlayerOption ? (
                  <span className="text-xs text-zinc-500">Player option</span>
                ) : (
                  <span className="text-xs text-zinc-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
