import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { TeamHub } from "@/components/team/hub/TeamHub";

type TeamPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/**
 * Team Hub — management workspace for the controlled franchise.
 */
export default async function TeamOverviewPage({
  params,
  searchParams,
}: TeamPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  return <TeamHub saveId={saveId} hub={view.teamHub} error={error} />;
}
