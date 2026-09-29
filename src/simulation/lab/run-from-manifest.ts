import { ENGINE_VERSION } from "@/simulation/lab/engine-version";
import { settingsForLabPreset } from "@/simulation/lab/lab-league-preset";
import {
  compareEngineVersions,
  type LabPersistOptions,
  type LabRunManifest,
} from "@/simulation/lab/manifest";
import {
  runLabGames,
  type RunLabGamesOptions,
} from "@/simulation/lab/run-lab-games";
import {
  runLabSchedule,
  type LabScheduleResult,
} from "@/simulation/lab/run-lab-schedule";
import {
  runLabSeason,
  type LabSeasonResult,
} from "@/simulation/lab/run-lab-season";
import type { LabReport } from "@/simulation/lab/types";

function assertCurrentEngine(manifest: LabRunManifest): void {
  compareEngineVersions(manifest.engineVersion, ENGINE_VERSION);
}

export function runLabGamesFromManifest(
  manifest: LabRunManifest,
  options: LabPersistOptions = {},
): LabReport {
  assertCurrentEngine(manifest);
  if (manifest.config.mode !== "game") {
    throw new Error(
      `runLabGamesFromManifest: manifest mode is ${manifest.config.mode}, expected game.`,
    );
  }
  if (manifest.config.games == null) {
    throw new Error(
      "runLabGamesFromManifest: manifest config.games is required.",
    );
  }
  const runOptions: RunLabGamesOptions = {
    seed: manifest.config.seed,
    games: manifest.config.games,
    scenarioId: manifest.config.scenarioId,
    rotation: manifest.config.rotation,
    rosterSize: manifest.config.rosterSize,
    channel: manifest.config.channel,
    seedList: manifest.seedList,
    persist: options.persist,
    resultsRoot: options.resultsRoot,
    runId: options.runId,
    host: options.host,
  };
  return runLabGames(runOptions);
}

export function runLabSeasonFromManifest(
  manifest: LabRunManifest,
  options: LabPersistOptions = {},
): LabSeasonResult {
  assertCurrentEngine(manifest);
  if (manifest.config.mode !== "owner-career") {
    throw new Error(
      `runLabSeasonFromManifest: manifest mode is ${manifest.config.mode}, expected owner-career.`,
    );
  }
  if (typeof manifest.config.seed !== "number") {
    throw new Error(
      "runLabSeasonFromManifest: owner-career seed must be numeric.",
    );
  }
  if (manifest.config.seasons == null) {
    throw new Error(
      "runLabSeasonFromManifest: manifest config.seasons is required.",
    );
  }
  return runLabSeason({
    seed: manifest.config.seed,
    seasons: manifest.config.seasons,
    preset: manifest.config.preset,
    gameSettings:
      manifest.config.usesLabPresetSettings === true && manifest.config.preset
        ? settingsForLabPreset(manifest.config.preset)
        : undefined,
    persist: options.persist,
    resultsRoot: options.resultsRoot,
    runId: options.runId,
    host: options.host,
  });
}

export function runLabScheduleFromManifest(
  manifest: LabRunManifest,
  options: LabPersistOptions = {},
): LabScheduleResult {
  assertCurrentEngine(manifest);
  if (manifest.config.mode !== "schedule") {
    throw new Error(
      `runLabScheduleFromManifest: manifest mode is ${manifest.config.mode}, expected schedule.`,
    );
  }
  if (typeof manifest.config.seed !== "number") {
    throw new Error(
      "runLabScheduleFromManifest: schedule seed must be numeric.",
    );
  }
  if (manifest.config.preset == null || manifest.config.until == null) {
    throw new Error(
      "runLabScheduleFromManifest: manifest config.preset and until are required.",
    );
  }
  return runLabSchedule({
    seed: manifest.config.seed,
    preset: manifest.config.preset,
    until: manifest.config.until,
    maxDays: manifest.config.maxDays,
    persist: options.persist,
    resultsRoot: options.resultsRoot,
    runId: options.runId,
    host: options.host,
  });
}
