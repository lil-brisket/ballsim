/**
 * Same-season and lagged correlations for league sanity.
 */

import {
  evaluateRelationship,
  makeCorrelationPair,
  type CorrelationPair,
} from "@/simulation/analytics";
import { DEFAULT_SANITY_RELATIONSHIPS } from "@/simulation/league-sanity/config";
import type { LeagueSanityTeamSeasonSnapshot } from "@/simulation/league-sanity/types";

function franchiseKey(snap: LeagueSanityTeamSeasonSnapshot): string {
  return `${snap.simulationIndex}:${snap.teamId}`;
}

function paired(
  snapshots: readonly LeagueSanityTeamSeasonSnapshot[],
  x: (s: LeagueSanityTeamSeasonSnapshot) => number | null,
  y: (s: LeagueSanityTeamSeasonSnapshot) => number | null,
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const snap of snapshots) {
    const xv = x(snap);
    const yv = y(snap);
    if (xv === null || yv === null || !Number.isFinite(xv) || !Number.isFinite(yv)) {
      continue;
    }
    xs.push(xv);
    ys.push(yv);
  }
  return { xs, ys };
}

/**
 * Build time-aligned series per franchise for lagged correlations.
 */
function franchiseSeries(
  snapshots: readonly LeagueSanityTeamSeasonSnapshot[],
  pick: (s: LeagueSanityTeamSeasonSnapshot) => number | null,
): { xs: number[]; ys: number[]; lagReady: Map<string, number[]> } {
  const byFranchise = new Map<string, LeagueSanityTeamSeasonSnapshot[]>();
  for (const snap of snapshots) {
    const key = franchiseKey(snap);
    const list = byFranchise.get(key) ?? [];
    list.push(snap);
    byFranchise.set(key, list);
  }
  const lagReady = new Map<string, number[]>();
  for (const [key, rows] of byFranchise) {
    const ordered = [...rows].sort((a, b) => a.seasonIndex - b.seasonIndex);
    const series: number[] = [];
    for (const row of ordered) {
      const v = pick(row);
      if (v === null || !Number.isFinite(v)) {
        // Break continuity on missing
        if (series.length > 0) {
          lagReady.set(`${key}:${series.length}`, series);
        }
        series.length = 0;
        continue;
      }
      series.push(v);
    }
    if (series.length > 0) {
      lagReady.set(key, series);
    }
  }
  return { xs: [], ys: [], lagReady };
}

function concatLagged(
  xSeries: Map<string, number[]>,
  ySeries: Map<string, number[]>,
  lag: number,
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [key, xVals] of xSeries) {
    const yVals = ySeries.get(key);
    if (!yVals || xVals.length !== yVals.length || xVals.length <= lag) {
      continue;
    }
    for (let i = 0; i < xVals.length - lag; i += 1) {
      xs.push(xVals[i]!);
      ys.push(yVals[i + lag]!);
    }
  }
  return { xs, ys };
}

export type RelationshipResult = CorrelationPair & {
  expectationKey: string;
  diagnostic: string | null;
};

