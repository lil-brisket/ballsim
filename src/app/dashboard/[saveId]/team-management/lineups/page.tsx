import { notFound } from "next/navigation";
import { loadTeamManagementView } from "@/application/game-service";
import { ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { LineupEditor } from "@/components/team-management/LineupEditor";

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
      <PageHeader
        title="Lineups"
        subtitle="Starting five, bench, and inactive assignments"
      />
      {error ? <ErrorState message={error} /> : null}
      <LineupEditor
        saveId={saveId}
        lineup={view.lineup}
        recommendation={view.recommendation}
      />
    </>
  );
}
