/**
 * League sanity report assembly, checksum, and text formatting.
 */

import type { GameSettings } from "@/domain/game-settings";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import {
  hashPayload,
  round6,
  type CorrelationPair,
} from "@/simulation/analytics";
import {
  aggregateLeagueSanitySnapshots,
  type LeagueSanityAggregates,
} from "@/simulation/league-sanity/aggregate";
import { evaluateCausalChains } from "@/simulation/league-sanity/causal-chains";
import {
  computeLeagueSanityCorrelations,
  type RelationshipResult,
} from "@/simulation/league-sanity/correlations";
import {
  runLeagueSanityBatch,
  type LeagueCareerResult,
} from "@/simulation/league-sanity/run-league-career";
import type {
  LeagueSanityReportMetadata,
  LeagueSanityTeamSeasonSnapshot,
  LeagueSanityWarning,
} from "@/simulation/league-sanity/types";
import { evaluateSanityWarnings } from "@/simulation/league-sanity/warnings";
import type { CausalChainCheck } from "@/simulation/league-sanity/causal-chains";

export type LeagueSanityReport = {
  metadata: LeagueSanityReportMetadata;
  aggregates: LeagueSanityAggregates;
  relationships: RelationshipResult[];
  laggedCorrelations: CorrelationPair[];
  causalChains: CausalChainCheck[];
  warnings: LeagueSanityWarning[];
};

export type BuildLeagueSanityReportOptions = {
  simulations: number;
  seasonsPerSimulation: number;
  seed: number;
  gameSettings?: GameSettings;
  /** When provided, skip re-running careers. */
  careers?: LeagueCareerResult[];
  generatedAt?: string;
};

function flattenSnapshots(
  careers: readonly LeagueCareerResult[],
): LeagueSanityTeamSeasonSnapshot[] {
  const out: LeagueSanityTeamSeasonSnapshot[] = [];
  for (const career of careers) {
    out.push(...career.snapshots);
  }
  return out;
}

function configHash(input: {
  simulations: number;
  seasonsPerSimulation: number;
  seed: number;
  teamCount: number;
  gameSettings: GameSettings;
}): string {
  return hashPayload({
    simulations: input.simulations,
    seasonsPerSimulation: input.seasonsPerSimulation,
    seed: input.seed,
    teamCount: input.teamCount,
    settings: input.gameSettings,
  });
}

function resultChecksum(payload: {
  aggregates: LeagueSanityAggregates;
  relationships: RelationshipResult[];
  laggedCorrelations: CorrelationPair[];
  causalChains: CausalChainCheck[];
  warnings: LeagueSanityWarning[];
}): string {
  return hashPayload({
    aggregates: normalizeAggregates(payload.aggregates),
    relationships: payload.relationships.map((r) => ({
      name: r.name,
      r: r.r === null ? null : round6(r.r),
      n: r.n,
      lag: r.lag,
    })),
    lagged: payload.laggedCorrelations.map((r) => ({
      name: r.name,
      r: r.r === null ? null : round6(r.r),
      n: r.n,
      lag: r.lag,
    })),
    causal: payload.causalChains.map((c) => ({
      id: c.id,
      r: c.observed.r === null ? null : round6(c.observed.r),
      verdict: c.verdict,
    })),
    warnings: payload.warnings.map((w) => w.id).sort(),
  });
}

