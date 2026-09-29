import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { type LabRunMode, type ManifestHost } from "@/simulation/lab/manifest";

export const LAB_INDEX_FILENAME = "index.json";

export type LabIndexEntry = {
  runId: string;
  startedAt: string;
  engineVersion: number;
  scenarioName: string;
  scenarioVersion: number;
  mode: LabRunMode;
  seed: number | string;
  manifestPath: string;
  games?: number;
  seasons?: number;
};

export type LabRunIndex = {
  runs: LabIndexEntry[];
};

export function labIndexPath(resultsRoot: string): string {
  return join(resultsRoot, LAB_INDEX_FILENAME);
}

export function loadLabRunIndex(
  resultsRoot: string,
  host?: ManifestHost,
): LabRunIndex {
  const filePath = labIndexPath(resultsRoot);
  const exists =
    host?.exists?.(filePath) ?? existsSync(filePath);
  if (!exists) {
    return { runs: [] };
  }
  const raw = host?.readFile?.(filePath) ?? readFileSync(filePath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (parsed == null || typeof parsed !== "object") {
    throw new Error(`Invalid Lab run index: ${filePath}`);
  }
  const runs = (parsed as { runs?: unknown }).runs;
  if (!Array.isArray(runs)) {
    throw new Error(`Lab run index missing runs array: ${filePath}`);
  }
  return { runs: runs as LabIndexEntry[] };
}

export function appendLabIndexEntry(input: {
  resultsRoot: string;
  entry: LabIndexEntry;
  host?: ManifestHost;
}): string {
  const resultsRoot = input.resultsRoot;
  const filePath = labIndexPath(resultsRoot);
  const mkdir =
    input.host?.mkdir ??
    ((target: string) => mkdirSync(target, { recursive: true }));
  const writeFile =
    input.host?.writeFile ??
    ((target: string, contents: string) => {
      writeFileSync(target, contents, "utf8");
    });
  mkdir(resultsRoot);
  const index = loadLabRunIndex(resultsRoot, input.host);
  const without = index.runs.filter((row) => row.runId !== input.entry.runId);
  without.push(input.entry);
  writeFile(filePath, `${JSON.stringify({ runs: without }, null, 2)}\n`);
  return filePath;
}

export function indexEntryFromManifest(input: {
  runId: string;
  startedAt: string;
  engineVersion: number;
  scenarioName: string;
  scenarioVersion: number;
  mode: LabRunMode;
  seed: number | string;
  manifestPath: string;
  games?: number;
  seasons?: number;
}): LabIndexEntry {
  return {
    runId: input.runId,
    startedAt: input.startedAt,
    engineVersion: input.engineVersion,
    scenarioName: input.scenarioName,
    scenarioVersion: input.scenarioVersion,
    mode: input.mode,
    seed: input.seed,
    manifestPath: input.manifestPath,
    ...(input.games != null ? { games: input.games } : {}),
    ...(input.seasons != null ? { seasons: input.seasons } : {}),
  };
}
