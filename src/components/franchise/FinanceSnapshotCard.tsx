import { ActionCard } from "@/components/ui/ActionCard";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { HealthToneBadge } from "@/components/owner/dashboard/MetricBlock";
import type { FranchiseFinanceSnapshot } from "@/state/franchise-hub-selectors";

export function FinanceSnapshotCard(props: {
  snapshot: FranchiseFinanceSnapshot;
  saveId: string;
}) {
  const { snapshot, saveId } = props;
  const runwayLabel =
    snapshot.runwayWeeks === null
      ? "Positive through horizon"
      : `${snapshot.runwayWeeks} week${snapshot.runwayWeeks === 1 ? "" : "s"}`;

  return (
    <ActionCard
      href={`/dashboard/${saveId}/finances`}
      title="Finances"
      description="Cash position and near-term runway"
      footer={
        <span className="text-sm font-medium text-amber-400">View Finances</span>
      }
    >
      <dl className="mt-3 space-y-1.5 text-xs text-zinc-400">
        <div className="flex justify-between gap-2">
          <dt>Business funds</dt>
          <dd className="text-zinc-200">
            <MoneyDisplay amount={snapshot.cash} />
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Projected</dt>
          <dd className="text-zinc-200">
            <MoneyDisplay amount={snapshot.projectedCash} />
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Runway</dt>
          <dd className="text-zinc-200">{runwayLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt>Health</dt>
          <dd>
            <HealthToneBadge health={snapshot.health} />
          </dd>
        </div>
      </dl>
    </ActionCard>
  );
}
