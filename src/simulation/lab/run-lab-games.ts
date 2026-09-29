import type { GameResult } from "@/domain/entities/game-result";
import { join } from "node:path";
import { ENGINE_VERSION } from "@/simulation/lab/engine-version";
import { overtimeHighFailure } from "@/simulation/lab/collect-game-failures";
import { readEngineIdentity } from "@/simulation/lab/engine-identity";
import {
  writeGameFailureArtifacts,
  type LabFailureArtifactPaths,
} from "@/simulation/lab/failure-artifacts";
import {
  appendGameNdjsonRow,
  labGamesNdjsonPath,
  readGamesNdjsonFile,
  snapshotsFromNdjson,
  type LabGameNdjsonRow,
} from "@/simulation/lab/games-ndjson";
import {
  assertCheckpointMatches,
  completedIndexSet,
  labCheckpointPath,
  loadLabCheckpoint,
  writeLabCheckpoint,
  type LabRunCheckpoint,
} from "@/simulation/lab/checkpoint";
import {
  LAB_DEFAULT_CHUNK_SIZE,
  LAB_DEFAULT_JOBS,
  assertLabChunkSize,
  assertLabJobs,
  assertLabTimeoutMs,
  remainingGameIndexes,
} from "@/simulation/lab/chunk-indexes";
import { LabRunInterruptedError } from "@/simulation/lab/interrupted-error";
import { lookupInvariant } from "@/simulation/lab/invariant-registry";
import {
  createLabGameSession,
  playLabGame,
  resolveLabGameConfig,
  type LabGameSession,
  type LabGameSessionOptions,
} from "@/simulation/lab/lab-game-session";
import {
  harnessLabGame,
  playerStatsMapFromRows,
  type LabGameHarnessRecord,
} from "@/simulation/lab/lab-game-harness";
import { toLabFailure } from "@/simulation/lab/map-failure";
import { powerEstimatesForKeyMetrics } from "@/simulation/lab/confidence";
import type { LabWorkerFactory } from "@/simulation/lab/lab-game-pool";
import { persistLabRun } from "@/simulation/lab/persist-run";
import {
  DEFAULT_LAB_RESULTS_ROOT,
  type LabPersistOptions,
  type LabResolvedConfig,
} from "@/simulation/lab/manifest";
import { formatReproCommand } from "@/simulation/lab/repro";
import { scenarioVersionFor } from "@/simulation/lab/scenario-version";
import type {
  LabFailure,
  LabFailureContext,
  LabReport,
  SimChannel,
} from "@/simulation/lab/types";
import { aggregateSnapshots } from "@/simulation/validation/aggregate";
import { computeValidationChecksum } from "@/simulation/validation/checksum";
import {
  combineVerdicts,
  evaluatePlausibility,
} from "@/simulation/validation/plausibility";
import { evaluatePlayerCorrelations } from "@/simulation/validation/correlations";
import type { GameSnapshot } from "@/simulation/validation/types";
import { evaluateCalibration } from "@/simulation/lab/calibration";
import {
  buildLabGoldenBaseline,
  compareLabGoldenBaseline,
  loadLabGoldenBaseline,
  writeLabGoldenBaseline,
} from "@/simulation/lab/golden-baseline";

export type RunLabGamesOptions = LabGameSessionOptions &
  LabPersistOptions & {
    channel?: SimChannel;
    afterSimulateGame?: (result: GameResult) => GameResult;
    jobs?: number;
    chunkSize?: number;
    timeoutMs?: number;
    resume?: boolean;
    signal?: AbortSignal;
    useWorkers?: boolean;
    createWorker?: LabWorkerFactory;
    harnessGame?: (
      gameIndex: number,
      session: LabGameSession,
    ) => LabGameHarnessRecord;
    baselinePath?: string;
    writeBaselinePath?: string;
    calibrate?: boolean;
    ksAlpha?: number;
  };

export type LabGamesRunState = {
  options: RunLabGamesOptions;
  session: LabGameSession;
  resolvedConfig: LabResolvedConfig;
  failureCtx: LabFailureContext;
  engineIdentity: ReturnType<typeof readEngineIdentity>;
  reproCommand: string;
  persist: boolean;
  runId?: string;
  manifestPath?: string;
  resultsRoot?: string;
  checkpointPath?: string;
  completed: Set<number>;
  snapshots: GameSnapshot[];
  playerGameStats: Map<
    string,
    { points: number; rebounds: number; assists: number }
  >[];
  hardFailures: LabFailure[];
  warnings: LabFailure[];
  failureArtifacts: LabFailureArtifactPaths[];
  overtimeHighCount: number;
  gamesNdjsonPath?: string;
  streamFromDisk: boolean;
};