export function computeLeagueSanityCorrelations(
  snapshots: readonly LeagueSanityTeamSeasonSnapshot[],
): {
  sameSeason: RelationshipResult[];
  lagged: CorrelationPair[];
} {
  const sameSeasonDefs: {
    key: string;
    name: string;
    xLabel: string;
    yLabel: string;
    x: (s: LeagueSanityTeamSeasonSnapshot) => number | null;
    y: (s: LeagueSanityTeamSeasonSnapshot) => number | null;
  }[] = [
    {
      key: "market→franchiseValue",
      name: "market → franchise value",
      xLabel: "marketSize",
      yLabel: "franchiseValue",
      x: (s) => s.marketSize,
      y: (s) => s.franchiseValue,
    },
    {
      key: "market→attendance",
      name: "market → attendance",
      xLabel: "marketSize",
      yLabel: "attendance",
      x: (s) => s.marketSize,
      y: (s) => s.attendance,
    },
    {
      key: "payroll→winPct",
      name: "payroll → win%",
      xLabel: "payroll",
      yLabel: "winPct",
      x: (s) => s.payroll,
      y: (s) => s.winPct,
    },
    {
      key: "winPct→attendance",
      name: "win% → attendance",
      xLabel: "winPct",
      yLabel: "attendance",
      x: (s) => s.winPct,
      y: (s) => s.attendance,
    },
    {
      key: "winPct→franchiseValue",
      name: "win% → franchise value",
      xLabel: "winPct",
      yLabel: "franchiseValue",
      x: (s) => s.winPct,
      y: (s) => s.franchiseValue,
    },
    {
      key: "facilities→franchiseValue",
      name: "facilities → franchise value",
      xLabel: "meanFacilityLevel",
      yLabel: "franchiseValue",
      x: (s) => s.meanFacilityLevel,
      y: (s) => s.franchiseValue,
    },
    {
      key: "ticketPrice→attendance",
      name: "ticket price → attendance",
      xLabel: "ticketPrice",
      yLabel: "attendance",
      x: (s) => s.ticketPrice,
      y: (s) => s.attendance,
    },
    {
      key: "attendance→revenue",
      name: "attendance → revenue",
      xLabel: "attendance",
      yLabel: "revenue",
      x: (s) => s.attendance,
      y: (s) => s.revenue,
    },
  ];

  const sameSeason: RelationshipResult[] = sameSeasonDefs.map((def) => {
    const { xs, ys } = paired(snapshots, def.x, def.y);
    const pair = makeCorrelationPair(def.name, def.xLabel, def.yLabel, xs, ys, 0);
    const expectation = DEFAULT_SANITY_RELATIONSHIPS[def.key]!;
    return {
      ...pair,
      expectationKey: def.key,
      diagnostic: evaluateRelationship(pair.r, expectation),
    };
  });

  const marketing = franchiseSeries(snapshots, (s) => s.marketingBudget).lagReady;
  const attendance = franchiseSeries(snapshots, (s) => s.attendance).lagReady;
  const facilities = franchiseSeries(snapshots, (s) => s.meanFacilityLevel).lagReady;
  const revenue = franchiseSeries(snapshots, (s) => s.revenue).lagReady;
  const payroll = franchiseSeries(snapshots, (s) => s.payroll).lagReady;
  const winPct = franchiseSeries(snapshots, (s) => s.winPct).lagReady;
  const franchiseValue = franchiseSeries(snapshots, (s) => s.franchiseValue)
    .lagReady;
  const sponsorship = franchiseSeries(snapshots, (s) => s.sponsorshipRevenue)
    .lagReady;
  const cash = franchiseSeries(snapshots, (s) => s.cash).lagReady;
  const investment = franchiseSeries(
    snapshots,
    (s) => s.marketingBudget + s.meanFacilityLevel * 1_000_000,
  ).lagReady;

  const laggedDefs: {
    name: string;
    xLabel: string;
    yLabel: string;
    xMap: Map<string, number[]>;
    yMap: Map<string, number[]>;
    lag: number;
  }[] = [
    {
      name: "marketing(t) → attendance(t+1)",
      xLabel: "marketingBudget",
      yLabel: "attendance",
      xMap: marketing,
      yMap: attendance,
      lag: 1,
    },
    {
      name: "facilities(t) → revenue(t+2)",
      xLabel: "meanFacilityLevel",
      yLabel: "revenue",
      xMap: facilities,
      yMap: revenue,
      lag: 2,
    },
    {
      name: "payroll(t) → wins(t+1)",
      xLabel: "payroll",
      yLabel: "winPct",
      xMap: payroll,
      yMap: winPct,
      lag: 1,
    },
    {
      name: "winning(t) → attendance(t+1)",
      xLabel: "winPct",
      yLabel: "attendance",
      xMap: winPct,
      yMap: attendance,
      lag: 1,
    },
    {
      name: "franchiseValue(t) → sponsorship(t+1)",
      xLabel: "franchiseValue",
      yLabel: "sponsorshipRevenue",
      xMap: franchiseValue,
      yMap: sponsorship,
      lag: 1,
    },
    {
      name: "cash(t) → investment(t+1)",
      xLabel: "cash",
      yLabel: "investment",
      xMap: cash,
      yMap: investment,
      lag: 1,
    },
  ];

  const lagged: CorrelationPair[] = laggedDefs.map((def) => {
    const { xs, ys } = concatLagged(def.xMap, def.yMap, def.lag);
    return makeCorrelationPair(def.name, def.xLabel, def.yLabel, xs, ys, def.lag);
  });

  return { sameSeason, lagged };
}
