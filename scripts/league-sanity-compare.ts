/**
 * Compare two league sanity JSON reports for regression detection.
 *
 * Usage:
 *   npx tsx scripts/league-sanity-compare.ts baseline.json current.json
 */

import { readFileSync } from "node:fs";
import type { LeagueSanityReport } from "@/simulation/league-sanity";

type DiffRow = {
  path: string;
  baseline: number | null;
  current: number | null;
  delta: number | null;
  deltaPct: number | null;
  warn: boolean;
};

const TOLERANCE_ABS: Record<string, number> = {
  "aggregates.championshipHhi": 0.05,
  "aggregates.tenure.insolvencyRate": 0.02,
  "aggregates.tenure.relocationRate": 0.02,
  "aggregates.playoffAppearanceRate": 0.05,
  "aggregates.competitiveMobility.rankPersistence": 0.08,
  "aggregates.competitiveMobility.bottomToPlayoffRate": 0.05,
  "aggregates.valueMobility.rankPersistence": 0.08,
  "aggregates.salaryInflation": 0.03,
  "aggregates.franchiseValue.mean": 0, // use pct
};

const TOLERANCE_PCT: Record<string, number> = {
  "aggregates.franchiseValue.mean": 0.08,
  "aggregates.cash.mean": 0.15,
  "aggregates.payroll.median": 0.1,
  "aggregates.attendance.mean": 0.1,
};

function readReport(path: string): LeagueSanityReport {
  return JSON.parse(readFileSync(path, "utf8")) as LeagueSanityReport;
}

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

function compareMetric(path: string, baseline: LeagueSanityReport, current: LeagueSanityReport): DiffRow {
  const b = num(getPath(baseline, path));
  const c = num(getPath(current, path));
  const delta = b !== null && c !== null ? c - b : null;
  const deltaPct =
    b !== null && c !== null && b !== 0 ? (c - b) / Math.abs(b) : null;

  let warn = false;
  if (delta !== null) {
    const absTol = TOLERANCE_ABS[path];
    const pctTol = TOLERANCE_PCT[path];
    if (absTol !== undefined && Math.abs(delta) > absTol) {
      warn = true;
    }
    if (pctTol !== undefined && deltaPct !== null && Math.abs(deltaPct) > pctTol) {
      warn = true;
    }
    if (absTol === undefined && pctTol === undefined && deltaPct !== null) {
      warn = Math.abs(deltaPct) > 0.15;
    }
  }

  return { path, baseline: b, current: c, delta, deltaPct, warn };
}

const PATHS = [
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
];

const baselinePath = process.argv[2];
const currentPath = process.argv[3];
if (!baselinePath || !currentPath) {
  console.error(
    "Usage: npx tsx scripts/league-sanity-compare.ts <baseline.json> <current.json>",
  );
  process.exit(1);
}

const baseline = readReport(baselinePath);
const current = readReport(currentPath);
const diffs = PATHS.map((path) => compareMetric(path, baseline, current));

console.log("LEAGUE SANITY REGRESSION COMPARE");
console.log("================================");
console.log(`Baseline seed: ${baseline.metadata.simulationSeed} checksum=${baseline.metadata.resultChecksum}`);
console.log(`Current seed:  ${current.metadata.simulationSeed} checksum=${current.metadata.resultChecksum}`);
console.log("");

let warnCount = 0;
for (const row of diffs) {
  const deltaStr =
    row.delta === null
      ? "n/a"
      : row.deltaPct !== null
        ? `${row.delta >= 0 ? "+" : ""}${(row.deltaPct * 100).toFixed(1)}%`
        : `${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(4)}`;
  const flag = row.warn ? " WARN" : "";
  if (row.warn) warnCount += 1;
  console.log(
    `${row.path.padEnd(55)} ${String(row.baseline).padStart(12)} → ${String(row.current).padStart(12)}  (${deltaStr})${flag}`,
  );
}

console.log("");
console.log(
  warnCount === 0
    ? "No regression warnings."
    : `${warnCount} metric(s) exceeded tolerance.`,
);

// Also compare warning id sets
const baseWarn = new Set(baseline.warnings.map((w) => w.id));
const curWarn = new Set(current.warnings.map((w) => w.id));
const added = [...curWarn].filter((id) => !baseWarn.has(id));
const removed = [...baseWarn].filter((id) => !curWarn.has(id));
if (added.length > 0) {
  console.log(`New warnings: ${added.join(", ")}`);
}
if (removed.length > 0) {
  console.log(`Cleared warnings: ${removed.join(", ")}`);
}

process.exit(warnCount > 0 ? 2 : 0);