export function runLabGames(options: RunLabGamesOptions): LabReport {
  const jobs = options.jobs ?? LAB_DEFAULT_JOBS;
  const timeoutMs = options.timeoutMs ?? 0;
  if (jobs > 1 || timeoutMs > 0) {
    throw new Error(
      "runLabGames: jobs>1 or timeoutMs>0 requires runLabGamesAsync.",
    );
  }
  const state = prepareLabGamesRun(options);
  const remaining = remainingGameIndexes(options.games, state.completed);
  for (const gameIndex of remaining) {
    throwIfInterrupted(state, gameIndex);
    const record =
      options.harnessGame != null
        ? options.harnessGame(gameIndex, state.session)
        : harnessLabGame(state.session, gameIndex, options.afterSimulateGame);
    applyHarnessRecord(state, record);
  }
  return finishLabGamesRun(state);
}

export function prepareLabGamesRun(
  options: RunLabGamesOptions,
): LabGamesRunState {
  const jobs = options.jobs ?? LAB_DEFAULT_JOBS;
  const chunkSize = options.chunkSize ?? LAB_DEFAULT_CHUNK_SIZE;
  const timeoutMs = options.timeoutMs ?? 0;
  assertLabJobs(jobs, options.rotation ?? "on");
  assertLabChunkSize(chunkSize);
  assertLabTimeoutMs(timeoutMs);
  if (options.resume && options.persist !== true) {
    throw new Error(
      "Lab --resume requires persist (do not pass --no-persist).",
    );
  }
  if (options.useWorkers === true && options.afterSimulateGame != null) {
    throw new Error("Lab workers cannot apply afterSimulateGame.");
  }
  if (options.useWorkers === true && options.harnessGame != null) {
    throw new Error("Lab workers cannot apply a custom harnessGame.");
  }
  if (options.useWorkers === true && options.buildRosters != null) {
    throw new Error("Lab workers cannot apply a custom buildRosters function.");
  }

  const resolved = resolveLabGameConfig(options);
  const engineIdentity = readEngineIdentity();
  const reproCommand = formatReproCommand({
    seed: options.seed,
    scenarioId: resolved.scenarioId,
    games: options.games,
    rotation: resolved.rotation,
  });
  const failureCtx: LabFailureContext = {
    seed: options.seed,
    scenarioId: resolved.scenarioId,
    reproCommand,
    engineIdentity,
  };
  const resolvedConfig: LabResolvedConfig = {
    mode: "game",
    seed: options.seed,
    games: options.games,
    scenarioId: resolved.scenarioId,
    rotation: resolved.rotation,
    ...(options.channel != null ? { channel: options.channel } : {}),
    ...(options.rosterSize != null ? { rosterSize: options.rosterSize } : {}),
    ...(jobs !== LAB_DEFAULT_JOBS ? { jobs } : {}),
    ...(options.chunkSize != null ? { chunkSize } : {}),
    ...(timeoutMs > 0 ? { timeoutMs } : {}),
  };

  let runId = options.runId;
  let manifestPath: string | undefined;
  const resultsRoot = options.resultsRoot ?? DEFAULT_LAB_RESULTS_ROOT;
  if (options.resume) {
    if (runId == null) {
      throw new Error("Lab --resume requires --run-id.");
    }
    manifestPath = join(resultsRoot, runId, "manifest.json");
  } else {
    const persisted = persistLabRun(options, {
      scenarioName: resolved.scenarioId,
      scenarioVersion: scenarioVersionFor(resolved.scenarioId),
      config: resolvedConfig,
      seedList: resolved.seedList,
    });
    runId = persisted.runId;
    manifestPath = persisted.manifestPath;
  }

  const persist = options.persist === true;
  const checkpointFile =
    persist && runId != null
      ? labCheckpointPath(resultsRoot, runId)
      : undefined;
  let checkpoint: LabRunCheckpoint | null = null;
  if (options.resume) {
    if (checkpointFile == null) {
      throw new Error("Lab --resume requires a results directory and run id.");
    }
    checkpoint = loadLabCheckpoint(checkpointFile, options.host);
    assertCheckpointMatches({
      checkpoint,
      runId: runId!,
      games: options.games,
      seed: options.seed,
      scenarioId: resolved.scenarioId,
      rotation: resolved.rotation,
    });
  }

  const session = createLabGameSession({
    ...options,
    seedList: resolved.seedList,
  });
  const completed = completedIndexSet(checkpoint);
  if (options.resume && session.rotation === "on") {
    for (const gameIndex of [...completed].sort(
      (left, right) => left - right,
    )) {
      playLabGame(session, gameIndex);
    }
  }

  return {
    options,
    session,
    resolvedConfig,
    failureCtx,
    engineIdentity,
    reproCommand,
    persist,
    ...(runId != null ? { runId } : {}),
    ...(manifestPath != null ? { manifestPath } : {}),
    ...(resultsRoot != null ? { resultsRoot } : {}),
    ...(checkpointFile != null ? { checkpointPath: checkpointFile } : {}),
    completed,
    snapshots: [],
    playerGameStats: [],
    hardFailures: [],
    warnings: [],
    failureArtifacts: [],
    overtimeHighCount: 0,
    streamFromDisk: persist && runId != null,
  };
}

