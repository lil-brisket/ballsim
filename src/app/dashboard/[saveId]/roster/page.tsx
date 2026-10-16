import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { loadRosterPageView } from "@/application/game-service";
import { ErrorState } from "@/components/ui/EmptyState";
import { TeamHubSubNav } from "@/components/team/TeamHubSubNav";
import { RosterPage } from "@/components/roster/RosterPage";

export const metadata: Metadata = { title: "Roster" };

type RosterPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string; tab?: string }>;
};

export default async function RosterRoutePage({
  params,
  searchParams,
}: RosterPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const loaded = await loadRosterPageView(saveId);
  if (!loaded) {
    notFound();
  }

  return (
    <>
      <TeamHubSubNav saveId={saveId} active="roster" />
      {error ? <ErrorState message={error} /> : null}
      <Suspense
        fallback={<p className="text-sm text-zinc-500">Loading roster…</p>}
      >
        <RosterPage view={loaded.rosterPage} />
      </Suspense>
    </>
  );
}
