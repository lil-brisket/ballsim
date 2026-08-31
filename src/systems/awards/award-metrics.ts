import type {
  AwardEfficiencySnapshot,
  AwardPerGameRates,
} from "@/domain/entities/awards";
import type { PlayerSeasonStatLine } from "@/domain/entities/player-history";
import type { PeriodPlayerAgg } from "@/systems/awards/award-stat-sources";

export function perGameRates(agg: PeriodPlayerAgg): AwardPerGameRates {
  const g = Math.max(1, agg.games);
  return {
    points: agg.totals.points / g,
    rebounds: agg.totals.rebounds / g,
    assists: agg.totals.assists / g,
    steals: agg.totals.steals / g,
    blocks: agg.totals.blocks / g,
    turnovers: agg.totals.turnovers / g,
    minutes: agg.totals.minutes / g,
  };
}

export function efficiencyFromTotals(
  totals: PlayerSeasonStatLine,
): AwardEfficiencySnapshot {
  const fga = totals.fgAttempted;
  const fta = totals.ftAttempted;
  const tsa = fga + 0.44 * fta;
  const tsPct =
    tsa > 0 ? totals.points / (2 * tsa) : null;
  const eFgPct =
    fga > 0
      ? (totals.fgMade + 0.5 * totals.threeMade) / fga
      : null;
  const astTo =
    totals.turnovers > 0
      ? totals.assists / totals.turnovers
      : totals.assists > 0
        ? totals.assists
        : null;
  return { tsPct, eFgPct, astTo };
}

/** Single production composite (avoids double-counting points + usage separately). */
export function productionIndex(rates: AwardPerGameRates): number {
  return (
    rates.points * 1.0 +
    rates.rebounds * 1.2 +
    rates.assists * 1.5 +
    rates.steals * 2.0 +
    rates.blocks * 2.0 -
    rates.turnovers * 0.8
  );
}

export function defensiveStatImpact(rates: AwardPerGameRates): number {
  return rates.steals * 2.5 + rates.blocks * 2.5 + rates.rebounds * 0.35;
}

export function efficiencyIndex(eff: AwardEfficiencySnapshot): number {
  const ts = eff.tsPct ?? 0.45;
  const efg = eff.eFgPct ?? 0.45;
  const ato = Math.min(eff.astTo ?? 1, 5) / 5;
  return ts * 50 + efg * 35 + ato * 15;
}

/**
 * Percentile rank of value among peers (0–100).
 * Tied values share the average rank percentile.
 */
export function percentileScores(values: readonly number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [100];

  const indexed = values.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => a.value - b.value);

  const result = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && indexed[j + 1]!.value === indexed[i]!.value) {
      j += 1;
    }
    const avgRank = (i + j) / 2;
    const pct = n === 1 ? 100 : (avgRank / (n - 1)) * 100;
    for (let k = i; k <= j; k += 1) {
      result[indexed[k]!.index] = pct;
    }
    i = j + 1;
  }
  return result;
}

export function weightedScore(
  components: Record<string, number>,
  weights: Record<string, number>,
): { score: number; breakdown: Record<string, number> } {
  let score = 0;
  const breakdown: Record<string, number> = {};
  for (const [key, weight] of Object.entries(weights)) {
    const value = components[key] ?? 0;
    breakdown[key] = value;
    score += value * weight;
  }
  return { score, breakdown };
}
