import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameEvent } from "@/domain/entities/game";
import {
  DEFAULT_LAB_RESULTS_ROOT,
  type LabResolvedConfig,
  type ManifestHost,
} from "@/simulation/lab/manifest";
import type { RawInvariantFailure } from "@/simulation/lab/types";

export const LAB_FAILURES_DIRNAME = "failures";

export type LabGameFailureRecord = {
  gameIndex: number;
  seed: number | string;
  config: LabResolvedConfig;
  failures: RawInvariantFailure[];
};

export type LabFailureArtifactPaths = {
  gameIndex: number;
  ndjsonPath: string;
  jsonPath: string;
};

export function failureArtifactsDir(
  resultsRoot: string,
  runId: string,
): string {
  return join(resultsRoot, runId, LAB_FAILURES_DIRNAME);
}

export function writeGameFailureArtifacts(input: {
  runId: string;
  resultsRoot?: string;
  gameIndex: number;
  seed: number | string;
  config: LabResolvedConfig;
  failures: readonly RawInvariantFailure[];
  events: readonly GameEvent[];
  host?: ManifestHost;
}): LabFailureArtifactPaths {
  if (!Number.isInteger(input.gameIndex) || input.gameIndex < 0) {
    throw new Error(
      "writeGameFailureArtifacts: gameIndex must be a non-negative integer.",
    );
  }
  const resultsRoot = input.resultsRoot ?? DEFAULT_LAB_RESULTS_ROOT;
  const dir = failureArtifactsDir(resultsRoot, input.runId);
  const mkdir =
    input.host?.mkdir ??
    ((target: string) => mkdirSync(target, { recursive: true }));
  const writeFile =
    input.host?.writeFile ??
    ((target: string, contents: string) => {
      writeFileSync(target, contents, "utf8");
    });
  mkdir(dir);
  const ndjsonPath = join(dir, `${input.gameIndex}.ndjson`);
  const jsonPath = join(dir, `${input.gameIndex}.json`);
  const ndjson =
    input.events.length === 0
      ? ""
      : `${input.events.map((event) => JSON.stringify(event)).join("\n")}\n`;
  const record: LabGameFailureRecord = {
    gameIndex: input.gameIndex,
    seed: input.seed,
    config: input.config,
    failures: [...input.failures],
  };
  writeFile(ndjsonPath, ndjson);
  writeFile(jsonPath, `${JSON.stringify(record, null, 2)}\n`);
  return { gameIndex: input.gameIndex, ndjsonPath, jsonPath };
}
