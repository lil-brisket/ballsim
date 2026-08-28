import Link from "next/link";
import { notFound } from "next/navigation";
import {
  beginOffseasonAction,
  continuePastPhaseAction,
  letAiHandlePhaseAction,
  switchActiveOwnerTeamAction,
} from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { AdvanceTimeControls } from "@/components/game/AdvanceTimeControls";
import { SimulationAssistantSummary } from "@/components/game/SimulationAssistantSummary";
import { SimulationPhaseBanner } from "@/components/game/SimulationPhaseBanner";
import { SimulationProgressBanner } from "@/components/game/SimulationProgressBanner";
import { AttentionRequiredPanel } from "@/components/owner/dashboard/AttentionRequiredPanel";
import { DashboardNotifications } from "@/components/owner/dashboard/DashboardNotifications";
import { FranchiseHealthPanel } from "@/components/owner/dashboard/FranchiseHealthPanel";
import { FranchiseSituations } from "@/components/owner/dashboard/FranchiseSituations";
import { OwnerPanel } from "@/components/owner/dashboard/OwnerPanel";
import { PendingOwnerDecisionPanel } from "@/components/owner/dashboard/PendingOwnerDecisionPanel";
import { RecentActivity } from "@/components/owner/dashboard/RecentActivity";
import { TeamDecisionPanel } from "@/components/owner/dashboard/TeamDecisionPanel";
import { ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";

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

  const { save, ownerDashboard: dash, dashboard } = view;
  const returnPath = `/dashboard/${saveId}`;
  const timeDisabled =
    dash.flags.userOnDraftClock ||
    dash.flags.seasonReviewPending ||
    dash.flags.pendingOwnerDecision;
  const phase = dash.simulationPhase;
  const unresolvedWarning =
    phase.unresolvedDecisionCount > 0 && phase.responsibility === "unresolved"
      ? `${phase.primaryLabel} has ${phase.unresolvedDecisionCount} unresolved decision${phase.unresolvedDecisionCount === 1 ? "" : "s"}`
      : null;
  const aiCanHandle =
    phase.aiAssistEnabled && phase.unresolvedDecisionCount > 0;
  const goToHref =
    dash.offseasonStage === "free_agency"
      ? `/dashboard/${saveId}/free-agency`
      : dash.offseasonStage === "draft"
        ? `/dashboard/${saveId}/draft`
        : `/dashboard/${saveId}`;

  return (
    <>
      <PageHeader
        title={`${dash.controlledTeam.city} ${dash.controlledTeam.name}`}
        subtitle={`${save.name} · ${dash.leagueName}`}
        actions={
          <AdvanceTimeControls
            saveId={save.id}
            returnPath={returnPath}
            disabled={timeDisabled}
            untilPhaseLabel={phase.nextPhaseLabel ?? undefined}
            unresolvedWarning={unresolvedWarning}
            requiresConfirm={Boolean(unresolvedWarning)}
            confirmTitle={`${phase.primaryLabel} is still active`}
            confirmDescription={
              unresolvedWarning
                ? `${unresolvedWarning}. What would you like to do?`
                : undefined
            }
            goToHref={goToHref}
            letAiHandleAction={letAiHandlePhaseAction}
            continueAnywayAction={continuePastPhaseAction}
            assistantSummary={
              <SimulationAssistantSummary
                assistance={dashboard.activeFranchiseAi.assistance}
                compact
              />
            }
          />
        }
      />

      {error ? <ErrorState message={error} /> : null}

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

      <SimulationPhaseBanner
        phase={phase}
        currentDate={dash.currentDate}
      />

      <SimulationProgressBanner
        seasonYear={dash.seasonYear}
        phase={phase.primaryLabel}
        currentDate={dash.currentDate}
      />

      {dash.flags.userOnDraftClock ? (
        <p
          role="status"
          className="rounded-md border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-200"
        >
          Your team is on the draft clock. Make a selection on the Draft screen
          before advancing time.
        </p>
      ) : null}

      {dash.flags.seasonReviewPending ? (
        <div
          role="status"
          className="space-y-3 rounded-md border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
        >
          <p className="font-medium text-amber-200">Season Review</p>
          {dash.seasonRecap ? (
            <ul className="list-inside list-disc space-y-1 text-amber-100/90">
              <li>Record: {dash.seasonRecap.record}</li>
              <li>Playoffs: {dash.seasonRecap.playoffResult}</li>
              <li>
                Net income:{" "}
                {dash.seasonRecap.netIncome.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                })}
              </li>
              <li>
                Objectives: {dash.seasonRecap.completedObjectives} completed /{" "}
                {dash.seasonRecap.failedObjectives} failed
              </li>
            </ul>
          ) : null}
          {dash.seasonStory ? (
            <p className="text-amber-100/80">{dash.seasonStory}</p>
          ) : null}
          <form action={beginOffseasonAction}>
            <input type="hidden" name="saveId" value={saveId} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <button
              type="submit"
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            >
              Begin Offseason
            </button>
          </form>
        </div>
      ) : null}

      {dash.seasonStory && !dash.flags.seasonReviewPending ? (
        <p className="text-sm text-zinc-400">{dash.seasonStory}</p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="order-2 space-y-4 lg:order-1">
          <FranchiseHealthPanel
            health={dash.health}
            insights={dash.insights}
          />
        </div>
        <div className="order-1 space-y-4 lg:order-2">
          <AttentionRequiredPanel
            items={dash.actionItems}
            responsibility={dash.phaseResponsibility}
            saveId={saveId}
            returnPath={returnPath}
            aiCanHandle={aiCanHandle}
            letAiHandleAction={letAiHandlePhaseAction}
          />
          <FranchiseSituations
            saveId={saveId}
            situations={dash.situations}
            returnPath={returnPath}
          />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="order-3">
          <TeamDecisionPanel team={dash.team} saveId={saveId} />
        </div>
        <div className="order-4">
          <OwnerPanel owner={dash.owner} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="order-5">
          <DashboardNotifications
            notifications={dash.notifications}
            saveId={saveId}
          />
        </div>
        <div className="order-6">
          <RecentActivity activity={dash.activity} />
        </div>
      </div>
    </>
  );
}
