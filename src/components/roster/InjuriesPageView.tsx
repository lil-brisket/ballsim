import { notFound } from "next/navigation";
import { loadTeamManagementView } from "@/application/game-service";
import { ErrorState } from "@/components/owner/EmptyState";
import { InjuryTable } from "@/components/team-management/InjuryTable";
import { PageHeader } from "@/components/owner/PageHeader";

export async function InjuriesPageView(props: {
  saveId: string;
  error?: string;
}) {
  const view = await loadTeamManagementView(props.saveId);
  if (!view) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Injury Center"
        subtitle="Current roster medical status, restrictions, and recovery — click a player for details"
      />
      {props.error ? <ErrorState message={props.error} /> : null}
      <InjuryTable saveId={props.saveId} report={view.injuries} />
    </>
  );
}