function normalizeAggregates(a: LeagueSanityAggregates): unknown {
  const roundSummary = (s: {
    n: number;
    mean: number;
    median: number;
    min: number;
    max: number;
    stdev: number;
    p10: number;
    p25: number;
    p75: number;
    p90: number;
  }) => ({
    n: s.n,
    mean: round6(s.mean),
    median: round6(s.median),
    min: round6(s.min),
    max: round6(s.max),
    stdev: round6(s.stdev),
    p10: round6(s.p10),
    p25: round6(s.p25),
    p75: round6(s.p75),
    p90: round6(s.p90),
  });
  return {
    teamSeasonCount: a.teamSeasonCount,
    franchiseCount: a.franchiseCount,
    tenure: {
      ...a.tenure,
      activeSeasons: roundSummary(a.tenure.activeSeasons),
      seasonsUntilFirstInsolvency: roundSummary(
        a.tenure.seasonsUntilFirstInsolvency,
      ),
      seasonsUntilRelocation: roundSummary(a.tenure.seasonsUntilRelocation),
      seasonsInsolventMean: round6(a.tenure.seasonsInsolventMean),
      financialDistressRate: round6(a.tenure.financialDistressRate),
      insolvencyRate: round6(a.tenure.insolvencyRate),
      relocationRate: round6(a.tenure.relocationRate),
      expansionEventsPerSimMean: round6(a.tenure.expansionEventsPerSimMean),
      survivalThroughSimulation: round6(a.tenure.survivalThroughSimulation),
    },
    franchiseValue: roundSummary(a.franchiseValue),
    cash: roundSummary(a.cash),
    netIncome: roundSummary(a.netIncome),
    payroll: roundSummary(a.payroll),
    winPct: roundSummary(a.winPct),
    attendance: roundSummary(a.attendance),
    fillRate: roundSummary(a.fillRate),
    championshipHhi: round6(a.championshipHhi),
    playoffAppearanceRate: round6(a.playoffAppearanceRate),
    facilityYoYMean:
      a.facilityYoYMean === null ? null : round6(a.facilityYoYMean),
    salaryInflation:
      a.salaryInflation === null ? null : round6(a.salaryInflation),
    competitiveMobility: {
      bottomToPlayoffRate: round6(a.competitiveMobility.bottomToPlayoffRate),
      playoffToContenderRate: round6(
        a.competitiveMobility.playoffToContenderRate,
      ),
      contenderToChampionRate: round6(
        a.competitiveMobility.contenderToChampionRate,
      ),
      championPlayoffRetentionRate: round6(
        a.competitiveMobility.championPlayoffRetentionRate,
      ),
      championToNonPlayoffRate: round6(
        a.competitiveMobility.championToNonPlayoffRate,
      ),
      rankPersistence:
        a.competitiveMobility.rankPersistence === null
          ? null
          : round6(a.competitiveMobility.rankPersistence),
      nTransitions: a.competitiveMobility.nTransitions,
    },
    valueMobility: {
      rankPersistence:
        a.valueMobility.rankPersistence === null
          ? null
          : round6(a.valueMobility.rankPersistence),
      bottomToTopRate: round6(a.valueMobility.bottomToTopRate),
      topToBottomRate: round6(a.valueMobility.topToBottomRate),
      yoyVolatilityMean:
        a.valueMobility.yoyVolatilityMean === null
          ? null
          : round6(a.valueMobility.yoyVolatilityMean),
    },
  };
}

