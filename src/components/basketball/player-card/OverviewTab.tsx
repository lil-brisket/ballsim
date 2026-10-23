import { MoodChip } from "@/components/basketball/MoodChip";
import { RecentPerformanceChart } from "@/components/basketball/player-card/RecentPerformanceChart";
import { SeasonAverageStrip } from "@/components/basketball/player-card/SeasonAverageStrip";
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
      {view.mood ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
          <MoodChip mood={view.mood} />
          <span>
            Mood: {view.mood.label} — {view.mood.reason}
          </span>
        </p>
      ) : null}

      <Section title="Season averages" density="compact">
        <SeasonAverageStrip
          values={{
            games: perf.games,
            mpg: formatAverage(perf.mpg),
            ppg: formatAverage(perf.ppg),
            rpg: formatAverage(perf.rpg),
            apg: formatAverage(perf.apg),
            spg: formatAverage(perf.spg),
            bpg: formatAverage(perf.bpg),
          }}
        />
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
              <span className="text-sm text-zinc-400">Status</span>
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
