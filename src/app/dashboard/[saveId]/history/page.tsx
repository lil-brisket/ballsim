import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRequestSaveStore } from "@/application/request-save-store";
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
  const loaded = await getRequestSaveStore().load(saveId);
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
