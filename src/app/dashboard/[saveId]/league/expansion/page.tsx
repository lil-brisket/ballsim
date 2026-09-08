import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { LeagueExpansionPanel } from "@/components/league/LeagueExpansionPanel";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** Thin compatibility wrapper — existing expansion UI, no redesign. */
export default async function LeagueExpansionPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  return (
    <LeagueExpansionPanel
      saveId={saveId}
      returnPath={`/dashboard/${saveId}/league/expansion`}
      eco={view.leagueEconomy}
      expansion={view.expansion}
      assessment={view.expansionAssessment}
      error={error}
    />
  );
}
