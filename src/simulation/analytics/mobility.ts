import type { CompetitiveTier } from "@/simulation/analytics/types";
import { pearsonCorrelation } from "@/simulation/analytics/correlations";

export type TierTransition = {
  from: CompetitiveTier;
  to: CompetitiveTier;
  count: number;
  rate: number;
};

export type CompetitiveMobilityReport = {
  transitions: TierTransition[];
  bottomToPlayoffRate: number;
  playoffToContenderRate: number;
  contenderToChampionRate: number;
  championPlayoffRetentionRate: number;
  championToNonPlayoffRate: number;
  /** Autocorrelation of league rank year-over-year (higher = more stuck). */
  rankPersistence: number | null;
  nTransitions: number;
};

export type ValueMobilityReport = {
  rankPersistence: number | null;
  yoyVolatilityMean: number | null;
  bottomToTopRate: number;
  topToBottomRate: number;
  growthDistributionMean: number | null;
  declineDistributionMean: number | null;
  nFranchiseYears: number;
};

const TIER_ORDER: CompetitiveTier[] = [
  "bottom_quartile",
  "middle",
  "playoff",
  "contender",
  "champion",
];

/**
 * Assign competitive tier from season outcomes.
 * Contender = playoff + top win% quartile among playoff teams, or deep playoff.
 */
export function assignCompetitiveTier(
  seasons: readonly {
    teamKey: string;
    seasonIndex: number;
    winPct: number;
    playoff: boolean;
    champion: boolean;
    playoffDepth: number;
  }[],
): Map<string, CompetitiveTier> {
  const bySeason = new Map<number, typeof seasons>();
  for (const row of seasons) {
    const list = bySeason.get(row.seasonIndex) ?? [];
    list.push(row);
    bySeason.set(row.seasonIndex, list);
  }
  const result = new Map<string, CompetitiveTier>();
  for (const [, rows] of bySeason) {
    const sorted = [...rows].sort((a, b) => a.winPct - b.winPct);
    const q1 = Math.max(1, Math.floor(sorted.length * 0.25));
    const bottomIds = new Set(
      sorted.slice(0, q1).map((r) => `${r.teamKey}:${r.seasonIndex}`),
    );
    const playoffRows = rows.filter((r) => r.playoff && !r.champion);
    const playoffSorted = [...playoffRows].sort((a, b) => b.winPct - a.winPct);
    const contenderCut = Math.max(1, Math.ceil(playoffSorted.length * 0.25));
    const contenderIds = new Set(
      playoffSorted.slice(0, contenderCut).map((r) => `${r.teamKey}:${r.seasonIndex}`),
    );
    for (const row of rows) {
      const key = `${row.teamKey}:${row.seasonIndex}`;
      if (row.champion) {
        result.set(key, "champion");
      } else if (
        row.playoff &&
        (contenderIds.has(key) || row.playoffDepth >= 3)
      ) {
        result.set(key, "contender");
      } else if (row.playoff) {
        result.set(key, "playoff");
      } else if (bottomIds.has(key)) {
        result.set(key, "bottom_quartile");
      } else {
        result.set(key, "middle");
      }
    }
  }
  return result;
}

function transitionRate(
  transitions: readonly { from: CompetitiveTier; to: CompetitiveTier }[],
  from: CompetitiveTier,
  toPredicate: (to: CompetitiveTier) => boolean,
): number {
  const fromRows = transitions.filter((t) => t.from === from);
  if (fromRows.length === 0) {
    return 0;
  }
  const hits = fromRows.filter((t) => toPredicate(t.to)).length;
  return hits / fromRows.length;
}

/**
 * Compute competitive mobility from ordered team-season rows.
 * Rows must include consecutive seasonIndex values per teamKey.
 */
