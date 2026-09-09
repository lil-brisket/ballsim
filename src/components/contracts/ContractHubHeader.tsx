import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import type { ContractHubView } from "@/state/contract-hub-selectors";

/**
 * Compact contract hub header — payroll/cap strip, not a StatCard grid.
 */
export function ContractHubHeader(props: { view: ContractHubView }) {
  const { view } = props;
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-zinc-800 pb-3">
      <div>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
          Contract management
        </p>
        <h2 className="text-lg font-medium text-zinc-50">{view.teamName}</h2>
        <p className="text-xs text-zinc-500">Season {view.seasonYear}</p>
      </div>
      <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <StripStat
          label="Payroll"
          value={<MoneyDisplay amount={view.playerPayroll} />}
        />
        <StripStat
          label="Cap"
          value={
            view.salaryCapEnabled ? (
              <MoneyDisplay amount={view.salaryCap} />
            ) : (
              "Off"
            )
          }
        />
        <StripStat
          label="Cap space"
          value={
            view.salaryCapEnabled ? (
              <MoneyDisplay amount={view.capSpace} />
            ) : (
              "—"
            )
          }
        />
        <StripStat label="Players" value={String(view.overview.playerCount)} />
        <StripStat
          label="Expiring"
          value={String(view.overview.expiringCount)}
        />
      </dl>
    </div>
  );
}

function StripStat(props: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-[4.5rem]">
      <dt className="text-[0.65rem] uppercase tracking-wide text-zinc-500">
        {props.label}
      </dt>
      <dd className="mt-0.5 font-medium text-zinc-100">{props.value}</dd>
    </div>
  );
}
