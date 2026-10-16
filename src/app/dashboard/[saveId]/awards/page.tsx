import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRequestSaveStore } from "@/application/request-save-store";
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
  const loaded = await getRequestSaveStore().load(saveId);
  if (!loaded) {
    notFound();
  }

  return <HistoryHub view={toHistoryHubView(loaded.state, "awards", query)} />;
}
