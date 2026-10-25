import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSaveWithHistory } from "@/application/game-service";
import Link from "next/link";
import { HallOfFame, RecordBook } from "@/components/history/LegacyPanels";
import { ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { toLegacyView, toRecordBookView } from "@/state/legacy-selectors";

export const metadata: Metadata = { title: "Legacy" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** Record book and Hall of Fame. */
export default async function LegacyPage({ params, searchParams }: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  // The record book reads every finished season's box scores.
  const loaded = await loadSaveWithHistory(saveId);
  if (!loaded) {
    notFound();
  }
  const records = toRecordBookView(loaded.state);
  const legacy = toLegacyView(loaded.state);
  return (
    <div className="space-y-6">
      <PageHeader title="Legacy" subtitle="Records and Hall of Fame" />
      {error ? <ErrorState message={error} /> : null}
      <p className="text-sm">
        <Link
          href={`/dashboard/${saveId}/team/history?tab=jerseys`}
          className="text-team-ink underline-offset-4 hover:underline"
        >
          Retired numbers
        </Link>
      </p>
      <HallOfFame saveId={saveId} legacy={legacy} />
      <RecordBook saveId={saveId} records={records} />
    </div>
  );
}
