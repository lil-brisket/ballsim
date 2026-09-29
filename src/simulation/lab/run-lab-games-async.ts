import {
  LAB_DEFAULT_CHUNK_SIZE,
  LAB_DEFAULT_JOBS,
  remainingGameIndexes,
} from "@/simulation/lab/chunk-indexes";
import {
  createInProcessIndependentWorker,
  createInProcessSharedWorker,
  createThreadWorker,
  runHarnessPool,
  type LabWorkerFactory,
} from "@/simulation/lab/lab-game-pool";
import type { LabGameWorkerData } from "@/simulation/lab/lab-game-worker-protocol";
import {
  applyHarnessRecord,
  finishLabGamesRun,
  prepareLabGamesRun,
  throwIfInterrupted,
  type RunLabGamesOptions,
} from "@/simulation/lab/run-lab-games";
import type { LabReport } from "@/simulation/lab/types";

export async function runLabGamesAsync(
  options: RunLabGamesOptions,
): Promise<LabReport> {
  const jobs = options.jobs ?? LAB_DEFAULT_JOBS;
  const timeoutMs = options.timeoutMs ?? 0;
  const chunkSize =
    timeoutMs > 0 ? 1 : (options.chunkSize ?? LAB_DEFAULT_CHUNK_SIZE);
  const state = prepareLabGamesRun({ ...options, chunkSize, jobs, timeoutMs });
  const remaining = remainingGameIndexes(options.games, state.completed);
  throwIfInterrupted(state);
  if (remaining.length === 0) {
    return finishLabGamesRun(state);
  }

  const init: LabGameWorkerData = {
    seed: options.seed,
    games: options.games,
    scenarioId: state.session.scenarioId,
    rotation: state.session.rotation,
    rosterSize: options.rosterSize,
    seedList: state.session.seedList,
    warmupIndexes:
      state.session.rotation === "on"
        ? [...state.completed].sort((a, b) => a - b)
        : [],
  };

  const createWorker: LabWorkerFactory =
    options.createWorker ??
    (options.useWorkers === false
      ? state.session.rotation === "on"
        ? createInProcessSharedWorker
        : createInProcessIndependentWorker
      : createThreadWorker);

  await runHarnessPool({
    init,
    indexes: remaining,
    jobs,
    chunkSize,
    timeoutMs,
    signal: options.signal,
    createWorker,
    onRecord: (record) => {
      applyHarnessRecord(state, record);
    },
    runId: state.runId,
    checkpointPath: state.checkpointPath,
    completedGameIndexes: () => [...state.completed],
  });

  return finishLabGamesRun(state);
}
