import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  letAiHandlePhaseAction,
  switchActiveOwnerTeamAction,
} from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { BoardDirectiveCard } from "@/components/owner/dashboard/BoardDirectiveCard";
import { HomeHero } from "@/components/owner/dashboard/HomeHero";
import { HomeTileBoard } from "@/components/owner/dashboard/HomeTileBoard";
import { RecentResultsPanel } from "@/components/owner/dashboard/RecentResultsPanel";
import { ErrorState } from "@/components/ui/EmptyState";
import { buildActionCenterView } from "@/state/action-center-selectors";
import { recentFormFromResults } from "@/state/recent-form-selectors";

export const metadata: Metadata = { title: "Front Office" };

type DashboardPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/**
 * Home: one hero for the situation that matters now, the last five results,
 * then a tile per hub. Everything else lives on its own hub page.
 */
export default async function DashboardPage({
  params,
  searchParams,
}: DashboardPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const { ownerDashboard: dash, dashboard } = view;
  const phase = dash.simulationPhase;
  const aiCanHandle =
    phase.aiAssistEnabled && phase.unresolvedDecisionCount > 0;

  const actionCenter = buildActionCenterView({
    actionItems: dash.actionItems,
    phaseResponsibility: dash.phaseResponsibility,
    currentDate: dash.currentDate,
    saveId,
    daysUntilTradeDeadline: dash.daysUntilTradeDeadline,
  });

  const recentForm = recentFormFromResults(dashboard.recentResults);

  return (
    <div className="space-y-3">
      {error ? <ErrorState message={error} /> : null}

      <BoardDirectiveCard board={dash.owner.ownership.board} saveId={saveId} />

      <HomeHero
        saveId={saveId}
        dash={dash}
        actionCenter={actionCenter}
        aiCanHandle={aiCanHandle}
        letAiHandleAction={letAiHandlePhaseAction}
        switchTeamAction={switchActiveOwnerTeamAction}
      />

      <RecentResultsPanel
        saveId={saveId}
        games={recentForm.games}
        team={{
          abbreviation: dash.controlledTeam.abbreviation,
          branding: dash.controlledTeam.branding,
        }}
      />

      <HomeTileBoard saveId={saveId} data={dash} />
    </div>
  );
}