export function applyHarnessRecord(
  state: LabGamesRunState,
  record: LabGameHarnessRecord,
): void {
  if (record.snapshot != null) {
    if (state.streamFromDisk && state.runId != null) {
      const row: LabGameNdjsonRow = {
        ...record.snapshot,
        gameIndex: record.gameIndex,
        gameSeed: record.gameSeed,
        playerStats: record.playerStats,
      };
      state.gamesNdjsonPath = appendGameNdjsonRow({
        runId: state.runId,
        resultsRoot: state.resultsRoot,
        row,
        host: state.options.host,
      });
    } else {
      state.snapshots.push(record.snapshot);
      state.playerGameStats.push(playerStatsMapFromRows(record.playerStats));
    }
    if (record.overtimePeriodCount != null) {
      const otWarning = overtimeHighFailure(
        record.overtimePeriodCount,
        record.snapshot.gameId,
      );
      if (otWarning) {
        state.overtimeHighCount += 1;
        state.warnings.push(toLabFailure(otWarning, state.failureCtx));
      }
    }
  }

  const hardRaw = record.rawFailures.filter(
    (raw) => lookupInvariant(raw.rule).severity === "HARD_FAILURE",
  );
  if (hardRaw.length > 0 && state.runId != null) {
    state.failureArtifacts.push(
      writeGameFailureArtifacts({
        runId: state.runId,
        resultsRoot: state.resultsRoot,
        gameIndex: record.gameIndex,
        seed: record.gameSeed,
        config: state.resolvedConfig,
        failures: hardRaw,
        events: record.events,
        host: state.options.host,
      }),
    );
  }

  for (const raw of record.rawFailures) {
    const mapped = toLabFailure(raw, state.failureCtx);
    if (mapped.severity === "HARD_FAILURE") {
      state.hardFailures.push(mapped);
    } else if (mapped.severity === "WARNING") {
      state.warnings.push(mapped);
    }
  }

  state.completed.add(record.gameIndex);
  if (state.runId != null && state.persist) {
    writeLabCheckpoint({
      resultsRoot: state.resultsRoot,
      host: state.options.host,
      checkpoint: {
        runId: state.runId,
        gamesTotal: state.options.games,
        completedGameIndexes: [...state.completed].sort(
          (left, right) => left - right,
        ),
        updatedAt: (state.options.host?.now?.() ?? new Date()).toISOString(),
        engineVersion: ENGINE_VERSION,
        seed: state.options.seed,
        scenarioId: state.session.scenarioId,
        rotation: state.session.rotation,
      },
    });
  }
}

