import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readEngineIdentity } from "@/simulation/lab/engine-identity";
import { ENGINE_VERSION } from "@/simulation/lab/engine-version";
import {
  readGitIdentity,
  type GitIdentity,
} from "@/simulation/lab/git-identity";
import type { LabSeedListEntry } from "@/simulation/lab/lab-seeds";
import { assertLabRunId, createLabRunId } from "@/simulation/lab/run-id";
import { compareScenarioVersions } from "@/simulation/lab/scenario-version";
import type {
  EngineIdentity,
  LabRotationMode,
  SimChannel,
} from "@/simulation/lab/types";
import type { LabLeaguePreset } from "@/simulation/lab/lab-league-preset";

export const DEFAULT_LAB_RESULTS_ROOT = "results";
export const LAB_MANIFEST_FILENAME = "manifest.json";

export type LabRunMode = "game" | "owner-career" | "schedule";

export type LabResolvedConfig = {
  mode: LabRunMode;
  seed: number | string;
  scenarioId: string;
  games?: number;
  seasons?: number;
  rotation?: LabRotationMode;
  channel?: SimChannel;
  rosterSize?: number;
  preset?: LabLeaguePreset;
  until?: "regular" | "playoffs";
  maxDays?: number;
  usesLabPresetSettings?: boolean;
  jobs?: number;
  chunkSize?: number;
  timeoutMs?: number;
  sampler?: "grid" | "lhs" | "sobol";
  samples?: number;
};

export type LabRunManifest = {
  runId: string;
  startedAt: string;
  gitSha: string | null;
  dirty: boolean;
  nodeVersion: string;
  engineVersion: number;
  scenarioName: string;
  scenarioVersion: number;
  config: LabResolvedConfig;
  seedList: LabSeedListEntry[];
  engineIdentity: EngineIdentity;
};

export type ManifestHost = {
  now?: () => Date;
  readGit?: () => GitIdentity;
  nodeVersion?: string;
  mkdir?: (dir: string) => void;
  writeFile?: (filePath: string, contents: string) => void;
  appendFile?: (filePath: string, contents: string) => void;
  readFile?: (filePath: string) => string;
  exists?: (filePath: string) => boolean;
  rename?: (from: string, to: string) => void;
  unlink?: (filePath: string) => void;
  readdir?: (dir: string) => string[];
  rm?: (target: string) => void;
};

export type LabPersistOptions = {
  persist?: boolean;
  resultsRoot?: string;
  runId?: string;
  host?: ManifestHost;
  keep?: number;
};

export type BuildLabRunManifestInput = {
  scenarioName: string;
  scenarioVersion: number;
  config: LabResolvedConfig;
  seedList: LabSeedListEntry[];
  runId?: string;
  host?: ManifestHost;
};

export function compareEngineVersions(left: number, right: number): void {
  if (left !== right) {
    throw new Error(
      `Cannot compare Lab runs: engineVersion ${left} !== ${right}. Re-run both on the same engineVersion.`,
    );
  }
}

export function compareLabManifests(
  left: LabRunManifest,
  right: LabRunManifest,
): void {
  compareEngineVersions(left.engineVersion, right.engineVersion);
  if (left.scenarioName === right.scenarioName) {
    compareScenarioVersions(left.scenarioVersion, right.scenarioVersion);
  }
}

export function engineVersionFromPayload(payload: unknown): number {
  if (payload == null || typeof payload !== "object") {
    throw new Error("Lab compare payload must be an object.");
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.engineVersion === "number") {
    return record.engineVersion;
  }
  const identity = record.engineIdentity;
  if (
    identity != null &&
    typeof identity === "object" &&
    typeof (identity as { engineVersion?: unknown }).engineVersion === "number"
  ) {
    return (identity as { engineVersion: number }).engineVersion;
  }
  throw new Error("Lab compare payload is missing engineVersion.");
}

export function compareLabPayloads(left: unknown, right: unknown): void {
  compareEngineVersions(
    engineVersionFromPayload(left),
    engineVersionFromPayload(right),
  );
}

export function loadLabManifest(filePath: string): LabRunManifest {
  const raw = readFileSync(filePath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (parsed == null || typeof parsed !== "object") {
    throw new Error(`Invalid Lab manifest: ${filePath}`);
  }
  const manifest = parsed as LabRunManifest;
  if (typeof manifest.engineVersion !== "number") {
    throw new Error(`Lab manifest missing engineVersion: ${filePath}`);
  }
  return manifest;
}

export function buildLabRunManifest(
  input: BuildLabRunManifestInput,
): LabRunManifest {
  const host = input.host ?? {};
  const now = host.now?.() ?? new Date();
  const git = host.readGit?.() ?? readGitIdentity();
  const runId = assertLabRunId(input.runId ?? createLabRunId(now));
  const engineIdentity = readEngineIdentity();
  return {
    runId,
    startedAt: now.toISOString(),
    gitSha: git.sha,
    dirty: git.dirty,
    nodeVersion: host.nodeVersion ?? process.version,
    engineVersion: ENGINE_VERSION,
    scenarioName: input.scenarioName,
    scenarioVersion: input.scenarioVersion,
    config: input.config,
    seedList: input.seedList,
    engineIdentity,
  };
}

export function writeLabManifest(
  manifest: LabRunManifest,
  resultsRoot: string,
  host?: ManifestHost,
): string {
  const dir = join(resultsRoot, manifest.runId);
  const filePath = join(dir, LAB_MANIFEST_FILENAME);
  const mkdir =
    host?.mkdir ?? ((target: string) => mkdirSync(target, { recursive: true }));
  const writeFile =
    host?.writeFile ??
    ((target: string, contents: string) => {
      writeFileSync(target, contents, "utf8");
    });
  mkdir(dir);
  writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`);
  return filePath;
}

export function maybeWriteManifest(
  persistOptions: LabPersistOptions,
  parts: {
    scenarioName: string;
    scenarioVersion: number;
    config: LabResolvedConfig;
    seedList: LabSeedListEntry[];
  },
): { runId?: string; manifest?: LabRunManifest; manifestPath?: string } {
  if (!persistOptions.persist) {
    return {};
  }
  const manifest = buildLabRunManifest({
    ...parts,
    runId: persistOptions.runId,
    host: persistOptions.host,
  });
  const root = persistOptions.resultsRoot ?? DEFAULT_LAB_RESULTS_ROOT;
  const manifestPath = writeLabManifest(manifest, root, persistOptions.host);
  return { runId: manifest.runId, manifest, manifestPath };
}
