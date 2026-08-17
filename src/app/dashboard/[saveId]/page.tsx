import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { AdvanceTimeControls } from "@/components/game/AdvanceTimeControls";
import { ActionQueue } from "@/components/owner/dashboard/ActionQueue";
import { DashboardNotifications } from "@/components/owner/dashboard/DashboardNotifications";
import { FranchiseHealthPanel } from "@/components/owner/dashboard/FranchiseHealthPanel";
import { OwnerPanel } from "@/components/owner/dashboard/OwnerPanel";
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

  const { save, ownerDashboard: dash } = view;
  const returnPath = `/dashboard/${saveId}`;

  return (
    <>
      <PageHeader
        title={`${dash.controlledTeam.city} ${dash.controlledTeam.name}`}
        subtitle={`${save.name} · ${dash.leagueName}`}
        actions={
          <AdvanceTimeControls
            saveId={save.id}
            returnPath={returnPath}
            simulationFrequency={dash.simulationFrequency}
            disabled={dash.flags.userOnDraftClock}
          />
        }
      />

      {error ? <ErrorState message={error} /> : null}

      {dash.flags.userOnDraftClock ? (
        <p
          role="status"
          className="rounded-md border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-200"
        >
          Your team is on the draft clock. Make a selection on the Draft screen
          before advancing time.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
        <span className="font-mono text-zinc-500">{dash.currentDate}</span>
        <span>
          Phase: {dash.seasonPhase}
          {dash.offseasonStage !== "none" ? ` / ${dash.offseasonStage}` : ""}
        </span>
      </div>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="order-2 space-y-4 lg:order-1">
          <FranchiseHealthPanel
            health={dash.health}
            insights={dash.insights}
          />
        </div>
        <div className="order-1 lg:order-2">
          <ActionQueue items={dash.actionItems} />
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