export function computeCompetitiveMobility(
  seasons: readonly {
    teamKey: string;
    seasonIndex: number;
    winPct: number;
    playoff: boolean;
    champion: boolean;
    playoffDepth: number;
    leagueRank: number;
  }[],
): CompetitiveMobilityReport {
  const tiers = assignCompetitiveTier(seasons);
  const byTeam = new Map<string, typeof seasons>();
  for (const row of seasons) {
    const list = byTeam.get(row.teamKey) ?? [];
    list.push(row);
    byTeam.set(row.teamKey, list);
  }

  const pairTransitions: { from: CompetitiveTier; to: CompetitiveTier }[] = [];
  const rankPrev: number[] = [];
  const rankNext: number[] = [];

  for (const [, rows] of byTeam) {
    const ordered = [...rows].sort((a, b) => a.seasonIndex - b.seasonIndex);
    for (let i = 0; i < ordered.length - 1; i += 1) {
      const a = ordered[i]!;
      const b = ordered[i + 1]!;
      if (b.seasonIndex !== a.seasonIndex + 1) {
        continue;
      }
      const from = tiers.get(`${a.teamKey}:${a.seasonIndex}`);
      const to = tiers.get(`${b.teamKey}:${b.seasonIndex}`);
      if (!from || !to) {
        continue;
      }
      pairTransitions.push({ from, to });
      rankPrev.push(a.leagueRank);
      rankNext.push(b.leagueRank);
    }
  }

  const counts = new Map<string, number>();
  for (const t of pairTransitions) {
    const key = `${t.from}->${t.to}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const transitions: TierTransition[] = [];
  for (const from of TIER_ORDER) {
    for (const to of TIER_ORDER) {
      const count = counts.get(`${from}->${to}`) ?? 0;
      const fromTotal = pairTransitions.filter((t) => t.from === from).length;
      transitions.push({
        from,
        to,
        count,
        rate: fromTotal === 0 ? 0 : count / fromTotal,
      });
    }
  }

  const playoffish = (t: CompetitiveTier) =>
    t === "playoff" || t === "contender" || t === "champion";
  const contenderish = (t: CompetitiveTier) =>
    t === "contender" || t === "champion";

  return {
    transitions,
    bottomToPlayoffRate: transitionRate(
      pairTransitions,
      "bottom_quartile",
      playoffish,
    ),
    playoffToContenderRate: transitionRate(
      pairTransitions,
      "playoff",
      contenderish,
    ),
    contenderToChampionRate: transitionRate(
      pairTransitions,
      "contender",
      (t) => t === "champion",
    ),
    championPlayoffRetentionRate: transitionRate(
      pairTransitions,
      "champion",
      playoffish,
    ),
    championToNonPlayoffRate: transitionRate(
      pairTransitions,
      "champion",
      (t) => !playoffish(t),
    ),
    rankPersistence: pearsonCorrelation(rankPrev, rankNext),
    nTransitions: pairTransitions.length,
  };
}

/**
 * Value mobility from franchise-value time series per team.
 */
export function computeValueMobility(
  seasons: readonly {
    teamKey: string;
    seasonIndex: number;
    franchiseValue: number;
  }[],
): ValueMobilityReport {
  const bySeason = new Map<number, typeof seasons>();
  for (const row of seasons) {
    const list = bySeason.get(row.seasonIndex) ?? [];
    list.push(row);
    bySeason.set(row.seasonIndex, list);
  }

  const quartile = new Map<string, "bottom" | "middle" | "top">();
  for (const [, rows] of bySeason) {
    const sorted = [...rows].sort((a, b) => a.franchiseValue - b.franchiseValue);
    const q = Math.max(1, Math.floor(sorted.length * 0.25));
    for (let i = 0; i < sorted.length; i += 1) {
      const row = sorted[i]!;
      const key = `${row.teamKey}:${row.seasonIndex}`;
      if (i < q) {
        quartile.set(key, "bottom");
      } else if (i >= sorted.length - q) {
        quartile.set(key, "top");
      } else {
        quartile.set(key, "middle");
      }
    }
  }

  const byTeam = new Map<string, typeof seasons>();
  for (const row of seasons) {
    const list = byTeam.get(row.teamKey) ?? [];
    list.push(row);
    byTeam.set(row.teamKey, list);
  }

  const rankPrev: number[] = [];
  const rankNext: number[] = [];
  const growth: number[] = [];
  const decline: number[] = [];
  const absChanges: number[] = [];
  let bottomToTop = 0;
  let bottomTotal = 0;
  let topToBottom = 0;
  let topTotal = 0;
  let nFranchiseYears = 0;

  // Rank within season for persistence
  const rankByKey = new Map<string, number>();
  for (const [, rows] of bySeason) {
    const sorted = [...rows].sort((a, b) => b.franchiseValue - a.franchiseValue);
    sorted.forEach((row, index) => {
      rankByKey.set(`${row.teamKey}:${row.seasonIndex}`, index + 1);
    });
  }

  for (const [, rows] of byTeam) {
    const ordered = [...rows].sort((a, b) => a.seasonIndex - b.seasonIndex);
    nFranchiseYears += ordered.length;
    for (let i = 0; i < ordered.length - 1; i += 1) {
      const a = ordered[i]!;
      const b = ordered[i + 1]!;
      if (b.seasonIndex !== a.seasonIndex + 1) {
        continue;
      }
      const ra = rankByKey.get(`${a.teamKey}:${a.seasonIndex}`);
      const rb = rankByKey.get(`${b.teamKey}:${b.seasonIndex}`);
      if (ra != null && rb != null) {
        rankPrev.push(ra);
        rankNext.push(rb);
      }
      if (a.franchiseValue > 0) {
        const pct = b.franchiseValue / a.franchiseValue - 1;
        absChanges.push(Math.abs(pct));
        if (pct >= 0) {
          growth.push(pct);
        } else {
          decline.push(pct);
        }
      }
      const qa = quartile.get(`${a.teamKey}:${a.seasonIndex}`);
      const qb = quartile.get(`${b.teamKey}:${b.seasonIndex}`);
      if (qa === "bottom") {
        bottomTotal += 1;
        if (qb === "top") {
          bottomToTop += 1;
        }
      }
      if (qa === "top") {
        topTotal += 1;
        if (qb === "bottom") {
          topToBottom += 1;
        }
      }
    }
  }

  const mean = (xs: number[]) =>
    xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;

  return {
    rankPersistence: pearsonCorrelation(rankPrev, rankNext),
    yoyVolatilityMean: mean(absChanges),
    bottomToTopRate: bottomTotal === 0 ? 0 : bottomToTop / bottomTotal,
    topToBottomRate: topTotal === 0 ? 0 : topToBottom / topTotal,
    growthDistributionMean: mean(growth),
    declineDistributionMean: mean(decline),
    nFranchiseYears,
  };
}
