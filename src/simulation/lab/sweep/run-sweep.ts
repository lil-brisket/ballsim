import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { normalizeSeed } from "@/domain/rng";
import { persistLabRun } from "@/simulation/lab/persist-run";
import {
  DEFAULT_LAB_RESULTS_ROOT,
  type LabPersistOptions,
  type ManifestHost,
} from "@/simulation/lab/manifest";
import {
  runLabGames,
  type RunLabGamesOptions,
} from "@/simulation/lab/run-lab-games";
import { scenarioVersionFor } from "@/simulation/lab/scenario-version";
import { applySweepParams } from "@/simulation/lab/sweep/apply-params";
import { sampleSweepSpace } from "@/simulation/lab/sweep/sample";
import {
  rankSensitivity,
  type SensitivityRanking,
} from "@/simulation/lab/sweep/sensitivity";
import {
  LAB_DEFAULT_SWEEP_SAMPLES,
  LAB_SENSITIVITY_FILENAME,
  LAB_SWEEP_NDJSON_FILENAME,
  type LabSweepSampler,
  type LabSweepSpace,
} from "@/simulation/lab/sweep/space";

export const LAB_SWEEP_PRIMARY_METRIC = "team_points.mean";

export type SweepPointMetrics = {
  teamPointsMean: number;
  gameTotalsMean: number;
  absDifferentialMean: number;
  fieldGoalPctMean: number;
  checksum: string;
  gamesSimulated: number;
};

export type SweepRow = {
  index: number;
  params: Record<string, string | number>;
  metrics: SweepPointMetrics;
};

export type SweepResult = {
  sampler: LabSweepSampler;
  space: LabSweepSpace;
  rows: SweepRow[];
  sensitivity: SensitivityRanking;
  runId?: string;
  manifestPath?: string;
  sweepNdjsonPath?: string;
  sensitivityPath?: string;
};

export type RunSweepOptions = LabPersistOptions & {
  space: LabSweepSpace;
  sampler: LabSweepSampler;
  sampleCount?: number;
  seed: number | string;
  games: number;
  scenarioId?: string;
  rotation?: "on" | "off";
  channel?: RunLabGamesOptions["channel"];
  signal?: AbortSignal;
  runPoint?: (
    params: Record<string, string | number>,
    index: number,
  ) => SweepPointMetrics;
};

export function metricsFromLabReport(report: {
  checksum: string;
  gamesSimulated: number;
  aggregates: {
    teamPoints: { mean: number };
    gameTotals: { mean: number };
    absoluteDifferentials: { mean: number };
    fieldGoalPct: { mean: number };
  } | null;
}): SweepPointMetrics {
  const aggregates = report.aggregates;
  return {
    teamPointsMean: aggregates?.teamPoints.mean ?? 0,
    gameTotalsMean: aggregates?.gameTotals.mean ?? 0,
    absDifferentialMean: aggregates?.absoluteDifferentials.mean ?? 0,
    fieldGoalPctMean: aggregates?.fieldGoalPct.mean ?? 0,
    checksum: report.checksum,
    gamesSimulated: report.gamesSimulated,
  };
}

export function runLabSweep(options: RunSweepOptions): SweepResult {
  const sampleCount = options.sampleCount ?? LAB_DEFAULT_SWEEP_SAMPLES;
  const points = sampleSweepSpace({
    space: options.space,
    sampler: options.sampler,
    sampleCount,
    seed: options.seed,
  });
  const persist = options.persist === true;
    const persisted = persistLabRun(options, {
    scenarioName: "sweep",
    scenarioVersion: scenarioVersionFor("normal"),
    config: {
      mode: "game",
      seed: options.seed,
      games: options.games,
      scenarioId: options.scenarioId ?? "normal",
      rotation: options.rotation ?? "on",
      sampler: options.sampler,
      samples: points.length,
    },
    seedList: [{ stream: "sweep", seed: normalizeSeed(options.seed) }],
  });
  const rows: SweepRow[] = [];
  const resultsRoot = options.resultsRoot ?? DEFAULT_LAB_RESULTS_ROOT;
  let sweepNdjsonPath: string | undefined;
  if (persist && persisted.runId != null) {
    sweepNdjsonPath = join(
      resultsRoot,
      persisted.runId,
      LAB_SWEEP_NDJSON_FILENAME,
    );
  }

  for (let index = 0; index < points.length; index += 1) {
    if (options.signal?.aborted) {
      throw new Error(
        `Lab sweep aborted after ${rows.length} of ${points.length} configs.`,
      );
    }
    const params = points[index]!;
    const metrics =
      options.runPoint != null
        ? options.runPoint(params, index)
        : metricsFromLabReport(
            runLabGames(
              applySweepParams(
                {
                  seed: options.seed,
                  games: options.games,
                  scenarioId: options.scenarioId,
                  rotation: options.rotation,
                  channel: options.channel,
                  persist: false,
                },
                params,
              ),
            ),
          );
    const row: SweepRow = { index, params, metrics };
    rows.push(row);
    if (sweepNdjsonPath != null) {
      appendSweepRow(sweepNdjsonPath, row, options.host);
    }
  }

  const sensitivity = rankSensitivity({
    parameters: options.space.parameters.map((param) => param.name),
    paramRows: rows.map((row) => row.params),
    metrics: {
      [LAB_SWEEP_PRIMARY_METRIC]: rows.map((row) => row.metrics.teamPointsMean),
      "game_totals.mean": rows.map((row) => row.metrics.gameTotalsMean),
      "abs_differential.mean": rows.map(
        (row) => row.metrics.absDifferentialMean,
      ),
      "field_goal_pct.mean": rows.map((row) => row.metrics.fieldGoalPctMean),
    },
    primaryMetric: LAB_SWEEP_PRIMARY_METRIC,
  });

  let sensitivityPath: string | undefined;
  if (persist && persisted.runId != null) {
    sensitivityPath = join(
      resultsRoot,
      persisted.runId,
      LAB_SENSITIVITY_FILENAME,
    );
    writeSweepFile(
      sensitivityPath,
      `${JSON.stringify(sensitivity, null, 2)}\n`,
      options.host,
    );
  }

  return {
    sampler: options.sampler,
    space: options.space,
    rows,
    sensitivity,
    ...(persisted.runId != null ? { runId: persisted.runId } : {}),
    ...(persisted.manifestPath != null
      ? { manifestPath: persisted.manifestPath }
      : {}),
    ...(sweepNdjsonPath != null ? { sweepNdjsonPath } : {}),
    ...(sensitivityPath != null ? { sensitivityPath } : {}),
  };
}

function appendSweepRow(
  filePath: string,
  row: SweepRow,
  host?: ManifestHost,
): void {
  const mkdir =
    host?.mkdir ?? ((target: string) => mkdirSync(target, { recursive: true }));
  mkdir(dirname(filePath));
  const appendFile =
    host?.appendFile ??
    ((target: string, contents: string) => {
      writeFileSync(target, contents, { encoding: "utf8", flag: "a" });
    });
  appendFile(filePath, `${JSON.stringify(row)}\n`);
}

function writeSweepFile(
  filePath: string,
  contents: string,
  host?: ManifestHost,
): void {
  const writeFile =
    host?.writeFile ??
    ((target: string, text: string) => {
      writeFileSync(target, text, "utf8");
    });
  writeFile(filePath, contents);
}
