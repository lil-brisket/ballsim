import type { GameSettings } from "@/domain/game-settings";
import { runLeagueCareer } from "@/simulation/league-sanity/run-league-career";
import { readEngineIdentity } from "@/simulation/lab/engine-identity";
import { formatReproCommand } from "@/simulation/lab/repro";
import type { LabReport } from "@/simulation/lab/types";
import { hashPayload } from "@/simulation/analytics/hash";

export type RunLabSeasonOptions = {
  seed: number;
  seasons: number;
  mode?: "owner-career";
  gameSettings?: GameSettings;
};

export type LongitudinalPoint = {
  seasonIndex: number;
  meanWinPct: number;
  meanRosterAge: number;
  meanPayroll: number;
  meanRosterStrength: number;
  teamCount: number;
};

export type LabSeasonResult = {
  report: LabReport;
  series: LongitudinalPoint[];
};

export function runLabSeason(options: RunLabSeasonOptions): LabSeasonResult {
  const seasons = options.seasons;
  if (!Number.isInteger(seasons) || seasons < 1) {
    throw new Error("runLabSeason: seasons must be a positive integer.");
  }
  const career = runLeagueCareer({
    seed: options.seed,
    seasons,
    gameSettings: options.gameSettings,
  });

  const engineIdentity = readEngineIdentity();
  const reproCommand = formatReproCommand({
    seed: options.seed,
    scenarioId: "owner-career",
    mode: "owner-career",
    seasons,
  });

  const bySeason = new Map<number, typeof career.snapshots>();
  for (const snap of career.snapshots) {
    const list = bySeason.get(snap.seasonIndex) ?? [];
    list.push(snap);
    bySeason.set(snap.seasonIndex, list);
  }

  const series: LongitudinalPoint[] = [...bySeason.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([seasonIndex, snaps]) => {
      const n = snaps.length;
      const avg = (pick: (s: (typeof snaps)[number]) => number) =>
        snaps.reduce((sum, row) => sum + pick(row), 0) / Math.max(n, 1);
      return {
        seasonIndex,
        meanWinPct: avg((row) => row.winPct),
        meanRosterAge: avg((row) => row.meanRosterAge),
        meanPayroll: avg((row) => row.payroll),
        meanRosterStrength: avg((row) => row.rosterStrength),
        teamCount: n,
      };
    });

  const checksum = hashPayload({
    seed: options.seed,
    seasons: career.seasonsSimulated,
    teamCount: career.teamCount,
    snapshotCount: career.snapshots.length,
    series,
  });

  const report: LabReport = {
    seed: options.seed,
    scenarioId: "owner-career",
    gamesSimulated: 0,
    rotation: "on",
    engineIdentity,
    reproCommand,
    hardFailures: [],
    warnings: [],
    statChecks: [],
    checksum,
    aggregates: null,
    overtimeHighCount: 0,
    seasonsSimulated: career.seasonsSimulated,
  };

  return { report, series };
}
