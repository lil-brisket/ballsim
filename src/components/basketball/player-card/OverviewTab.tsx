import { AttributeRadar } from "@/components/basketball/player-card/AttributeRadar";
import { RecentPerformanceChart } from "@/components/basketball/player-card/RecentPerformanceChart";
import { StatTile } from "@/components/basketball/player-card/StatTile";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { PlayerDrawerView } from "@/state/entity-drawer-selectors";
import { formatAverage } from "./format";

export function OverviewTab(props: { view: PlayerDrawerView }) {
  const { view } = props;
  const perf = view.performance;
  return (
    <>
      <Section title="Season averages" density="compact">
        <div
          role="group"
          aria-label="Season averages"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          <StatTile label="GP" value={perf.games} />
          <StatTile label="MPG" value={formatAverage(perf.mpg)} />
          <StatTile label="PPG" value={formatAverage(perf.ppg)} />
          <StatTile label="RPG" value={formatAverage(perf.rpg)} />
          <StatTile label="APG" value={formatAverage(perf.apg)} />
          <StatTile label="SPG" value={formatAverage(perf.spg)} />
          <StatTile label="BPG" value={formatAverage(perf.bpg)} />
        </div>
      </Section>

      <Section title="Attribute profile" density="compact">
        <AttributeRadar attributes={view.ratings.attributes} size="sm" />
      </Section>

      <Section title="Recent performance" density="compact">
        <RecentPerformanceChart games={view.stats.currentSeasonGames} />
      </Section>

      {view.contract ? (
        <Section title="Contract" density="compact">
          <div
            role="group"
            aria-label="Contract"
            className="grid grid-cols-3 gap-2"
          >
            <StatTile
              label="Salary"
              value={
                view.contract.salary != null ? (
                  <span className="text-2xl sm:text-3xl">
                    <MoneyDisplay amount={view.contract.salary} />
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <StatTile label="Years" value={view.contract.yearsRemaining} />
            <div className="flex min-w-0 flex-col items-start justify-center gap-1 rounded-lg border border-surface-line border-b-team-ink bg-surface-deep/80 px-3 py-3">
              <StatusBadge label={view.contract.status} />
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-zinc-400">
                Status
              </span>
            </div>
          </div>
        </Section>
      ) : view.navigation.contractHref ? (
        <Section title="Contract" density="compact">
          <p className="text-sm text-zinc-400">Contract details unavailable</p>
        </Section>
      ) : null}
    </>
  );
}
