import { notFound } from "next/navigation";
import { loadTeamManagementView } from "@/application/game-service";
import { ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { InjuryTable } from "@/components/team-management/InjuryTable";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function InjuriesPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadTeamManagementView(saveId);
  if (!view) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Injury Report"
        subtitle="Current roster availability from the canonical injury model"
      />
      {error ? <ErrorState message={error} /> : null}
      <InjuryTable saveId={saveId} report={view.injuries} />
    </>
  );
}
