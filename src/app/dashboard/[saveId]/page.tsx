import { buttonClass } from "@/components/ui/Button";
import type { Metadata } from "next";
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
import { MatchupBanner } from "@/components/owner/dashboard/MatchupBanner";
import { OwnerPanel } from "@/components/owner/dashboard/OwnerPanel";
import { PendingOwnerDecisionPanel } from "@/components/owner/dashboard/PendingOwnerDecisionPanel";
import { RecentActivity } from "@/components/owner/dashboard/RecentActivity";
import { RecentResultsPanel } from "@/components/owner/dashboard/RecentResultsPanel";
import { TeamSnapshotPanel } from "@/components/owner/dashboard/TeamSnapshotPanel";
import { ErrorState } from "@/components/ui/EmptyState";
import {
  cn,
  touchTargetClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import { buildActionCenterView } from "@/state/action-center-selectors";
import { recentFormFromResults } from "@/state/recent-form-selectors";

export const metadata: Metadata = { title: "Front Office" };

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
  const isNextGameFocal = actionCenter.focalMode === "next-game";
  const actionCenterEl = (
    <ActionCenter
      view={actionCenter}
      saveId={saveId}
      returnPath={returnPath}
      aiCanHandle={aiCanHandle}
      letAiHandleAction={letAiHandlePhaseAction}
      alertOnly
    />
  );
  const showOffseasonShortcut = dash.seasonPhase === "offseason";

  return (
    <div className="space-y-8">
      {actionCenterEl}

      <MatchupBanner
        saveId={saveId}
        saveName={save.name}
        leagueName={dash.leagueName}
        team={dash.team}
        teamCity={dash.controlledTeam.city}
        teamName={dash.controlledTeam.name}
        teamBranding={dash.controlledTeam.branding}
        recentForm={recentForm}
        isFocal={isNextGameFocal}
      />

      {error ? <ErrorState message={error} /> : null}

      {showOffseasonShortcut ? (
        <Link
          href={`/dashboard/${saveId}/offseason`}
          className={cn(
            touchTargetClass,
            "rounded-md border border-team-ink/50 bg-team/15 px-3 text-sm text-team-ink hover:border-team-ink",
          )}
        >
          Open Offseason Command Center
        </Link>
      ) : null}

      {dash.flags.pendingOwnerDecision &&
      dash.pendingTradeOffer &&
      dash.pendingTradeOffer.primaryTeamId !== dashboard.controlledTeam.id ? (
        <div
          role="status"
          className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink"
        >
          <p className="font-medium text-warning">
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
                className={cn(
                  buttonClass({ variant: "primary" }),
                  "w-full sm:w-auto",
                )}
              >
                Switch to {dash.pendingTradeOffer.receivingTeamName}
              </button>
            </form>
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
        <p className="text-sm text-warning/80">
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
          className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink"
        >
          Your team is on the draft clock. Make a selection on the Draft screen
          before advancing time.{" "}
          <Link
            href={`/dashboard/${saveId}/draft`}
            className={cn(
              touchTargetTextClass,
              "font-medium text-warning underline",
            )}
          >
            Open Draft
          </Link>
        </p>
      ) : null}

      {dash.flags.seasonReviewPending ? (
        <div
          role="status"
          className="space-y-3 rounded-md border border-line-strong/60 bg-surface-raised/40 px-4 py-3 text-sm text-ink"
        >
          <p className="font-medium text-ink">Season Review</p>
          {dash.seasonRecap ? (
            <ul className="list-inside list-disc space-y-1 text-soft">
              <li>Record: {dash.seasonRecap.record}</li>
              <li>Playoffs: {dash.seasonRecap.playoffResult}</li>
            </ul>
          ) : null}
          {dash.seasonStory ? (
            <p className="text-muted">{dash.seasonStory}</p>
          ) : null}
          <p className="text-muted">
            Continue from the Calendar — time advancement is calendar-driven.
          </p>
          <Link
            href={`/dashboard/${saveId}/calendar`}
            className={buttonClass({ variant: "secondary" })}
          >
            Open Calendar
          </Link>
        </div>
      ) : null}

      <RecentResultsPanel
        saveId={saveId}
        games={recentForm.games}
        team={{
          abbreviation: dash.controlledTeam.abbreviation,
          branding: dash.controlledTeam.branding,
        }}
      />

      {/* Secondary tier: supporting context, quieter than the hero. */}
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <TeamSnapshotPanel team={dash.team} saveId={saveId} />
        <AroundTheLeaguePanel timeline={dash.mediaTimeline} saveId={saveId} />
        <FranchiseHealthPanel health={dash.health} insights={dash.insights} />
        <OwnerPanel owner={dash.owner} saveId={saveId} />
        <div className="opacity-90 lg:col-span-2">
          <RecentActivity activity={dash.activity.slice(0, 5)} />
        </div>
      </div>

      <FranchiseSituations
        saveId={saveId}
        situations={dash.situations}
        returnPath={returnPath}
      />

      <DashboardNotifications
        notifications={dash.notifications}
        saveId={saveId}
      />

      <details className="rounded-xl border border-line bg-surface-raised/30 px-4 py-3">
        <summary className="cursor-pointer text-sm text-muted">
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
