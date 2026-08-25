/**
 * Pure compare of two league sanity reports for regression detection.
 */

import type { LeagueSanityReport } from "@/simulation/league-sanity/report";

export type SanityDiffRow = {
  path: string;
  baseline: number | null;
  current: number | null;
  delta: number | null;
  deltaPct: number | null;
  warn: boolean;
};

export type SanityCompareResult = {
  rows: SanityDiffRow[];
  warnCount: number;
  addedWarnings: string[];
  removedWarnings: string[];
};

const DEFAULT_PATHS = [
  "aggregates.franchiseValue.mean",
  "aggregates.championshipHhi",
  "aggregates.tenure.insolvencyRate",
  "aggregates.tenure.relocationRate",
  "aggregates.playoffAppearanceRate",
  "aggregates.competitiveMobility.rankPersistence",
  "aggregates.competitiveMobility.bottomToPlayoffRate",
  "aggregates.valueMobility.rankPersistence",
  "aggregates.valueMobility.bottomToTopRate",
  "aggregates.salaryInflation",
  "aggregates.cash.mean",
  "aggregates.payroll.median",
  "aggregates.attendance.mean",
  "aggregates.facilityYoYMean",
] as const;

const TOLERANCE_ABS: Record<string, number> = {
  "aggregates.championshipHhi": 0.05,
  "aggregates.tenure.insolvencyRate": 0.02,
  "aggregates.tenure.relocationRate": 0.02,
  "aggregates.playoffAppearanceRate": 0.05,
  "aggregates.competitiveMobility.rankPersistence": 0.08,
  "aggregates.competitiveMobility.bottomToPlayoffRate": 0.05,
  "aggregates.valueMobility.rankPersistence": 0.08,
  "aggregates.salaryInflation": 0.03,
};

const TOLERANCE_PCT: Record<string, number> = {
  "aggregates.franchiseValue.mean": 0.08,
  "aggregates.cash.mean": 0.15,
  "aggregates.payroll.median": 0.1,
  "aggregates.attendance.mean": 0.1,
};

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function compareLeagueSanityReports(
  baseline: LeagueSanityReport,
  current: LeagueSanityReport,
  paths: readonly string[] = DEFAULT_PATHS,
): SanityCompareResult {
  const rows: SanityDiffRow[] = paths.map((path) => {
    const b = num(getPath(baseline, path));
    const c = num(getPath(current, path));
    const delta = b !== null && c !== null ? c - b : null;
    const deltaPct =
      b !== null && c !== null && b !== 0 ? (c - b) / Math.abs(b) : null;
    let warn = false;
    if (delta !== null) {
      const absTol = TOLERANCE_ABS[path];
      const pctTol = TOLERANCE_PCT[path];
      if (absTol !== undefined && Math.abs(delta) > absTol) warn = true;
      if (
        pctTol !== undefined &&
        deltaPct !== null &&
        Math.abs(deltaPct) > pctTol
      ) {
        warn = true;
      }
      if (absTol === undefined && pctTol === undefined && deltaPct !== null) {
        warn = Math.abs(deltaPct) > 0.15;
      }
    }
    return { path, baseline: b, current: c, delta, deltaPct, warn };
  });

  const baseWarn = new Set(baseline.warnings.map((w) => w.id));
  const curWarn = new Set(current.warnings.map((w) => w.id));
  return {
    rows,
    warnCount: rows.filter((r) => r.warn).length,
    addedWarnings: [...curWarn].filter((id) => !baseWarn.has(id)),
    removedWarnings: [...baseWarn].filter((id) => !curWarn.has(id)),
  };
}
