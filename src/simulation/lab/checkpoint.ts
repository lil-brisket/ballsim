import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { ENGINE_VERSION } from "@/simulation/lab/engine-version";
import {
  DEFAULT_LAB_RESULTS_ROOT,
  type ManifestHost,
} from "@/simulation/lab/manifest";
import type { LabRotationMode } from "@/simulation/lab/types";

export const LAB_CHECKPOINT_FILENAME = "checkpoint.json";

export type LabRunCheckpoint = {
  runId: string;
  gamesTotal: number;
  completedGameIndexes: number[];
  updatedAt: string;
  engineVersion: number;
  seed: number | string;
  scenarioId: string;
  rotation: LabRotationMode;
};

export function labCheckpointPath(resultsRoot: string, runId: string): string {
  return join(resultsRoot, runId, LAB_CHECKPOINT_FILENAME);
}

export function writeLabCheckpoint(input: {
  checkpoint: LabRunCheckpoint;
  resultsRoot?: string;
  host?: ManifestHost;
}): string {
  const resultsRoot = input.resultsRoot ?? DEFAULT_LAB_RESULTS_ROOT;
  const dir = join(resultsRoot, input.checkpoint.runId);
  const filePath = labCheckpointPath(resultsRoot, input.checkpoint.runId);
  const tmpPath = `${filePath}.tmp`;
  const mkdir =
    input.host?.mkdir ??
    ((target: string) => mkdirSync(target, { recursive: true }));
  const writeFile =
    input.host?.writeFile ??
    ((target: string, contents: string) => {
      writeFileSync(target, contents, "utf8");
    });
  const rename =
    input.host?.rename ??
    ((from: string, to: string) => {
      renameSync(from, to);
    });
  mkdir(dir);
  writeFile(tmpPath, `${JSON.stringify(input.checkpoint, null, 2)}\n`);
  const exists = input.host?.exists ?? ((target: string) => existsSync(target));
  if (exists(filePath)) {
    const unlink =
      input.host?.unlink ??
      ((target: string) => {
        unlinkSync(target);
      });
    unlink(filePath);
  }
  rename(tmpPath, filePath);
  return filePath;
}

export function loadLabCheckpoint(
  filePath: string,
  host?: ManifestHost,
): LabRunCheckpoint {
  const exists = host?.exists ?? ((target: string) => existsSync(target));
  if (!exists(filePath)) {
    throw new Error(`Lab checkpoint not found: ${filePath}`);
  }
  const readFile =
    host?.readFile ?? ((target: string) => readFileSync(target, "utf8"));
  const parsed: unknown = JSON.parse(readFile(filePath));
  if (parsed == null || typeof parsed !== "object") {
    throw new Error(`Invalid Lab checkpoint: ${filePath}`);
  }
  const checkpoint = parsed as LabRunCheckpoint;
  if (!Array.isArray(checkpoint.completedGameIndexes)) {
    throw new Error(`Lab checkpoint missing completedGameIndexes: ${filePath}`);
  }
  return checkpoint;
}

export function assertCheckpointMatches(input: {
  checkpoint: LabRunCheckpoint;
  runId: string;
  games: number;
  seed: number | string;
  scenarioId: string;
  rotation: LabRotationMode;
}): void {
  if (input.checkpoint.runId !== input.runId) {
    throw new Error(
      `Lab checkpoint runId ${input.checkpoint.runId} !== ${input.runId}.`,
    );
  }
  if (input.checkpoint.gamesTotal !== input.games) {
    throw new Error(
      `Lab checkpoint gamesTotal ${input.checkpoint.gamesTotal} !== ${input.games}.`,
    );
  }
  if (input.checkpoint.seed !== input.seed) {
    throw new Error("Lab checkpoint seed does not match this run.");
  }
  if (input.checkpoint.scenarioId !== input.scenarioId) {
    throw new Error("Lab checkpoint scenarioId does not match this run.");
  }
  if (input.checkpoint.rotation !== input.rotation) {
    throw new Error("Lab checkpoint rotation does not match this run.");
  }
  if (input.checkpoint.engineVersion !== ENGINE_VERSION) {
    throw new Error(
      `Lab checkpoint engineVersion ${input.checkpoint.engineVersion} !== ${ENGINE_VERSION}.`,
    );
  }
}

export function completedIndexSet(
  checkpoint: LabRunCheckpoint | null,
): Set<number> {
  if (checkpoint == null) {
    return new Set();
  }
  return new Set(checkpoint.completedGameIndexes);
}
