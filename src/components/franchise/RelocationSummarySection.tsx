import { ActionCard } from "@/components/ui/ActionCard";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import type {
  FranchiseRelocationSummary,
  RelocationSummaryState,
} from "@/state/franchise-hub-selectors";

const STATE_COPY: Record<RelocationSummaryState, string> = {
  not_available: "A move is not on the table right now.",
  eligible: "A move is a legitimate option this offseason.",
  in_progress: "Relocation is underway.",
  cooldown: "Tenure or cooldown currently blocks a move.",
};

export function RelocationSummarySection(props: {
  summary: FranchiseRelocationSummary;
}) {
  const { summary } = props;
  const body = (
    <>
      <p className="mt-3 text-xs text-zinc-400">
        {STATE_COPY[summary.state]}
      </p>
      <ul className="mt-3 space-y-1 text-xs text-zinc-400">
        <li className="flex justify-between gap-2">
          <span>Market size</span>
          <span className="text-zinc-200">{summary.marketSize}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Estimated fee</span>
          <MoneyDisplay amount={summary.estimatedFee} />
        </li>
        {summary.cooldownSeasonsRemaining > 0 ? (
          <li className="flex justify-between gap-2">
            <span>Cooldown</span>
            <span className="text-zinc-200">
              {summary.cooldownSeasonsRemaining} season
              {summary.cooldownSeasonsRemaining === 1 ? "" : "s"}
            </span>
          </li>
        ) : null}
      </ul>
      {summary.primaryDriver ? (
        <p className="mt-3 text-xs text-zinc-500">{summary.primaryDriver}</p>
      ) : null}
    </>
  );

  const badge = (
    <StatusBadge
      label={summary.statusLabel}
      tone={
        summary.state === "eligible"
          ? "warning"
          : summary.state === "in_progress"
            ? "active"
            : summary.state === "cooldown"
              ? "info"
              : "neutral"
      }
    />
  );

  if (summary.href) {
    return (
      <ActionCard
        href={summary.href}
        title="Relocation"
        badge={badge}
        footer={
          <span className="text-sm font-medium text-amber-400">
            Explore Relocation
          </span>
        }
      >
        {body}
      </ActionCard>
    );
  }

  return (
    <Panel>
      {badge}
      <h3 className="mt-2 text-sm font-medium text-zinc-100">Relocation</h3>
      {body}
    </Panel>
  );
}
