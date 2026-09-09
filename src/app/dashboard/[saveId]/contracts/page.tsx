import { notFound } from "next/navigation";
import { loadContractHubView } from "@/application/game-service";
import { ContractHubHeader } from "@/components/contracts/ContractHubHeader";
import { ContractOverview } from "@/components/contracts/ContractOverview";
import { ContractRow } from "@/components/contracts/ContractRow";
import { ManagementDecisionPanel } from "@/components/management/ManagementDecisionPanel";
import { DataTable } from "@/components/owner/DataTable";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";

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
  const view = await loadContractHubView(saveId);
  if (!view) {
    notFound();
  }

  const returnPath = `/dashboard/${saveId}/contracts`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contracts"
        subtitle="Contractual obligations and roster decisions"
      />
      {error ? <ErrorState message={error} /> : null}

      <ContractHubHeader view={view} />

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
