import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSaveWithHistory } from "@/application/game-service";
import { ErrorState } from "@/components/ui/EmptyState";
import { HistoryHub } from "@/components/history/HistoryHub";
import {
  toHistoryHubView,
  type HistoryHubParams,
} from "@/state/history-hub-selectors";

export const metadata: Metadata = { title: "History" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<HistoryHubParams & { error?: string }>;
};

export default async function HistoryPage({ params, searchParams }: PageProps) {
  const { saveId } = await params;
  const { error, ...query } = await searchParams;
  // Long-retired players and old seasons live in the stored history.
  const loaded = await loadSaveWithHistory(saveId);
  if (!loaded) {
    notFound();
  }

  return (
    <>
      {error ? <ErrorState message={error} /> : null}
      <p className="mb-4 text-sm">
        <Link
          href={`/dashboard/${saveId}/history/legacy`}
          className="text-team-ink underline-offset-4 hover:underline"
        >
          Legacy: record book, Hall of Fame and retired numbers
        </Link>
      </p>
      <HistoryHub view={toHistoryHubView(loaded.state, "history", query)} />
    </>
  );
}
