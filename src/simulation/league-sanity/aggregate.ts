/**
 * Aggregate league sanity observations into report metrics.
 */

import {
  championshipConcentration,
  computeCompetitiveMobility,
  computeValueMobility,
  meanYoYInflation,
  summarizeWithPercentiles,
  type CompetitiveMobilityReport,
  type MetricSummaryWithPercentiles,
  type ValueMobilityReport,
} from "@/simulation/analytics";
import type { LeagueSanityTeamSeasonSnapshot } from "@/simulation/league-sanity/types";

export type TenureAggregate = {
  activeSeasons: MetricSummaryWithPercentiles;
  seasonsUntilFirstInsolvency: MetricSummaryWithPercentiles;
  seasonsInsolventMean: number;
  seasonsUntilRelocation: MetricSummaryWithPercentiles;
  financialDistressRate: number;
  insolvencyRate: number;
  relocationRate: number;
  expansionEventsPerSimMean: number;
  survivalThroughSimulation: number;
};

export type LeagueSanityAggregates = {
  teamSeasonCount: number;
  franchiseCount: number;
  tenure: TenureAggregate;
  franchiseValue: MetricSummaryWithPercentiles;
  cash: MetricSummaryWithPercentiles;
  netIncome: MetricSummaryWithPercentiles;
  payroll: MetricSummaryWithPercentiles;
  winPct: MetricSummaryWithPercentiles;
  attendance: MetricSummaryWithPercentiles;
  fillRate: MetricSummaryWithPercentiles;
  meanFacilityLevel: MetricSummaryWithPercentiles;
  meanRosterAge: MetricSummaryWithPercentiles;
  championshipHhi: number;
  titlesPerFranchise: MetricSummaryWithPercentiles;
  playoffAppearanceRate: number;
  facilityYoYMean: number | null;
  salaryInflation: number | null;
  competitiveMobility: CompetitiveMobilityReport;
  valueMobility: ValueMobilityReport;
  /** Per-season league median salary for inflation series. */
  medianSalaryBySeasonIndex: number[];
};

function franchiseKey(snap: LeagueSanityTeamSeasonSnapshot): string {
  return `${snap.simulationIndex}:${snap.teamId}`;
}

function isDistress(snap: LeagueSanityTeamSeasonSnapshot): boolean {
  return (
    snap.financialHealth === "warning" ||
    snap.financialHealth === "critical" ||
    snap.financialHealth === "insolvent" ||
    snap.insolvent
  );
}

