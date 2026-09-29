import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  LabRunInterruptedError,
  loadLabCheckpoint,
  runLabGames,
  runLabGamesAsync,
} from "@/simulation/lab";
import type { LabGameHarnessRecord } from "@/simulation/lab/lab-game-harness";
import type { LabWorkerHandle } from "@/simulation/lab/lab-game-pool";

describe("Lab scale: checkpoint, jobs, timeout", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function tempResults(): string {
    const dir = mkdtempSync(join(tmpdir(), "lab-scale-"));
    dirs.push(dir);
    return dir;
  }

  function emptyRecord(gameIndex: number): LabGameHarnessRecord {
    return {
      gameIndex,
      gameSeed: gameIndex,
      snapshot: null,
      playerStats: [],
      rawFailures: [],
      events: [],
      overtimePeriodCount: null,
    };
  }

  it("survives an abort and resumes the remaining games", () => {
    const resultsRoot = tempResults();
    const abort = new AbortController();
    let played = 0;
    expect(() =>
      runLabGames({
        seed: 9,
        games: 6,
        rotation: "off",
        persist: true,
        resultsRoot,
        runId: "phase4-resume",
        signal: abort.signal,
        harnessGame: (gameIndex) => {
          played += 1;
          if (played >= 2) {
            abort.abort();
          }
          return emptyRecord(gameIndex);
        },
      }),
    ).toThrow(LabRunInterruptedError);
    const checkpoint = loadLabCheckpoint(
      join(resultsRoot, "phase4-resume", "checkpoint.json"),
    );
    expect(checkpoint.completedGameIndexes).toEqual([0, 1]);
    const resumed = runLabGames({
      seed: 9,
      games: 6,
      rotation: "off",
      persist: true,
      resultsRoot,
      runId: "phase4-resume",
      resume: true,
      harnessGame: (gameIndex) => emptyRecord(gameIndex),
    });
    expect(resumed.checkpointPath).toContain("checkpoint.json");
    const finished = loadLabCheckpoint(
      join(resultsRoot, "phase4-resume", "checkpoint.json"),
    );
    expect(finished.completedGameIndexes).toEqual([0, 1, 2, 3, 4, 5]);
    expect(resumed.gamesSimulated).toBe(6);
  });

  it("matches sequential checksum when jobs=2 on independent games", async () => {
    const sequential = runLabGames({
      seed: 42,
      games: 4,
      rotation: "off",
      persist: false,
    });
    const parallel = await runLabGamesAsync({
      seed: 42,
      games: 4,
      rotation: "off",
      persist: false,
      jobs: 2,
      useWorkers: false,
    });
    expect(parallel.checksum).toBe(sequential.checksum);
    expect(parallel.aggregates!.gameTotals.mean).toBe(
      sequential.aggregates!.gameTotals.mean,
    );
  });

  it("times out a hung worker and leaves a resume checkpoint", async () => {
    const resultsRoot = tempResults();
    const hanging: LabWorkerHandle = {
      play() {
        return new Promise(() => {});
      },
      terminate() {},
    };
    await expect(
      runLabGamesAsync({
        seed: 3,
        games: 2,
        rotation: "off",
        persist: true,
        resultsRoot,
        runId: "phase4-timeout",
        jobs: 1,
        timeoutMs: 25,
        createWorker: () => hanging,
      }),
    ).rejects.toBeInstanceOf(LabRunInterruptedError);
  });
});
