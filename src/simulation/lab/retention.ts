import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  LAB_MANIFEST_FILENAME,
  type ManifestHost,
} from "@/simulation/lab/manifest";
import {
  labIndexPath,
  loadLabRunIndex,
  LAB_INDEX_FILENAME,
  type LabIndexEntry,
} from "@/simulation/lab/run-index";

export function assertLabKeep(keep: number): number {
  if (!Number.isInteger(keep) || keep < 1) {
    throw new Error("Lab --keep must be a positive integer.");
  }
  return keep;
}

export function pruneLabRuns(input: {
  resultsRoot: string;
  keep: number;
  protectRunId?: string;
  host?: ManifestHost;
}): { removed: string[] } {
  const keep = assertLabKeep(input.keep);
  const catalog = catalogLabRuns(input.resultsRoot, input.host);
  const sorted = [...catalog].sort((left, right) => {
    const byTime = left.startedAt.localeCompare(right.startedAt);
    if (byTime !== 0) {
      return byTime;
    }
    return left.runId.localeCompare(right.runId);
  });
  const removable = sorted.filter((row) => row.runId !== input.protectRunId);
  const excess = Math.max(0, sorted.length - keep);
  const toRemove = removable.slice(0, excess);
  const rm =
    input.host?.rm ??
    ((target: string) => {
      rmSync(target, { recursive: true, force: true });
    });
  const removed: string[] = [];
  for (const row of toRemove) {
    rm(join(input.resultsRoot, row.runId));
    removed.push(row.runId);
  }
  if (removed.length > 0) {
    const remaining = catalog.filter((row) => !removed.includes(row.runId));
    const writeFile =
      input.host?.writeFile ??
      ((target: string, contents: string) => {
        writeFileSync(target, contents, "utf8");
      });
    writeFile(
      labIndexPath(input.resultsRoot),
      `${JSON.stringify({ runs: remaining }, null, 2)}\n`,
    );
  }
  return { removed };
}

function catalogLabRuns(
  resultsRoot: string,
  host?: ManifestHost,
): LabIndexEntry[] {
  const byId = new Map<string, LabIndexEntry>();
  const exists = host?.exists ?? ((filePath: string) => existsSync(filePath));
  const readFile =
    host?.readFile ?? ((filePath: string) => readFileSync(filePath, "utf8"));
  for (const entry of loadLabRunIndex(resultsRoot, host).runs) {
    const manifestPath = join(resultsRoot, entry.runId, LAB_MANIFEST_FILENAME);
    if (exists(manifestPath)) {
      byId.set(entry.runId, entry);
    }
  }
  const names =
    host?.readdir?.(resultsRoot) ??
    (existsSync(resultsRoot) ? readdirSync(resultsRoot) : []);
  for (const name of names) {
    if (name === LAB_INDEX_FILENAME) {
      continue;
    }
    const manifestPath = join(resultsRoot, name, LAB_MANIFEST_FILENAME);
    if (!exists(manifestPath)) {
      continue;
    }
    if (byId.has(name)) {
      continue;
    }
    const parsed: unknown = JSON.parse(readFile(manifestPath));
    if (parsed == null || typeof parsed !== "object") {
      continue;
    }
    const manifest = parsed as {
      runId?: unknown;
      startedAt?: unknown;
      engineVersion?: unknown;
      scenarioName?: unknown;
      scenarioVersion?: unknown;
      config?: {
        mode?: unknown;
        seed?: unknown;
        games?: unknown;
        seasons?: unknown;
      };
    };
    if (typeof manifest.runId !== "string") {
      continue;
    }
    byId.set(manifest.runId, {
      runId: manifest.runId,
      startedAt:
        typeof manifest.startedAt === "string"
          ? manifest.startedAt
          : "1970-01-01T00:00:00.000Z",
      engineVersion:
        typeof manifest.engineVersion === "number" ? manifest.engineVersion : 0,
      scenarioName:
        typeof manifest.scenarioName === "string"
          ? manifest.scenarioName
          : name,
      scenarioVersion:
        typeof manifest.scenarioVersion === "number"
          ? manifest.scenarioVersion
          : 0,
      mode:
        manifest.config?.mode === "owner-career" ||
        manifest.config?.mode === "schedule"
          ? manifest.config.mode
          : "game",
      seed: (manifest.config?.seed as number | string | undefined) ?? 0,
      manifestPath,
      ...(typeof manifest.config?.games === "number"
        ? { games: manifest.config.games }
        : {}),
      ...(typeof manifest.config?.seasons === "number"
        ? { seasons: manifest.config.seasons }
        : {}),
    });
  }
  return [...byId.values()];
}