export function buildLeagueSanityReport(
  options: BuildLeagueSanityReportOptions,
): LeagueSanityReport {
  const gameSettings = options.gameSettings ?? CBL_GAME_SETTINGS;
  const careers =
    options.careers ??
    runLeagueSanityBatch({
      simulations: options.simulations,
      seasonsPerSimulation: options.seasonsPerSimulation,
      seed: options.seed,
      gameSettings,
    });
  const snapshots = flattenSnapshots(careers);
  const teamCount =
    careers[0]?.teamCount ??
    (snapshots.length === 0
      ? 0
      : new Set(
          snapshots
            .filter((s) => s.simulationIndex === 0 && s.seasonIndex === 0)
            .map((s) => s.teamId),
        ).size);

  const aggregates = aggregateLeagueSanitySnapshots(
    snapshots,
    options.seasonsPerSimulation,
  );
  const { sameSeason, lagged } = computeLeagueSanityCorrelations(snapshots);
  const causalChains = evaluateCausalChains(snapshots);
  const warnings = evaluateSanityWarnings({
    aggregates,
    relationships: sameSeason,
    causalChains,
    simulations: options.simulations,
  });

  const simulationConfigHash = configHash({
    simulations: options.simulations,
    seasonsPerSimulation: options.seasonsPerSimulation,
    seed: options.seed,
    teamCount,
    gameSettings,
  });

  const checksum = resultChecksum({
    aggregates,
    relationships: sameSeason,
    laggedCorrelations: lagged,
    causalChains,
    warnings,
  });

  return {
    metadata: {
      simulationSeed: options.seed,
      simulationConfigHash,
      resultChecksum: checksum,
      simulations: options.simulations,
      seasonsPerSimulation: options.seasonsPerSimulation,
      teamCount,
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      generatedAt: options.generatedAt ?? new Date().toISOString(),
    },
    aggregates,
    relationships: sameSeason,
    laggedCorrelations: lagged,
    causalChains,
    warnings,
  };
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function fmtMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function fmtR(r: number | null): string {
  return r === null ? "n/a" : r.toFixed(3);
}

export function formatLeagueSanityReport(report: LeagueSanityReport): string {
  const a = report.aggregates;
  const m = report.metadata;
  const lines: string[] = [
    "LEAGUE SANITY REPORT",
    "====================",
    "",
    `Simulations: ${m.simulations}`,
    `Seasons per simulation: ${m.seasonsPerSimulation}`,
    `Teams: ${m.teamCount}`,
    `Seed: ${m.simulationSeed}`,
    `Config hash: ${m.simulationConfigHash}`,
    `Result checksum: ${m.resultChecksum}`,
    "",
    "FRANCHISE TENURE",
    `Average active seasons: ${a.tenure.activeSeasons.mean.toFixed(2)}`,
    `Median active seasons: ${a.tenure.activeSeasons.median.toFixed(2)}`,
    `Min / max active seasons: ${a.tenure.activeSeasons.min} / ${a.tenure.activeSeasons.max}`,
    `Relocation rate (team-seasons): ${fmtPct(a.tenure.relocationRate)}`,
    `Expansion events / sim (approx): ${a.tenure.expansionEventsPerSimMean.toFixed(2)}`,
    `Insolvency rate: ${fmtPct(a.tenure.insolvencyRate)}`,
    `Financial distress rate: ${fmtPct(a.tenure.financialDistressRate)}`,
    `Survival through simulation: ${fmtPct(a.tenure.survivalThroughSimulation)}`,
    "",
    "COMPETITIVE",
    `Championship concentration (HHI): ${a.championshipHhi.toFixed(3)}`,
    `Playoff appearance rate: ${fmtPct(a.playoffAppearanceRate)}`,
    `Median win%: ${a.winPct.median.toFixed(3)}`,
    `Bottom→playoff rate: ${fmtPct(a.competitiveMobility.bottomToPlayoffRate)}`,
    `Champion→non-playoff rate: ${fmtPct(a.competitiveMobility.championToNonPlayoffRate)}`,
    `Rank persistence: ${fmtR(a.competitiveMobility.rankPersistence)}`,
    "",
    "FINANCIAL",
    `Average franchise value: ${fmtMoney(a.franchiseValue.mean)}`,
    `Median franchise value: ${fmtMoney(a.franchiseValue.median)}`,
    `Value p10 / p90: ${fmtMoney(a.franchiseValue.p10)} / ${fmtMoney(a.franchiseValue.p90)}`,
    `Average cash: ${fmtMoney(a.cash.mean)}`,
    `Median net income: ${fmtMoney(a.netIncome.median)}`,
    `Median payroll: ${fmtMoney(a.payroll.median)}`,
    "",
    "VALUE MOBILITY",
    `Value rank persistence: ${fmtR(a.valueMobility.rankPersistence)}`,
    `Bottom→top quartile rate: ${fmtPct(a.valueMobility.bottomToTopRate)}`,
    `Top→bottom quartile rate: ${fmtPct(a.valueMobility.topToBottomRate)}`,
    `YoY volatility (mean |Δ|): ${a.valueMobility.yoyVolatilityMean === null ? "n/a" : fmtPct(a.valueMobility.yoyVolatilityMean)}`,
    "",
    "COMMERCIAL",
    `Average fill rate: ${a.fillRate.n === 0 ? "n/a" : fmtPct(a.fillRate.mean)}`,
    `Average attendance: ${a.attendance.n === 0 ? "n/a" : Math.round(a.attendance.mean).toLocaleString()}`,
    "",
    "PAYROLL / DEVELOPMENT",
    `Salary inflation (median YoY): ${a.salaryInflation === null ? "n/a" : fmtPct(a.salaryInflation)}`,
    `Facility YoY mean: ${a.facilityYoYMean === null ? "n/a" : a.facilityYoYMean.toFixed(3)}`,
    `Mean roster age: ${a.meanRosterAge.mean.toFixed(1)}`,
    "",
    "CORRELATIONS (same season)",
  ];

  for (const rel of report.relationships) {
    lines.push(
      `  ${rel.name}: r=${fmtR(rel.r)} n=${rel.n}${rel.diagnostic ? ` ⚠ ${rel.diagnostic}` : ""}`,
    );
  }

  lines.push("", "LAGGED CORRELATIONS");
  for (const rel of report.laggedCorrelations) {
    lines.push(`  ${rel.name}: r=${fmtR(rel.r)} n=${rel.n} lag=${rel.lag}`);
  }

  lines.push("", "CAUSAL CHAINS");
  for (const chain of report.causalChains) {
    lines.push(
      `  [${chain.verdict.toUpperCase()}] ${chain.description}: r=${fmtR(chain.observed.r)} (${chain.note})`,
    );
  }

  lines.push("", "WARNINGS");
  if (report.warnings.length === 0) {
    lines.push("  (none)");
  } else {
    for (const warning of report.warnings) {
      lines.push(`  - [${warning.severity}] ${warning.message}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
