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
        title="Injury Center"
        subtitle="Current roster medical status, restrictions, and recovery — click a player for details"
      />
      {error ? <ErrorState message={error} /> : null}
      <InjuryTable saveId={saveId} report={view.injuries} />
    </>
  );
}
