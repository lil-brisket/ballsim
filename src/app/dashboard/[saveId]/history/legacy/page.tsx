import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRequestSaveStore } from "@/application/request-save-store";
import { LegacyHonors, RecordBook } from "@/components/history/LegacyPanels";
import { ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { toLegacyView, toRecordBookView } from "@/state/legacy-selectors";

export const metadata: Metadata = { title: "Legacy" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** Record book, Hall of Fame and retired numbers. */
export default async function LegacyPage({ params, searchParams }: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const loaded = await getRequestSaveStore().load(saveId);
  if (!loaded) {
    notFound();
  }
  const records = toRecordBookView(loaded.state);
  const legacy = toLegacyView(loaded.state);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Legacy"
        subtitle="Records, Hall of Fame and retired numbers"
      />
      {error ? <ErrorState message={error} /> : null}
      <LegacyHonors
        saveId={saveId}
        returnPath={`/dashboard/${saveId}/history/legacy`}
        legacy={legacy}
      />
      <RecordBook saveId={saveId} records={records} />
    </div>
  );
}
