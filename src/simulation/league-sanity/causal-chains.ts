/**
 * Causal-chain directional consistency checks for Owner Mode economy.
 * Not true causal identification — tests whether expected directions appear.
 */

import { pearsonCorrelation } from "@/simulation/analytics";
import type { CorrelationPair } from "@/simulation/analytics";
import type { LeagueSanityTeamSeasonSnapshot } from "@/simulation/league-sanity/types";

export type CausalChainCheck = {
  id: string;
  description: string;
  expected: "positive" | "negative" | "weak_positive";
  lag: number;
  observed: CorrelationPair;
  verdict: "pass" | "warn" | "fail";
  note: string;
};

function franchiseKey(snap: LeagueSanityTeamSeasonSnapshot): string {
  return `${snap.simulationIndex}:${snap.teamId}`;
}

function seriesByFranchise(
  snapshots: readonly LeagueSanityTeamSeasonSnapshot[],
  pick: (s: LeagueSanityTeamSeasonSnapshot) => number | null,
): Map<string, number[]> {
  const byFranchise = new Map<string, LeagueSanityTeamSeasonSnapshot[]>();
  for (const snap of snapshots) {
    const key = franchiseKey(snap);
    const list = byFranchise.get(key) ?? [];
    list.push(snap);
    byFranchise.set(key, list);
  }
  const out = new Map<string, number[]>();
  for (const [key, rows] of byFranchise) {
    const ordered = [...rows].sort((a, b) => a.seasonIndex - b.seasonIndex);
    const vals: number[] = [];
    for (const row of ordered) {
      const v = pick(row);
      if (v === null || !Number.isFinite(v)) {
        break;
      }
      vals.push(v);
    }
    if (vals.length > 0) {
      out.set(key, vals);
    }
  }
  return out;
}

function laggedPairs(
  xMap: Map<string, number[]>,
  yMap: Map<string, number[]>,
  lag: number,
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [key, xVals] of xMap) {
    const yVals = yMap.get(key);
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

function verdictFor(
  r: number | null,
  expected: CausalChainCheck["expected"],
): { verdict: CausalChainCheck["verdict"]; note: string } {
  if (r === null) {
    return { verdict: "warn", note: "insufficient sample or variance" };
  }
  if (expected === "positive") {
    if (r >= 0.1) return { verdict: "pass", note: "directionally consistent" };
    if (r >= 0) return { verdict: "warn", note: "positive but weak" };
    return { verdict: "fail", note: "expected positive, observed negative" };
  }
  if (expected === "negative") {
    if (r <= -0.05) return { verdict: "pass", note: "directionally consistent" };
    if (r <= 0.05) return { verdict: "warn", note: "near zero / weak" };
    return { verdict: "fail", note: "expected negative, observed positive" };
  }
  // weak_positive
  if (r >= 0.05 && r <= 0.7) {
    return { verdict: "pass", note: "weak/moderate positive as expected" };
  }
  if (r > 0 && r < 0.05) {
    return { verdict: "warn", note: "positive but near zero" };
  }
  if (r > 0.7) {
    return { verdict: "warn", note: "unusually strong link" };
  }
  return { verdict: "fail", note: "expected weak positive, observed non-positive" };
}

export function evaluateCausalChains(
  snapshots: readonly LeagueSanityTeamSeasonSnapshot[],
): CausalChainCheck[] {
  const ticket = seriesByFranchise(snapshots, (s) => s.ticketPrice);
  const attendance = seriesByFranchise(snapshots, (s) => s.attendance);
  const winPct = seriesByFranchise(snapshots, (s) => s.winPct);
  const cash = seriesByFranchise(snapshots, (s) => s.cash);
  const investment = seriesByFranchise(
    snapshots,
    (s) => s.marketingBudget + s.meanFacilityLevel * 1e6,
  );
  const facilities = seriesByFranchise(snapshots, (s) => s.meanFacilityLevel);
  const revenue = seriesByFranchise(snapshots, (s) => s.revenue);
  const rosterStrength = seriesByFranchise(snapshots, (s) => s.rosterStrength);
  const payroll = seriesByFranchise(snapshots, (s) => s.payroll);

  const defs: {
    id: string;
    description: string;
    expected: CausalChainCheck["expected"];
    lag: number;
    xMap: Map<string, number[]>;
    yMap: Map<string, number[]>;
    xLabel: string;
    yLabel: string;
  }[] = [
    {
      id: "ticket_price_attendance",
      description: "Higher ticket price → lower attendance (lag 1)",
      expected: "negative",
      lag: 1,
      xMap: ticket,
      yMap: attendance,
      xLabel: "ticketPrice",
      yLabel: "attendance",
    },
    {
      id: "winning_attendance",
      description: "Higher winning → higher attendance (lag 1)",
      expected: "positive",
      lag: 1,
      xMap: winPct,
      yMap: attendance,
      xLabel: "winPct",
      yLabel: "attendance",
    },
    {
      id: "cash_investment",
      description: "Lower cash → constrained investment (lag 1)",
      expected: "positive",
      lag: 1,
      xMap: cash,
      yMap: investment,
      xLabel: "cash",
      yLabel: "investment",
    },
    {
      id: "facilities_revenue",
      description: "Facility investment → revenue (lag 2)",
      expected: "positive",
      lag: 2,
      xMap: facilities,
      yMap: revenue,
      xLabel: "meanFacilityLevel",
      yLabel: "revenue",
    },
    {
      id: "facilities_development",
      description: "Facilities → roster strength (lag 2)",
      expected: "positive",
      lag: 2,
      xMap: facilities,
      yMap: rosterStrength,
      xLabel: "meanFacilityLevel",
      yLabel: "rosterStrength",
    },
    {
      id: "payroll_wins",
      description: "Payroll → wins (lag 1, weak positive)",
      expected: "weak_positive",
      lag: 1,
      xMap: payroll,
      yMap: winPct,
      xLabel: "payroll",
      yLabel: "winPct",
    },
  ];

  return defs.map((def) => {
    const { xs, ys } = laggedPairs(def.xMap, def.yMap, def.lag);
    const r = pearsonCorrelation(xs, ys);
    const { verdict, note } = verdictFor(r, def.expected);
    return {
      id: def.id,
      description: def.description,
      expected: def.expected,
      lag: def.lag,
      observed: {
        name: def.description,
        x: def.xLabel,
        y: def.yLabel,
        r,
        n: xs.length,
        lag: def.lag,
      },
      verdict,
      note,
    };
  });
}
