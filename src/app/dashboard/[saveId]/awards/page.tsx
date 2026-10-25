import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSaveWithHistory } from "@/application/game-service";
import { HistoryHub } from "@/components/history/HistoryHub";
import {
  toHistoryHubView,
  type HistoryHubParams,
} from "@/state/history-hub-selectors";

export const metadata: Metadata = { title: "Awards" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<HistoryHubParams>;
};

export default async function AwardsPage({ params, searchParams }: PageProps) {
  const { saveId } = await params;
  const query = await searchParams;
  // Long-retired players and old seasons live in the stored history.
  const loaded = await loadSaveWithHistory(saveId);
  if (!loaded) {
    notFound();
  }

  return <HistoryHub view={toHistoryHubView(loaded.state, "awards", query)} />;
}
