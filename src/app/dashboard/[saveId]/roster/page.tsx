import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { RosterTable } from "@/components/game/RosterTable";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";

type RosterPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function RosterPage({
  params,
  searchParams,
}: RosterPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Roster"
        subtitle={`${view.roster.length} players on the controlled team`}
        actions={
          <Link
            href={`/dashboard/${saveId}/team`}
            className="text-sm text-amber-400 hover:underline"
          >
            Team overview
          </Link>
        }
      />
      {error ? <ErrorState message={error} /> : null}
      {view.roster.length === 0 ? (
        <EmptyState message="No players on the roster." />
      ) : (
        <RosterTable saveId={saveId} players={view.roster} />
      )}
    </>
  );
}
