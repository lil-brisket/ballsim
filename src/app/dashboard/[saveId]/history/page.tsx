import { notFound } from "next/navigation";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";
import { ErrorState } from "@/components/owner/EmptyState";
import { HistoryHub } from "@/components/history/HistoryHub";
import {
  toHistoryHubView,
  type HistoryHubParams,
} from "@/state/history-hub-selectors";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<HistoryHubParams & { error?: string }>;
};

export default async function HistoryPage({ params, searchParams }: PageProps) {
  const { saveId } = await params;
  const { error, ...query } = await searchParams;
  const loaded = await prismaSaveGameStore.load(saveId);
  if (!loaded) {
    notFound();
  }

  return (
    <>
      {error ? <ErrorState message={error} /> : null}
      <HistoryHub view={toHistoryHubView(loaded.state, "history", query)} />
    </>
  );
}
