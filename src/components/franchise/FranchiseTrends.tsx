import { formatMoney } from "@/components/owner/MoneyDisplay";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { Sparkline } from "@/components/ui/Sparkline";
import type { FranchiseSeasonRecord } from "@/domain/entities/franchise-history";

/** Completed seasons shown in each trend line. */
export const FRANCHISE_TREND_SEASONS = 10;

export type FranchiseTrend = {
  label: string;
  values: number[];
  latest: string;
  /** Change from the first to the last point, already formatted. */
  change: string;
  direction: "up" | "down" | "flat";
};

function signed(delta: number, format: (n: number) => string): string {
  if (delta === 0) {
    return "no change";
  }
  return `${delta > 0 ? "+" : "−"}${format(Math.abs(delta))}`;
}

function trend(
  label: string,
  values: number[],
  format: (n: number) => string,
): FranchiseTrend | null {
  if (values.length < 2) {
    return null;
  }
  const delta = values[values.length - 1] - values[0];
  return {
    label,
    values,
    latest: format(values[values.length - 1]),
    change: signed(delta, format),
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
  };
}

/**
 * Owner scorecard trends from franchise history (chronological). Value and
 * fan sentiment end at today's figures; win % and net income use completed
 * seasons only, since the current season is partial.
 */
export function toFranchiseTrends(
  seasons: readonly FranchiseSeasonRecord[],
  current: { franchiseValue: number; fanSentiment: number },
): FranchiseTrend[] {
  const recent = seasons.slice(-FRANCHISE_TREND_SEASONS);
  const pct = (n: number) => `${Math.round(n)}%`;
  return [
    trend(
      "Franchise value",
      [...recent.map((s) => s.franchiseValue), current.franchiseValue],
      formatMoney,
    ),
    trend(
      "Fan sentiment",
      [...recent.map((s) => s.fanSentiment), current.fanSentiment],
      (n) => String(Math.round(n)),
    ),
    trend(
      "Win %",
      recent.map((s) => {
        const games = s.wins + s.losses;
        return games === 0 ? 0 : (s.wins / games) * 100;
      }),
      pct,
    ),
    trend(
      "Net income",
      recent.map((s) => s.netIncome),
      formatMoney,
    ),
  ].filter((t): t is FranchiseTrend => t !== null);
}

const DIRECTION_CLASS: Record<FranchiseTrend["direction"], string> = {
  up: "text-emerald-400",
  down: "text-rose-400",
  flat: "text-faint",
};

export function FranchiseTrends(props: { trends: FranchiseTrend[] }) {
  if (props.trends.length === 0) {
    return (
      <p className="text-sm text-faint">
        Trends appear after the first completed season.
      </p>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {props.trends.map((item) => (
        <ArenaPanel quiet as="div" key={item.label}>
          <p className="text-sm text-muted">{item.label}</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-lg text-ink">{item.latest}</p>
              <p className={`text-sm ${DIRECTION_CLASS[item.direction]}`}>
                {item.change}
              </p>
            </div>
            <Sparkline
              values={item.values}
              label={`${item.label} over the last ${item.values.length} points`}
            />
          </div>
        </ArenaPanel>
      ))}
    </div>
  );
}
