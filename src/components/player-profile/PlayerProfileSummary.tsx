import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { PlayerProfileView } from "@/state/player-profile-selectors";

function Fact(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-zinc-400">
        {props.label}
      </span>
      <span className="text-sm text-zinc-100">{props.children}</span>
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
    <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
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
            <span className="text-zinc-300">
              {player.contract.startYear}–{player.contract.endYear} (
              {player.contract.yearsRemaining}y)
            </span>
            <StatusBadge label={player.contract.status} />
          </span>
        ) : (
          <span className="text-zinc-400">No contract on file</span>
        )}
      </Fact>
    </div>
  );
}
