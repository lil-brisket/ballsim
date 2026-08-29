import { notFound } from "next/navigation";
import { loadTeamManagementView } from "@/application/game-service";
import { ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { RotationEditor } from "@/components/team-management/RotationEditor";

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

  return (
    <>
      <PageHeader
        title="Rotations"
        subtitle="Set targets, min/max, and priority — the simulation decides actual minutes"
      />
      {error ? <ErrorState message={error} /> : null}
      <RotationEditor saveId={saveId} rotation={view.rotation} />
    </>
  );
}