export function finishLabGamesRun(state: LabGamesRunState): LabReport {
  let snapshots = state.snapshots;
  let playerGameStats = state.playerGameStats;
  if (state.streamFromDisk && state.runId != null) {
    const filePath = labGamesNdjsonPath(
      state.resultsRoot ?? DEFAULT_LAB_RESULTS_ROOT,
      state.runId,
    );
    const rows = readGamesNdjsonFile(filePath, state.options.host);
    snapshots = snapshotsFromNdjson(rows);
    playerGameStats = rows.map((row) =>
      playerStatsMapFromRows(row.playerStats ?? []),
    );
    if (rows.length > 0) {
      state.gamesNdjsonPath = filePath;
    }
  }

  const aggregates =
    snapshots.length > 0
      ? aggregateSnapshots(snapshots, state.options.seed)
      : null;
  const plausibilityChecks = aggregates ? evaluatePlausibility(aggregates) : [];
  const correlations = aggregates
    ? evaluatePlayerCorrelations(
        state.session.homePlayers,
        state.session.awayPlayers,
        snapshots,
        playerGameStats,
      )
    : [];
  const overallVerdict = combineVerdicts([
    ...plausibilityChecks.map((check) => check.verdict),
    ...correlations.map((corr) => corr.verdict),
  ]);
  const powerEstimates = aggregates
    ? powerEstimatesForKeyMetrics({
        team_points: aggregates.teamPoints.n,
        game_totals: aggregates.gameTotals.n,
        points_per_possession: aggregates.pointsPerPossession.n,
        field_goal_pct: aggregates.fieldGoalPct.n,
        abs_differential: aggregates.absoluteDifferentials.n,
      })
    : undefined;
  const ksChecks =
    state.options.baselinePath != null && snapshots.length > 0
      ? compareLabGoldenBaseline({
          baseline: loadLabGoldenBaseline(state.options.baselinePath),
          snapshots,
          alpha: state.options.ksAlpha,
        })
      : undefined;
  const calibrationChecks =
    state.options.calibrate === true && aggregates != null
      ? evaluateCalibration({
          teamPointsMean: aggregates.teamPoints.mean,
          gameTotalsMean: aggregates.gameTotals.mean,
          fieldGoalPctMean: aggregates.fieldGoalPct.mean,
          threePointPctMean: aggregates.threePointPct.mean,
          freeThrowPctMean: aggregates.freeThrowPct.mean,
        })
      : undefined;
  const checksum = computeValidationChecksum({
    seed: state.options.seed,
    gamesSimulated: snapshots.length,
    aggregates: aggregates ?? emptyAggregates(state.options.seed),
    invariantFailureCount: state.hardFailures.length,
    plausibilityChecks,
    correlations,
    overallVerdict,
  });
  if (state.options.writeBaselinePath != null && snapshots.length > 0) {
    writeLabGoldenBaseline(
      state.options.writeBaselinePath,
      buildLabGoldenBaseline({
        seed: state.options.seed,
        games: state.options.games,
        scenarioId: state.session.scenarioId,
        rotation: state.session.rotation,
        checksum,
        snapshots,
      }),
    );
  }

  return {
    seed: state.options.seed,
    scenarioId: state.session.scenarioId,
    gamesSimulated: state.options.games,
    rotation: state.session.rotation,
    engineIdentity: state.engineIdentity,
    reproCommand: state.reproCommand,
    hardFailures: state.hardFailures,
    warnings: state.warnings,
    statChecks: plausibilityChecks,
    checksum,
    aggregates,
    overtimeHighCount: state.overtimeHighCount,
    ...(state.runId != null ? { runId: state.runId } : {}),
    ...(state.manifestPath != null ? { manifestPath: state.manifestPath } : {}),
    ...(state.checkpointPath != null
      ? { checkpointPath: state.checkpointPath }
      : {}),
    ...(state.failureArtifacts.length > 0
      ? { failureArtifacts: state.failureArtifacts }
      : {}),
    ...(state.gamesNdjsonPath != null
      ? { gamesNdjsonPath: state.gamesNdjsonPath }
      : {}),
    ...(powerEstimates != null ? { powerEstimates } : {}),
    ...(ksChecks != null ? { ksChecks } : {}),
    ...(calibrationChecks != null ? { calibrationChecks } : {}),
    ...(state.options.baselinePath != null
      ? { baselinePath: state.options.baselinePath }
      : {}),
  };
}

export function throwIfInterrupted(
  state: LabGamesRunState,
  nextGameIndex?: number,
): void {
  if (!state.options.signal?.aborted) {
    return;
  }
  throw new LabRunInterruptedError({
    reason: "aborted",
    runId: state.runId,
    checkpointPath: state.checkpointPath,
    completedGameIndexes: [...state.completed],
    timedOutGameIndex: nextGameIndex,
  });
}

function emptyAggregates(seed: number | string) {
  const zero = {
    n: 0,
    mean: 0,
    median: 0,
    min: 0,
    max: 0,
    stdev: 0,
    ci95Low: null,
    ci95High: null,
  };
  return {
    gamesSimulated: 0,
    seed,
    teamPoints: zero,
    gameTotals: zero,
    absoluteDifferentials: zero,
    possessionsPerTeam: zero,
    pointsPerPossession: zero,
    fieldGoalPct: zero,
    threePointPct: zero,
    freeThrowPct: zero,
    offensiveRebounds: zero,
    defensiveRebounds: zero,
    totalRebounds: zero,
    assists: zero,
    turnovers: zero,
    fouls: zero,
    freeThrowAttempts: zero,
    assistToFgmRatio: zero,
    pooledShooting: {
      fieldGoalsMade: 0,
      fieldGoalsAttempted: 0,
      fieldGoalPct: null,
      threePointersMade: 0,
      threePointersAttempted: 0,
      threePointPct: null,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      freeThrowPct: null,
    },
    homeAway: {
      homeWinRate: 0,
      homeWins: 0,
      awayWins: 0,
      homePoints: zero,
      awayPoints: zero,
      homeFieldGoalPct: zero,
      awayFieldGoalPct: zero,
      homeThreePointPct: zero,
      awayThreePointPct: zero,
      homeTurnovers: zero,
      awayTurnovers: zero,
    },
  };
}
