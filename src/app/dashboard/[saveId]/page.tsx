import Link from "next/link";
import { notFound } from "next/navigation";
import {
  advanceLeaguePhaseAction,
  dismissPhaseTaskAction,
  letAiHandlePhaseAction,
  switchActiveOwnerTeamAction,
} from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { PhaseDashboard } from "@/components/phase/PhaseDashboard";
import { ActionCenter } from "@/components/action-center/ActionCenter";
import { AroundTheLeaguePanel } from "@/components/owner/dashboard/AroundTheLeaguePanel";
import { DashboardNotifications } from "@/components/owner/dashboard/DashboardNotifications";
import { FranchiseHealthPanel } from "@/components/owner/dashboard/FranchiseHealthPanel";
import { FranchiseSituations } from "@/components/owner/dashboard/FranchiseSituations";
import { FrontOfficeHeader } from "@/components/owner/dashboard/FrontOfficeHeader";
import { NextGamePanel } from "@/components/owner/dashboard/NextGamePanel";
import { OwnerPanel } from "@/components/owner/dashboard/OwnerPanel";
import { PendingOwnerDecisionPanel } from "@/components/owner/dashboard/PendingOwnerDecisionPanel";
import { RecentActivity } from "@/components/owner/dashboard/RecentActivity";
import { RecentResultsPanel } from "@/components/owner/dashboard/RecentResultsPanel";
import { TeamSnapshotPanel } from "@/components/owner/dashboard/TeamSnapshotPanel";
import { ErrorState } from "@/components/owner/EmptyState";
import { buildActionCenterView } from "@/state/action-center-selectors";
import { recentFormFromResults } from "@/state/recent-form-selectors";

type DashboardPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

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

  const { save, ownerDashboard: dash, dashboard, phaseDashboard } = view;
  const returnPath = `/dashboard/${saveId}`;
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
  const nextGame = dash.team.upcomingGames[0];
  const nextOpponentLabel = nextGame
    ? `${nextGame.home ? "vs" : "@"} ${nextGame.opponentAbbreviation}`
    : null;
  const isNextGameFocal = actionCenter.focalMode === "next-game";
  const showOffseasonShortcut = dash.seasonPhase === "offseason";

  return (
    <div className="space-y-8">
      <FrontOfficeHeader
        saveId={saveId}
        saveName={save.name}
        leagueName={dash.leagueName}
        currentDate={dash.currentDate}
        seasonYear={dash.seasonYear}
        seasonPhaseLabel={phase.primaryLabel}
        teamCity={dash.controlledTeam.city}
        teamName={dash.controlledTeam.name}
        wins={dash.team.wins}
        losses={dash.team.losses}
        leagueRank={dash.team.leagueRank}
        nextOpponentLabel={nextOpponentLabel}
      />

      {error ? <ErrorState message={error} /> : null}

      {showOffseasonShortcut ? (
        <Link
          href={`/dashboard/${saveId}/offseason`}
          className="inline-flex rounded-md border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200 hover:border-amber-600"
        >
          Open Offseason Command Center
        </Link>
      ) : null}

      {dash.flags.pendingOwnerDecision &&
      dash.pendingTradeOffer &&
      dash.pendingTradeOffer.primaryTeamId !==
        dashboard.controlledTeam.id ? (
        <div
          role="status"
          className="rounded-md border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
        >
          <p className="font-medium text-amber-200">
            {dash.pendingTradeOffer.receivingTeamName} needs your attention
            before time can advance.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={switchActiveOwnerTeamAction}>
              <input type="hidden" name="saveId" value={saveId} />
              <input
                type="hidden"
                name="teamId"
                value={dash.pendingTradeOffer.primaryTeamId}
              />
              <button
                type="submit"
                className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500"
              >
                Switch to {dash.pendingTradeOffer.receivingTeamName}
              </button>
            </form>
            <Link
              href={`/dashboard/${saveId}/teams`}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600"
            >
              Open My Teams
            </Link>
          </div>
        </div>
      ) : null}

      {dash.pendingTradeOffer ? (
        <PendingOwnerDecisionPanel
          saveId={saveId}
          returnPath={returnPath}
          offer={dash.pendingTradeOffer}
        />
      ) : null}

      {dash.tradeInbox.totalPending > 1 ? (
        <p className="text-xs text-amber-200/80">
          {dash.tradeInbox.totalPending} trade offers pending
          {dash.tradeInbox.pendingForActiveTeam > 0
            ? ` (${dash.tradeInbox.pendingForActiveTeam} for this team)`
            : ""}
          .
        </p>
      ) : null}

      {dash.flags.userOnDraftClock ? (
        <p
          role="status"
          className="rounded-md border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-200"
        >
          Your team is on the draft clock. Make a selection on the Draft screen
          before advancing time.{" "}
          <Link
            href={`/dashboard/${saveId}/draft`}
            className="font-medium text-amber-300 underline"
          >
            Open Draft
          </Link>
        </p>
      ) : null}

      {dash.flags.seasonReviewPending ? (
        <div
          role="status"
          className="space-y-3 rounded-md border border-zinc-700/60 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-200"
        >
          <p className="font-medium text-zinc-100">Season Review</p>
          {dash.seasonRecap ? (
            <ul className="list-inside list-disc space-y-1 text-zinc-300">
              <li>Record: {dash.seasonRecap.record}</li>
              <li>Playoffs: {dash.seasonRecap.playoffResult}</li>
            </ul>
          ) : null}
          {dash.seasonStory ? (
            <p className="text-zinc-400">{dash.seasonStory}</p>
          ) : null}
          <p className="text-zinc-400">
            Continue from the Calendar — time advancement is calendar-driven.
          </p>
          <Link
            href={`/dashboard/${saveId}/calendar`}
            className="inline-block rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
          >
            Open Calendar
          </Link>
        </div>
      ) : null}

      <ActionCenter
        view={actionCenter}
        saveId={saveId}
        returnPath={returnPath}
        aiCanHandle={aiCanHandle}
        letAiHandleAction={letAiHandlePhaseAction}
      />

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <NextGamePanel
          team={dash.team}
          saveId={saveId}
          teamRecord={`${dash.team.wins}–${dash.team.losses}`}
          recentForm={recentForm}
          isFocal={isNextGameFocal}
        />
        <TeamSnapshotPanel
          team={dash.team}
          saveId={saveId}
          recentForm={recentForm}
        />
      </div>

      <RecentResultsPanel saveId={saveId} games={recentForm.games} />

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <AroundTheLeaguePanel
          headlines={dash.mediaHeadlines}
          saveId={saveId}
        />
        <div className="opacity-90">
          <RecentActivity activity={dash.activity.slice(0, 5)} />
        </div>
      </div>

      <FranchiseSituations
        saveId={saveId}
        situations={dash.situations}
        returnPath={returnPath}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <FranchiseHealthPanel health={dash.health} insights={dash.insights} />
        <OwnerPanel owner={dash.owner} />
      </div>

      <DashboardNotifications
        notifications={dash.notifications}
        saveId={saveId}
      />

      <details className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
        <summary className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
          Phase details (optional)
        </summary>
        <div className="mt-4">
          <PhaseDashboard
            view={phaseDashboard}
            saveId={saveId}
            returnPath={returnPath}
            currentDate={dash.currentDate}
            seasonYear={dash.seasonYear}
            advanceAction={advanceLeaguePhaseAction}
            dismissAction={dismissPhaseTaskAction}
            switchTeamAction={switchActiveOwnerTeamAction}
          />
        </div>
      </details>
    </div>
  );
}
