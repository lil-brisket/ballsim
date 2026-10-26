import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { PlayerProfileView } from "@/state/player-profile-selectors";

function Fact(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-sm text-muted">{props.label}</span>
      <span className="text-sm text-ink">{props.children}</span>
    </div>
  );
}

/**
 * Facts the hero banner does not show: nationality, development stage,
 * injury status and the contract summary.
 */
export function PlayerProfileSummary(props: { player: PlayerProfileView }) {
  const { player } = props;
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-xl border border-line bg-surface-raised/40 px-4 py-3">
      <Fact label="Nationality">{player.nationality}</Fact>
      <Fact label="Development">
        <StatusBadge label={player.developmentStage} />
      </Fact>
      <Fact label="Injury">
        <StatusBadge label={player.injuryKind} tone={player.injuryKind} />
      </Fact>
      <Fact label="Contract">
        {player.contract ? (
          <span className="flex flex-wrap items-center gap-2">
            <MoneyDisplay amount={player.contract.salary ?? 0} />
            <span className="text-soft">
              {player.contract.startYear}–{player.contract.endYear} (
              {player.contract.yearsRemaining}y)
            </span>
            <StatusBadge label={player.contract.status} />
          </span>
        ) : (
          <span className="text-muted">No contract on file</span>
        )}
      </Fact>
    </div>
  );
}
