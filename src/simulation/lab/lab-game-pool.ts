import { Worker } from "node:worker_threads";
import { createLabGameSession } from "@/simulation/lab/lab-game-session";
import type { LabGameSessionOptions } from "@/simulation/lab/lab-game-session";
import { chunkIndexes } from "@/simulation/lab/chunk-indexes";
import { LabRunInterruptedError } from "@/simulation/lab/interrupted-error";
import {
  harnessLabGame,
  type LabGameHarnessRecord,
} from "@/simulation/lab/lab-game-harness";
import type { LabGameWorkerData } from "@/simulation/lab/lab-game-worker-protocol";

export type LabWorkerHandle = {
  play(indexes: number[]): Promise<LabGameHarnessRecord[]>;
  terminate(): void;
};

export type LabWorkerFactory = (init: LabGameWorkerData) => LabWorkerHandle;

export function createInProcessSharedWorker(
  init: LabGameWorkerData,
): LabWorkerHandle {
  const session = createLabGameSession(init);
  for (const gameIndex of init.warmupIndexes ?? []) {
    harnessLabGame(session, gameIndex);
  }
  return {
    play(indexes: number[]) {
      return Promise.resolve(
        indexes.map((gameIndex) => harnessLabGame(session, gameIndex)),
      );
    },
    terminate() {},
  };
}

export function createInProcessIndependentWorker(
  init: LabGameWorkerData,
): LabWorkerHandle {
  const base: LabGameSessionOptions = {
    seed: init.seed,
    games: init.games,
    scenarioId: init.scenarioId,
    rotation: init.rotation,
    rosterSize: init.rosterSize,
    seedList: init.seedList,
  };
  return {
    play(indexes: number[]) {
      return Promise.resolve(
        indexes.map((gameIndex) => {
          const session = createLabGameSession(base);
          return harnessLabGame(session, gameIndex);
        }),
      );
    },
    terminate() {},
  };
}

export function createThreadWorker(init: LabGameWorkerData): LabWorkerHandle {
  const worker = new Worker(new URL("./lab-game-worker.ts", import.meta.url), {
    workerData: init,
    execArgv: ["--import", "tsx"],
  });
  let pending:
    | {
        resolve: (records: LabGameHarnessRecord[]) => void;
        reject: (error: Error) => void;
      }
    | undefined;
  worker.on(
    "message",
    (message: { type?: string; records?: LabGameHarnessRecord[] }) => {
      if (
        message.type === "played" &&
        message.records != null &&
        pending != null
      ) {
        pending.resolve(message.records);
        pending = undefined;
      }
    },
  );
  worker.on("error", (error) => {
    pending?.reject(error instanceof Error ? error : new Error(String(error)));
    pending = undefined;
  });
  worker.on("exit", (code) => {
    if (pending != null) {
      pending.reject(new Error(`Lab game worker exited with code ${code}.`));
      pending = undefined;
    }
  });
  return {
    play(indexes: number[]) {
      if (pending != null) {
        return Promise.reject(new Error("Lab game worker is busy."));
      }
      return new Promise((resolve, reject) => {
        pending = { resolve, reject };
        worker.postMessage({ type: "play", indexes });
      });
    },
    terminate() {
      pending?.reject(new Error("Lab game worker terminated."));
      pending = undefined;
      void worker.terminate();
    },
  };
}

export async function runHarnessPool(input: {
  init: LabGameWorkerData;
  indexes: readonly number[];
  jobs: number;
  chunkSize: number;
  timeoutMs: number;
  signal?: AbortSignal;
  createWorker: LabWorkerFactory;
  onRecord: (record: LabGameHarnessRecord) => void;
  runId?: string;
  checkpointPath?: string;
  completedGameIndexes: () => readonly number[];
}): Promise<void> {
  const jobs = Math.min(input.jobs, Math.max(1, input.indexes.length));
  const workers: LabWorkerHandle[] = [];
  for (let count = 0; count < jobs; count += 1) {
    workers.push(input.createWorker(input.init));
  }
  const chunks = chunkIndexes(input.indexes, input.chunkSize);
  let nextChunk = 0;
  const throwIfAborted = (): void => {
    if (input.signal?.aborted) {
      throw new LabRunInterruptedError({
        reason: "aborted",
        runId: input.runId,
        checkpointPath: input.checkpointPath,
        completedGameIndexes: input.completedGameIndexes(),
      });
    }
  };

  try {
    throwIfAborted();
    const runWorker = async (worker: LabWorkerHandle): Promise<void> => {
      while (nextChunk < chunks.length) {
        throwIfAborted();
        const chunk = chunks[nextChunk]!;
        nextChunk += 1;
        const records = await playChunkWithTimeout(
          worker,
          chunk,
          input.timeoutMs,
          () =>
            new LabRunInterruptedError({
              reason: "timeout",
              runId: input.runId,
              checkpointPath: input.checkpointPath,
              completedGameIndexes: input.completedGameIndexes(),
              timedOutGameIndex: chunk[0],
            }),
        );
        for (const record of records) {
          input.onRecord(record);
        }
      }
    };
    await Promise.all(workers.map((worker) => runWorker(worker)));
  } finally {
    for (const worker of workers) {
      worker.terminate();
    }
  }
}

function playChunkWithTimeout(
  worker: LabWorkerHandle,
  chunk: number[],
  timeoutMs: number,
  timeoutError: () => LabRunInterruptedError,
): Promise<LabGameHarnessRecord[]> {
  const played = worker.play(chunk);
  if (timeoutMs === 0) {
    return played;
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.terminate();
      reject(timeoutError());
    }, timeoutMs);
    played.then(
      (records) => {
        clearTimeout(timer);
        resolve(records);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
