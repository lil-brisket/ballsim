import { notFound } from "next/navigation";
import { loadTeamManagementView } from "@/application/game-service";
import { ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { TeamHubSubNav } from "@/components/team/TeamHubSubNav";
import { RotationEditor } from "@/components/team-management/RotationEditor";
import { getRegulationTeamMinutesTarget } from "@/systems/roster-management";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function RotationsPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadTeamManagementView(saveId);
  if (!view) {
    notFound();
  }

  const preview = view.optimizePreview;
  const totalMinutes = preview.management.rotation.reduce(
    (sum, entry) => sum + entry.targetMinutes,
    0,
  );
  const playerCount = preview.management.rotation.filter(
    (entry) =>
      entry.targetMinutes >= ROTATION_CONFIG.meaningfulRotationMinutes,
  ).length;

  const recommendationPreview = {
    playerCount,
    totalMinutes,
    targetMinutes: getRegulationTeamMinutesTarget(),
    changelog: preview.changelog,
    reasons: [
      "Better role hierarchy",
      "Improved injury coverage",
      "Better minute distribution",
    ],
  };

  return (
    <>
      <TeamHubSubNav saveId={saveId} active="rotation" />
      <PageHeader
        title="Rotations"
        subtitle="Distribute available minutes — starters, bench hierarchy, and Target MPG"
      />
      {error ? <ErrorState message={error} /> : null}
      <RotationEditor
        saveId={saveId}
        rotation={view.rotation}
        recommendationPreview={recommendationPreview}
      />
    </>
  );
}
