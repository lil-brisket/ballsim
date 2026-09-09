import { Metric } from "@/components/ui/Metric";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import type { OffseasonHubView } from "@/state/offseason-hub-selectors";

export function OffseasonHeaderStrip(props: {
  view: OffseasonHubView;
}) {
  const { view } = props;
  return (
    <div
      className="flex flex-wrap gap-x-6 gap-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
      aria-label="Offseason summary"
    >
      <Metric label="Date" value={view.currentDate} mono density="compact" />
      <Metric label="Season" value={String(view.seasonYear)} density="compact" />
      <Metric label="Team" value={view.teamName} density="compact" />
      <Metric label="Record" value={view.record} density="compact" />
      {view.playoffResult ? (
        <Metric
          label="Playoffs"
          value={view.playoffResult}
          density="compact"
        />
      ) : null}
      <Metric
        label="Roster"
        value={String(view.rosterCount)}
        density="compact"
      />
      <Metric
        label="Payroll"
        value={<MoneyDisplay amount={view.playerPayroll} />}
        density="compact"
      />
      <Metric
        label="Cap space"
        value={<MoneyDisplay amount={view.capSpace} />}
        density="compact"
      />
      <Metric
        label="Stage"
        value={view.offseasonStageLabel}
        density="compact"
      />
    </div>
  );
}
