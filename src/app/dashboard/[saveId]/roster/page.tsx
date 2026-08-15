import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { ContractSummary } from "@/components/owner/ContractSummary";
import { DataTable } from "@/components/owner/DataTable";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { StatusBadge } from "@/components/owner/StatusBadge";

type RosterPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function RosterPage({
  params,
  searchParams,
}: RosterPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Roster"
        subtitle={`${view.roster.length} players on the controlled team`}
      />
      {error ? <ErrorState message={error} /> : null}
      {view.roster.length === 0 ? (
        <EmptyState message="No players on the roster." />
      ) : (
        <DataTable
          headers={[
            "Player",
            "Pos",
            "Age",
            "OVR",
            "Contract",
            "Status",
            "Dev",
          ]}
        >
          {view.roster.map((player) => (
            <tr key={player.playerId} className="border-t border-zinc-800">
              <td className="px-3 py-2">
                <Link
                  href={`/dashboard/${saveId}/players/${player.playerId}`}
                  className="text-amber-400 hover:underline"
                >
                  {player.firstName} {player.lastName}
                </Link>
              </td>
              <td className="px-3 py-2 text-zinc-400">{player.position}</td>
              <td className="px-3 py-2 text-zinc-400">{player.age}</td>
              <td className="px-3 py-2 text-zinc-200">{player.overall}</td>
              <td className="px-3 py-2">
                <ContractSummary
                  salary={player.contractSalary}
                  endYear={player.contractEndYear}
                  yearsRemaining={player.contractYearsRemaining}
                />
              </td>
              <td className="px-3 py-2">
                <StatusBadge
                  label={player.injuryKind}
                  tone={player.injuryKind}
                />
              </td>
              <td className="px-3 py-2 text-zinc-400">
                {player.developmentStage}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
