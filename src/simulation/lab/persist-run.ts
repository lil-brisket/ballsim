import {
  DEFAULT_LAB_RESULTS_ROOT,
  maybeWriteManifest,
  type LabPersistOptions,
  type LabResolvedConfig,
  type LabRunManifest,
} from "@/simulation/lab/manifest";
import type { LabSeedListEntry } from "@/simulation/lab/lab-seeds";
import {
  appendLabIndexEntry,
  indexEntryFromManifest,
} from "@/simulation/lab/run-index";
import { pruneLabRuns } from "@/simulation/lab/retention";

export function persistLabRun(
  persistOptions: LabPersistOptions,
  parts: {
    scenarioName: string;
    scenarioVersion: number;
    config: LabResolvedConfig;
    seedList: LabSeedListEntry[];
  },
): { runId?: string; manifest?: LabRunManifest; manifestPath?: string } {
  const persisted = maybeWriteManifest(persistOptions, parts);
  if (persisted.manifest == null || persisted.manifestPath == null) {
    return persisted;
  }
  const resultsRoot = persistOptions.resultsRoot ?? DEFAULT_LAB_RESULTS_ROOT;
  appendLabIndexEntry({
    resultsRoot,
    host: persistOptions.host,
    entry: indexEntryFromManifest({
      runId: persisted.manifest.runId,
      startedAt: persisted.manifest.startedAt,
      engineVersion: persisted.manifest.engineVersion,
      scenarioName: persisted.manifest.scenarioName,
      scenarioVersion: persisted.manifest.scenarioVersion,
      mode: persisted.manifest.config.mode,
      seed: persisted.manifest.config.seed,
      manifestPath: persisted.manifestPath,
      games: persisted.manifest.config.games,
      seasons: persisted.manifest.config.seasons,
    }),
  });
  if (persistOptions.keep != null) {
    pruneLabRuns({
      resultsRoot,
      keep: persistOptions.keep,
      protectRunId: persisted.manifest.runId,
      host: persistOptions.host,
    });
  }
  return persisted;
}
