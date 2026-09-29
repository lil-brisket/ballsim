import {
  isLabScenarioId,
  isLabLeaguePreset,
  labExitCode,
  runLabGames,
  runLabSeason,
  runLabSchedule,
  settingsForLabPreset,
  type LabLeaguePreset,
  type LabReport,
  type LabRotationMode,
  type LabScheduleResult,
  type LabScheduleUntil,
  type LongitudinalPoint,
} from "@/simulation/lab";
import {
  LAB_MAX_GAMES,
  LAB_MAX_SCHEDULE_DAYS,
  LAB_MAX_SEASONS_CBL,
  LAB_MAX_SEASONS_STANDARD,
} from "@/simulation/lab/lab-limits";

export {
  LAB_MAX_GAMES,
  LAB_MAX_SCHEDULE_DAYS,
  LAB_MAX_SEASONS_CBL,
  LAB_MAX_SEASONS_STANDARD,
};

export type SimLabFailure = {
  ok: false;
  error: string;
};

export type GameLabSuccess = {
  ok: true;
  wallMs: number;
  channelExitPr: number;
  channelExitNightly: number;
  report: LabReport;
};

export type SeasonLabSuccess = {
  ok: true;
  wallMs: number;
  preset: LabLeaguePreset;
  report: LabReport;
  series: LongitudinalPoint[];
};

export type ScheduleLabSuccess = {
  ok: true;
  result: LabScheduleResult;
};

export type GameLabInput = {
  seed: number;
  games: number;
  scenarioId: string;
  rotation: LabRotationMode;
  persist?: boolean;
};

export type SeasonLabInput = {
  seed: number;
  seasons: number;
  preset: LabLeaguePreset;
  persist?: boolean;
};

export type ScheduleLabInput = {
  seed: number;
  preset: LabLeaguePreset;
  until: LabScheduleUntil;
  maxDays?: number;
  persist?: boolean;
};

function asPositiveInt(value: number, label: string): number | SimLabFailure {
  if (!Number.isInteger(value) || value < 1) {
    return { ok: false, error: `${label} must be a positive integer.` };
  }
  return value;
}

function asFiniteSeed(value: number): number | SimLabFailure {
  if (!Number.isFinite(value)) {
    return { ok: false, error: "Seed must be a finite number." };
  }
  return Math.trunc(value);
}

export function runGameLab(
  input: GameLabInput,
): GameLabSuccess | SimLabFailure {
  const seed = asFiniteSeed(input.seed);
  if (typeof seed !== "number") {
    return seed;
  }
  const games = asPositiveInt(input.games, "Games");
  if (typeof games !== "number") {
    return games;
  }
  if (games > LAB_MAX_GAMES) {
    return {
      ok: false,
      error: `Games is capped at ${LAB_MAX_GAMES} on this page.`,
    };
  }
  if (!isLabScenarioId(input.scenarioId)) {
    return { ok: false, error: `Unknown scenario: ${input.scenarioId}` };
  }
  if (input.rotation !== "on" && input.rotation !== "off") {
    return { ok: false, error: "Rotation must be on or off." };
  }

  const started = performance.now();
  const report = runLabGames({
    seed,
    games,
    scenarioId: input.scenarioId,
    rotation: input.rotation,
    persist: input.persist !== false,
  });
  return {
    ok: true,
    wallMs: performance.now() - started,
    channelExitPr: labExitCode(report, "pr"),
    channelExitNightly: labExitCode(report, "nightly"),
    report,
  };
}

export function runSeasonLab(
  input: SeasonLabInput,
): SeasonLabSuccess | SimLabFailure {
  const seed = asFiniteSeed(input.seed);
  if (typeof seed !== "number") {
    return seed;
  }
  const seasons = asPositiveInt(input.seasons, "Seasons");
  if (typeof seasons !== "number") {
    return seasons;
  }
  if (!isLabLeaguePreset(input.preset)) {
    return { ok: false, error: `Unknown league preset: ${input.preset}` };
  }
  const seasonCap =
    input.preset === "standard"
      ? LAB_MAX_SEASONS_STANDARD
      : LAB_MAX_SEASONS_CBL;
  if (seasons > seasonCap) {
    return {
      ok: false,
      error: `${input.preset === "standard" ? "Standard" : "CBL"} multi-season is capped at ${seasonCap} on this page.`,
    };
  }

  const started = performance.now();
  const { report, series } = runLabSeason({
    seed,
    seasons,
    preset: input.preset,
    gameSettings: settingsForLabPreset(input.preset),
    persist: input.persist !== false,
  });
  return {
    ok: true,
    wallMs: performance.now() - started,
    preset: input.preset,
    report,
    series,
  };
}

export function runScheduleLab(
  input: ScheduleLabInput,
): ScheduleLabSuccess | SimLabFailure {
  const seed = asFiniteSeed(input.seed);
  if (typeof seed !== "number") {
    return seed;
  }
  if (!isLabLeaguePreset(input.preset)) {
    return { ok: false, error: `Unknown league preset: ${input.preset}` };
  }
  if (input.until !== "regular" && input.until !== "playoffs") {
    return { ok: false, error: "Until must be regular or playoffs." };
  }
  const maxDays = input.maxDays ?? LAB_MAX_SCHEDULE_DAYS;
  const parsedDays = asPositiveInt(maxDays, "Max days");
  if (typeof parsedDays !== "number") {
    return parsedDays;
  }
  if (parsedDays > LAB_MAX_SCHEDULE_DAYS) {
    return {
      ok: false,
      error: `Max days is capped at ${LAB_MAX_SCHEDULE_DAYS} on this page.`,
    };
  }

  const result = runLabSchedule({
    seed,
    preset: input.preset,
    until: input.until,
    maxDays: parsedDays,
    persist: input.persist !== false,
  });
  return { ok: true, result };
}