export function aggregateLeagueSanitySnapshots(
  snapshots: readonly LeagueSanityTeamSeasonSnapshot[],
  seasonsPerSimulation: number,
): LeagueSanityAggregates {
  const byFranchise = new Map<string, LeagueSanityTeamSeasonSnapshot[]>();
  for (const snap of snapshots) {
    const key = franchiseKey(snap);
    const list = byFranchise.get(key) ?? [];
    list.push(snap);
    byFranchise.set(key, list);
  }

  const activeSeasons: number[] = [];
  const untilInsolvency: number[] = [];
  const untilRelocation: number[] = [];
  let seasonsInsolventTotal = 0;
  let franchiseYears = 0;
  let survived = 0;

  const titleCounts: number[] = [];
  for (const [, rows] of byFranchise) {
    const ordered = [...rows].sort((a, b) => a.seasonIndex - b.seasonIndex);
    activeSeasons.push(ordered.length);
    franchiseYears += ordered.length;
    survived += 1; // franchises never dissolve today
    let insolventSeasons = 0;
    let firstInsolvency: number | null = null;
    let firstRelocation: number | null = null;
    let titles = 0;
    for (const row of ordered) {
      if (row.insolvent) {
        insolventSeasons += 1;
        if (firstInsolvency === null) {
          firstInsolvency = row.seasonsSinceFounding;
        }
      }
      if (row.relocated && firstRelocation === null) {
        firstRelocation = row.seasonsSinceFounding;
      }
      if (row.champion) {
        titles += 1;
      }
    }
    seasonsInsolventTotal += insolventSeasons;
    if (firstInsolvency !== null) {
      untilInsolvency.push(firstInsolvency);
    }
    if (firstRelocation !== null) {
      untilRelocation.push(firstRelocation);
    }
    titleCounts.push(titles);
  }

  const insolventTeamSeasons = snapshots.filter((s) => s.insolvent).length;
  const distressTeamSeasons = snapshots.filter(isDistress).length;
  const relocatedTeamSeasons = snapshots.filter((s) => s.relocated).length;
  const expansionTeamSeasons = snapshots.filter((s) => s.expansionTeam).length;
  const simCount = new Set(snapshots.map((s) => s.simulationIndex)).size || 1;

  // Facility YoY
  const facilityDeltas: number[] = [];
  for (const [, rows] of byFranchise) {
    const ordered = [...rows].sort((a, b) => a.seasonIndex - b.seasonIndex);
    for (let i = 0; i < ordered.length - 1; i += 1) {
      facilityDeltas.push(
        ordered[i + 1]!.meanFacilityLevel - ordered[i]!.meanFacilityLevel,
      );
    }
  }

  // Median salary by season index across all sims
  const salaryBySeason = new Map<number, number[]>();
  for (const snap of snapshots) {
    const list = salaryBySeason.get(snap.seasonIndex) ?? [];
    list.push(snap.meanSalary);
    salaryBySeason.set(snap.seasonIndex, list);
  }
  const medianSalaryBySeasonIndex: number[] = [];
  const maxSeason = Math.max(0, ...salaryBySeason.keys());
  for (let i = 0; i <= maxSeason; i += 1) {
    const vals = salaryBySeason.get(i) ?? [];
    if (vals.length === 0) {
      medianSalaryBySeasonIndex.push(0);
      continue;
    }
    const sorted = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianSalaryBySeasonIndex.push(
      sorted.length % 2 === 1
        ? sorted[mid]!
        : (sorted[mid - 1]! + sorted[mid]!) / 2,
    );
  }

  const playoffSeasons = snapshots.filter((s) => s.playoff).length;
  const attendanceVals = snapshots
    .map((s) => s.attendance)
    .filter((v): v is number => v !== null);
  const fillVals = snapshots
    .map((s) => s.fillRate)
    .filter((v): v is number => v !== null);

  const competitiveMobility = computeCompetitiveMobility(
    snapshots.map((s) => ({
      teamKey: franchiseKey(s),
      seasonIndex: s.seasonIndex,
      winPct: s.winPct,
      playoff: s.playoff,
      champion: s.champion,
      playoffDepth: s.playoffDepth,
      leagueRank: s.leagueRank,
    })),
  );

  const valueMobility = computeValueMobility(
    snapshots.map((s) => ({
      teamKey: franchiseKey(s),
      seasonIndex: s.seasonIndex,
      franchiseValue: s.franchiseValue,
    })),
  );

  return {
    teamSeasonCount: snapshots.length,
    franchiseCount: byFranchise.size,
    tenure: {
      activeSeasons: summarizeWithPercentiles(activeSeasons),
      seasonsUntilFirstInsolvency: summarizeWithPercentiles(untilInsolvency),
      seasonsInsolventMean:
        franchiseYears === 0 ? 0 : seasonsInsolventTotal / byFranchise.size,
      seasonsUntilRelocation: summarizeWithPercentiles(untilRelocation),
      financialDistressRate:
        snapshots.length === 0 ? 0 : distressTeamSeasons / snapshots.length,
      insolvencyRate:
        snapshots.length === 0 ? 0 : insolventTeamSeasons / snapshots.length,
      relocationRate:
        snapshots.length === 0 ? 0 : relocatedTeamSeasons / snapshots.length,
      expansionEventsPerSimMean: expansionTeamSeasons / simCount,
      survivalThroughSimulation:
        byFranchise.size === 0 ? 1 : survived / byFranchise.size,
    },
    franchiseValue: summarizeWithPercentiles(
      snapshots.map((s) => s.franchiseValue),
    ),
    cash: summarizeWithPercentiles(snapshots.map((s) => s.cash)),
    netIncome: summarizeWithPercentiles(snapshots.map((s) => s.netIncome)),
    payroll: summarizeWithPercentiles(snapshots.map((s) => s.payroll)),
    winPct: summarizeWithPercentiles(snapshots.map((s) => s.winPct)),
    attendance: summarizeWithPercentiles(attendanceVals),
    fillRate: summarizeWithPercentiles(fillVals),
    meanFacilityLevel: summarizeWithPercentiles(
      snapshots.map((s) => s.meanFacilityLevel),
    ),
    meanRosterAge: summarizeWithPercentiles(
      snapshots.map((s) => s.meanRosterAge),
    ),
    championshipHhi: championshipConcentration(titleCounts),
    titlesPerFranchise: summarizeWithPercentiles(titleCounts),
    playoffAppearanceRate:
      snapshots.length === 0 ? 0 : playoffSeasons / snapshots.length,
    facilityYoYMean:
      facilityDeltas.length === 0
        ? null
        : facilityDeltas.reduce((a, b) => a + b, 0) / facilityDeltas.length,
    salaryInflation: meanYoYInflation(medianSalaryBySeasonIndex),
    competitiveMobility,
    valueMobility,
    medianSalaryBySeasonIndex,
  };
}
