import { ENGINE_VERSION } from "@/simulation/lab/engine-version";
import { resolveLabGameConfig } from "@/simulation/lab/lab-game-session";
import {
  buildMasterSeedList,
  type LabSeedListEntry,
} from "@/simulation/lab/lab-seeds";
import {
  DEFAULT_LAB_RESULTS_ROOT,
  type LabRunMode,
} from "@/simulation/lab/manifest";
import { formatReproCommand } from "@/simulation/lab/repro";
import {
  OWNER_CAREER_SCENARIO_ID,
  SCHEDULE_SCENARIO_ID,
  scenarioVersionFor,
} from "@/simulation/lab/scenario-version";
import type { LabLeaguePreset } from "@/simulation/lab/lab-league-preset";
import type { LabRotationMode } from "@/simulation/lab/types";

export const LAB_DRY_RUN_SEED_PREVIEW = 8;

export type LabDryRunPreview = {
  mode: LabRunMode;
  engineVersion: number;
  scenarioId: string;
  scenarioVersion: number;
  seed: number | string;
  persist: boolean;
  resultsRoot: string;
  reproCommand: string;
  seedList: LabSeedListEntry[];
  games?: number;
  seasons?: number;
  rotation?: LabRotationMode;
  keep?: number;
  preset?: LabLeaguePreset;
  until?: "regular" | "playoffs";
  maxDays?: number;
};

export function previewLabGamesRun(input: {
  seed: number | string;
  games: number;
  scenarioId?: string;
  rotation?: LabRotationMode;
  persist?: boolean;
  resultsRoot?: string;
  keep?: number;
}): LabDryRunPreview {
  const resolved = resolveLabGameConfig({
    seed: input.seed,
    games: input.games,
    scenarioId: input.scenarioId,
    rotation: input.rotation,
  });
  return {
    mode: "game",
    engineVersion: ENGINE_VERSION,
    scenarioId: resolved.scenarioId,
    scenarioVersion: scenarioVersionFor(resolved.scenarioId),
    seed: input.seed,
    persist: input.persist !== false,
    resultsRoot: input.resultsRoot ?? DEFAULT_LAB_RESULTS_ROOT,
    reproCommand: formatReproCommand({
      seed: input.seed,
      scenarioId: resolved.scenarioId,
      games: input.games,
      rotation: resolved.rotation,
    }),
    seedList: resolved.seedList,
    games: input.games,
    rotation: resolved.rotation,
    ...(input.keep != null ? { keep: input.keep } : {}),
  };
}

export function previewLabSeasonRun(input: {
  seed: number;
  seasons: number;
  persist?: boolean;
  resultsRoot?: string;
  keep?: number;
  preset?: LabLeaguePreset;
}): LabDryRunPreview {
  return {
    mode: "owner-career",
    engineVersion: ENGINE_VERSION,
    scenarioId: OWNER_CAREER_SCENARIO_ID,
    scenarioVersion: scenarioVersionFor(OWNER_CAREER_SCENARIO_ID),
    seed: input.seed,
    persist: input.persist !== false,
    resultsRoot: input.resultsRoot ?? DEFAULT_LAB_RESULTS_ROOT,
    reproCommand: formatReproCommand({
      seed: input.seed,
      scenarioId: OWNER_CAREER_SCENARIO_ID,
      mode: "owner-career",
      seasons: input.seasons,
    }),
    seedList: buildMasterSeedList(input.seed, OWNER_CAREER_SCENARIO_ID),
    seasons: input.seasons,
    ...(input.preset != null ? { preset: input.preset } : {}),
    ...(input.keep != null ? { keep: input.keep } : {}),
  };
}

export function previewLabScheduleRun(input: {
  seed: number;
  preset: LabLeaguePreset;
  until: "regular" | "playoffs";
  maxDays?: number;
  persist?: boolean;
  resultsRoot?: string;
  keep?: number;
}): LabDryRunPreview {
  return {
    mode: "schedule",
    engineVersion: ENGINE_VERSION,
    scenarioId: SCHEDULE_SCENARIO_ID,
    scenarioVersion: scenarioVersionFor(SCHEDULE_SCENARIO_ID),
    seed: input.seed,
    persist: input.persist !== false,
    resultsRoot: input.resultsRoot ?? DEFAULT_LAB_RESULTS_ROOT,
    reproCommand: `npm run lab (schedule seed=${input.seed} preset=${input.preset} until=${input.until})`,
    seedList: buildMasterSeedList(input.seed, SCHEDULE_SCENARIO_ID),
    preset: input.preset,
    until: input.until,
    ...(input.maxDays != null ? { maxDays: input.maxDays } : {}),
    ...(input.keep != null ? { keep: input.keep } : {}),
  };
}

export function formatDryRunPreview(preview: LabDryRunPreview): string {
  const seedPreview = preview.seedList.slice(0, LAB_DRY_RUN_SEED_PREVIEW);
  const extra = preview.seedList.length - seedPreview.length;
  const lines = [
    "LAB DRY RUN (no simulation)",
    `engineVersion=${preview.engineVersion}`,
    `mode=${preview.mode}`,
    `scenario=${preview.scenarioId} v${preview.scenarioVersion}`,
    `seed=${preview.seed}`,
  ];
  if (preview.games != null) {
    lines.push(`games=${preview.games}`);
  }
  if (preview.seasons != null) {
    lines.push(`seasons=${preview.seasons}`);
  }
  if (preview.rotation != null) {
    lines.push(`rotation=${preview.rotation}`);
  }
  if (preview.preset != null) {
    lines.push(`preset=${preview.preset}`);
  }
  if (preview.until != null) {
    lines.push(`until=${preview.until}`);
  }
  lines.push(
    `persist=${preview.persist}`,
    `resultsRoot=${preview.resultsRoot}`,
    `repro=${preview.reproCommand}`,
  );
  if (preview.keep != null) {
    lines.push(`keep=${preview.keep}`);
  }
  lines.push("seeds:");
  for (const entry of seedPreview) {
    lines.push(`  ${entry.stream}=${entry.seed}`);
  }
  if (extra > 0) {
    lines.push(`  … ${extra} more`);
  }
  return `${lines.join("\n")}\n`;
}
