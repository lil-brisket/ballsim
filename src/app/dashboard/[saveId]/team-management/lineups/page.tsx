import { notFound } from "next/navigation";
import { loadTeamManagementView } from "@/application/game-service";
import { ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { TeamHubSubNav } from "@/components/team/TeamHubSubNav";
import { LineupRotationEditor } from "@/components/team-management/LineupRotationEditor";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function LineupsPage({ params, searchParams }: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadTeamManagementView(saveId);
  if (!view) {
    notFound();
  }

  return (
    <>
      <TeamHubSubNav saveId={saveId} active="lineupRotation" />
      <PageHeader
        title="Lineup & Rotation"
        subtitle="Starting five, minutes, roles, and closing lineup"
      />
      {error ? <ErrorState message={error} /> : null}
      <LineupRotationEditor
        saveId={saveId}
        lineup={view.lineup}
        rotation={view.rotation}
      />
    </>
  );
}
