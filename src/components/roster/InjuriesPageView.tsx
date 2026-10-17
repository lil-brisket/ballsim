import { notFound } from "next/navigation";
import { loadTeamManagementView } from "@/application/game-service";
import { ErrorState } from "@/components/ui/EmptyState";
import { InjuryTable } from "@/components/team-management/InjuryTable";
import { PageHeader } from "@/components/ui/PageHeader";

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
      <PageHeader title="Injury Center" />
      {props.error ? <ErrorState message={props.error} /> : null}
      <InjuryTable saveId={props.saveId} report={view.injuries} />
    </>
  );
}
