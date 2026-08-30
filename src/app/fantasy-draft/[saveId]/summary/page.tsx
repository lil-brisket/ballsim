import { notFound, redirect } from "next/navigation";
import { loadFantasyDraftSummaryView } from "@/application/game-service";
import { FantasyDraftSummaryClient } from "@/components/fantasy-draft/summary/FantasyDraftSummaryClient";

type PageProps = {
  params: Promise<{ saveId: string }>;
};

export default async function FantasyDraftSummaryPage({ params }: PageProps) {
  const { saveId } = await params;
  const loaded = await loadFantasyDraftSummaryView(saveId);
  if (!loaded) {
    const { loadFantasyDraftView } = await import(
      "@/application/game-service"
    );
    const draftLoaded = await loadFantasyDraftView(saveId);
    if (!draftLoaded) {
      notFound();
    }
    if (draftLoaded.draft.status === "setup") {
      redirect(`/new/${saveId}/fantasy-draft/setup`);
    }
    if (draftLoaded.draft.status !== "complete") {
      redirect(`/fantasy-draft/${saveId}`);
    }
    notFound();
  }

  return (
    <FantasyDraftSummaryClient saveId={saveId} view={loaded.summary} />
  );
}
