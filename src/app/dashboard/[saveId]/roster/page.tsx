import { notFound } from "next/navigation";
import { loadOwnerSaveView, loadTeamManagementView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { TeamHubSubNav } from "@/components/team/TeamHubSubNav";
import {
  RosterViewSwitcher,
  type RosterViewMode,
} from "@/components/roster/RosterViewSwitcher";

type RosterPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string; view?: string }>;
};

export default async function RosterPage({
  params,
  searchParams,
}: RosterPageProps) {
  const { saveId } = await params;
  const { error, view: viewParam } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const tm = await loadTeamManagementView(saveId);
  const lineup = tm?.lineup;
  if (!lineup) {
    notFound();
  }

  const rosterView: RosterViewMode =
    viewParam === "cards" || viewParam === "depth" ? viewParam : "table";

  return (
    <>
      <TeamHubSubNav saveId={saveId} active="roster" />
      <PageHeader
        title="Roster"
        subtitle={`${view.roster.length} players on the controlled team`}
      />
      {error ? <ErrorState message={error} /> : null}
      {view.roster.length === 0 ? (
        <EmptyState message="No players on the roster." />
      ) : (
        <RosterViewSwitcher
          saveId={saveId}
          players={view.roster}
          lineup={lineup}
          view={rosterView}
        />
      )}
    </>
  );
}
