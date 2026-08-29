import { notFound, redirect } from "next/navigation";
import { loadFantasyDraftView } from "@/application/game-service";
import { FantasyDraftBoard } from "@/components/fantasy-draft/FantasyDraftBoard";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function FantasyDraftPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const loaded = await loadFantasyDraftView(saveId);
  if (!loaded) {
    notFound();
  }
  if (loaded.draft.status === "setup") {
    redirect(`/new/${saveId}/fantasy-draft/setup`);
  }
  if (loaded.draft.status === "complete") {
    redirect(`/fantasy-draft/${saveId}/summary`);
  }

  return (
    <FantasyDraftBoard
      saveId={saveId}
      draft={loaded.draft}
      error={error}
    />
  );
}
