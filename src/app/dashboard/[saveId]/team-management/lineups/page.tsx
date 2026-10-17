import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRequestSaveStore } from "@/application/request-save-store";
import { loadTeamManagementView } from "@/application/game-service";
import { ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeamHubSubNav } from "@/components/team/TeamHubSubNav";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import { LineupRotationEditor } from "@/components/team-management/LineupRotationEditor";

export const metadata: Metadata = { title: "Lineup & Rotation" };

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

  const loaded = await getRequestSaveStore().load(saveId);
  const portraits = Object.fromEntries(
    [
      ...view.lineup.starters,
      ...view.lineup.bench,
      ...view.lineup.inactive,
    ].map((player) => [
      player.playerId,
      loaded ? selectPlayerPortrait(loaded.state, player.playerId) : null,
    ]),
  );

  return (
    <>
      <TeamHubSubNav saveId={saveId} active="lineupRotation" />
      <PageHeader title="Lineup & Rotation" />
      {error ? <ErrorState message={error} /> : null}
      <LineupRotationEditor
        saveId={saveId}
        lineup={view.lineup}
        rotation={view.rotation}
        portraits={portraits}
      />
    </>
  );
}
