import { notFound } from "next/navigation";
import { loadContractHubView } from "@/application/game-service";
import { ContractHubHeader } from "@/components/contracts/ContractHubHeader";
import { ContractOverview } from "@/components/contracts/ContractOverview";
import { ContractRow } from "@/components/contracts/ContractRow";
import { ManagementDecisionPanel } from "@/components/management/ManagementDecisionPanel";
import { DataTable } from "@/components/owner/DataTable";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import { TeamHubSubNav } from "@/components/team/TeamHubSubNav";

type ContractsPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function TeamContractsPage({
  params,
  searchParams,
}: ContractsPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadContractHubView(saveId);
  if (!view) {
    notFound();
  }

  const returnPath = `/dashboard/${saveId}/team/contracts`;

  return (
    <div className="space-y-8">
      <TeamHubSubNav saveId={saveId} active="contracts" />
      <ContractHubHeader view={view} />
      {error ? <ErrorState message={error} /> : null}

      <ManagementDecisionPanel
        title="Contract Decisions"
        items={view.decisions}
        saveId={saveId}
        currentDate={view.currentDate}
        emptyMessage="No contract decisions need attention right now."
      />

      <ContractOverview saveId={saveId} overview={view.overview} />

      <Section title="Contracts">
        {view.rows.length === 0 ? (
          <EmptyState message="No contracts for this team." />
        ) : (
          <div className="overflow-x-auto">
            <DataTable
              headers={[
                "Player",
                "Salary",
                "Years",
                "Expiration",
                "Option",
                "Status",
                "Action",
              ]}
            >
              {view.rows.map((row) => (
                <ContractRow
                  key={row.contractId}
                  saveId={saveId}
                  row={row}
                  returnPath={returnPath}
                />
              ))}
            </DataTable>
          </div>
        )}
      </Section>
    </div>
  );
}
