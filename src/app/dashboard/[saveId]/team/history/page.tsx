import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { loadSaveWithHistory } from "@/application/game-service";
import { HistoryHub } from "@/components/history/HistoryHub";
import { historyHubHref } from "@/components/history/history-hub-links";
import { TeamHubSubNav } from "@/components/team/TeamHubSubNav";
import { ErrorState } from "@/components/ui/EmptyState";
import {
  misroutedHistoryHubTab,
  toHistoryHubView,
  type HistoryHubParams,
} from "@/state/history-hub-selectors";

export const metadata: Metadata = { title: "Team History" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<HistoryHubParams & { error?: string }>;
};

export default async function TeamHistoryPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error, ...query } = await searchParams;
  const misrouted = misroutedHistoryHubTab("team", query);
  if (misrouted) {
    redirect(historyHubHref(saveId, misrouted, query));
  }
  // Long-retired players and old seasons live in the stored history.
  const loaded = await loadSaveWithHistory(saveId);
  if (!loaded) {
    notFound();
  }

  return (
    <>
      <TeamHubSubNav saveId={saveId} active="history" />
      {error ? <ErrorState message={error} /> : null}
      <HistoryHub view={toHistoryHubView(loaded.state, "team", query)} />
    </>
  );
}
