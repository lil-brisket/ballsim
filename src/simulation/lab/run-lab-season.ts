import type { GameSettings } from "@/domain/game-settings";
import { runLeagueCareer } from "@/simulation/league-sanity/run-league-career";
import { hashPayload } from "@/simulation/analytics/hash";
import { readEngineIdentity } from "@/simulation/lab/engine-identity";
import { buildMasterSeedList } from "@/simulation/lab/lab-seeds";
import { persistLabRun } from "@/simulation/lab/persist-run";
import type { LabPersistOptions } from "@/simulation/lab/manifest";
import { formatReproCommand } from "@/simulation/lab/repro";
import {
  OWNER_CAREER_SCENARIO_ID,
  scenarioVersionFor,
} from "@/simulation/lab/scenario-version";
import type { LabLeaguePreset } from "@/simulation/lab/lab-league-preset";
import type { LabReport } from "@/simulation/lab/types";

export type RunLabSeasonOptions = {
  seed: number;
  seasons: number;
  mode?: "owner-career";
  gameSettings?: GameSettings;
  preset?: LabLeaguePreset;
} & LabPersistOptions;

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
  const preset = options.preset ?? "cbl";
  const seedList = buildMasterSeedList(options.seed, OWNER_CAREER_SCENARIO_ID);
  const persisted = persistLabRun(options, {
    scenarioName: OWNER_CAREER_SCENARIO_ID,
    scenarioVersion: scenarioVersionFor(OWNER_CAREER_SCENARIO_ID),
    config: {
      mode: "owner-career",
      seed: options.seed,
      seasons,
      scenarioId: OWNER_CAREER_SCENARIO_ID,
      rotation: "on",
      preset,
      usesLabPresetSettings: options.gameSettings != null,
    },
    seedList,
  });

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
    scenarioId: OWNER_CAREER_SCENARIO_ID,
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
    ...(persisted.runId != null ? { runId: persisted.runId } : {}),
    ...(persisted.manifestPath != null
      ? { manifestPath: persisted.manifestPath }
      : {}),
  };

  return { report, series };
}
