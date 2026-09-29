import { readFileSync } from "node:fs";
import { isLabScenarioId } from "@/simulation/lab/scenarios";
import {
  isLabSweepSampler,
  type LabSweepSampler,
} from "@/simulation/lab/sweep/space";
import type { LabRotationMode, SimChannel } from "@/simulation/lab/types";
import { assertLabKeep } from "@/simulation/lab/retention";

export type LabFileConfig = {
  seed?: number | string;
  games?: number;
  scenario?: string;
  rotation?: LabRotationMode;
  format?: "json" | "text";
  out?: string;
  quiet?: boolean;
  channel?: SimChannel;
  mode?: "game" | "owner-career";
  seasons?: number;
  persist?: boolean;
  resultsDir?: string;
  runId?: string;
  jobs?: number;
  chunkSize?: number;
  timeoutMs?: number;
  resume?: boolean;
  sweep?: string;
  sampler?: LabSweepSampler;
  samples?: number;
  baseline?: string;
  writeBaseline?: string;
  calibrate?: boolean;
  ksAlpha?: number;
  keep?: number;
};

export type LabCliState = {
  seed: number | string;
  games: number;
  scenario: string;
  rotation: LabRotationMode;
  format: "json" | "text";
  out?: string;
  quiet: boolean;
  channel: SimChannel;
  mode: "game" | "owner-career";
  seasons: number;
  persist: boolean;
  resultsDir?: string;
  runId?: string;
  jobs: number;
  chunkSize?: number;
  timeoutMs: number;
  resume: boolean;
  sweep?: string;
  sampler: LabSweepSampler;
  samples: number;
  baseline?: string;
  writeBaseline?: string;
  calibrate: boolean;
  ksAlpha?: number;
  keep?: number;
  dryRun: boolean;
  listScenarios: boolean;
  help: boolean;
  configPath?: string;
};

export const LAB_CLI_DEFAULTS: LabCliState = {
  seed: 42,
  games: 100,
  scenario: "normal",
  rotation: "on",
  format: "text",
  quiet: false,
  channel: "pr",
  mode: "game",
  seasons: 1,
  persist: true,
  jobs: 1,
  timeoutMs: 0,
  resume: false,
  sampler: "lhs",
  samples: 16,
  calibrate: false,
  dryRun: false,
  listScenarios: false,
  help: false,
};

export const LAB_CLI_USAGE =
  "Usage: npm run sim -- [--config path] [--seed S] [--games N] [--scenario ID] [--rotation on|off] [--format json|text] [--out path] [--quiet] [--channel pr|nightly] [--mode game|owner-career] [--seasons N] [--no-persist] [--results-dir path] [--run-id id] [--jobs N] [--chunk-size N] [--timeout-ms N] [--resume] [--sweep [path]] [--sampler grid|lhs|sobol] [--samples N] [--baseline path] [--write-baseline path] [--calibrate] [--ks-alpha A] [--keep N] [--dry-run] [--list-scenarios]";

const FILE_KEYS = new Set([
  "seed",
  "games",
  "scenario",
  "rotation",
  "format",
  "out",
  "quiet",
  "channel",
  "mode",
  "seasons",
  "persist",
  "resultsDir",
  "runId",
  "jobs",
  "chunkSize",
  "timeoutMs",
  "resume",
  "sweep",
  "sampler",
  "samples",
  "baseline",
  "writeBaseline",
  "calibrate",
  "ksAlpha",
  "keep",
]);

export function parseLabFileConfig(raw: unknown): LabFileConfig {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Lab config file must be a JSON object.");
  }
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!FILE_KEYS.has(key)) {
      throw new Error(`Unknown Lab config key: ${key}`);
    }
  }
  const config: LabFileConfig = {};
  if (record.seed != null) {
    if (typeof record.seed === "number" || typeof record.seed === "string") {
      config.seed = record.seed;
    } else {
      throw new Error("Lab config seed must be a number or string.");
    }
  }
  assignPositiveInt(config, record, "games");
  if (typeof record.scenario === "string") {
    config.scenario = record.scenario;
  } else if (record.scenario != null) {
    throw new Error("Lab config scenario must be a string.");
  }
  if (record.rotation != null) {
    if (record.rotation !== "on" && record.rotation !== "off") {
      throw new Error("Lab config rotation must be on or off.");
    }
    config.rotation = record.rotation;
  }
  if (record.format != null) {
    if (record.format !== "json" && record.format !== "text") {
      throw new Error("Lab config format must be json or text.");
    }
    config.format = record.format;
  }
  if (typeof record.out === "string") {
    config.out = record.out;
  } else if (record.out != null) {
    throw new Error("Lab config out must be a string.");
  }
  if (typeof record.quiet === "boolean") {
    config.quiet = record.quiet;
  } else if (record.quiet != null) {
    throw new Error("Lab config quiet must be a boolean.");
  }
  if (record.channel != null) {
    if (record.channel !== "pr" && record.channel !== "nightly") {
      throw new Error("Lab config channel must be pr or nightly.");
    }
    config.channel = record.channel;
  }
  if (record.mode != null) {
    if (record.mode !== "game" && record.mode !== "owner-career") {
      throw new Error("Lab config mode must be game or owner-career.");
    }
    config.mode = record.mode;
  }
  assignPositiveInt(config, record, "seasons");
  if (typeof record.persist === "boolean") {
    config.persist = record.persist;
  } else if (record.persist != null) {
    throw new Error("Lab config persist must be a boolean.");
  }
  if (typeof record.resultsDir === "string") {
    config.resultsDir = record.resultsDir;
  } else if (record.resultsDir != null) {
    throw new Error("Lab config resultsDir must be a string.");
  }
  if (typeof record.runId === "string") {
    config.runId = record.runId;
  } else if (record.runId != null) {
    throw new Error("Lab config runId must be a string.");
  }
  assignPositiveInt(config, record, "jobs");
  assignPositiveInt(config, record, "chunkSize");
  if (record.timeoutMs != null) {
    if (
      !Number.isInteger(record.timeoutMs) ||
      (record.timeoutMs as number) < 0
    ) {
      throw new Error("Lab config timeoutMs must be a non-negative integer.");
    }
    config.timeoutMs = record.timeoutMs as number;
  }
  if (typeof record.resume === "boolean") {
    config.resume = record.resume;
  } else if (record.resume != null) {
    throw new Error("Lab config resume must be a boolean.");
  }
  if (typeof record.sweep === "string") {
    config.sweep = record.sweep;
  } else if (record.sweep != null) {
    throw new Error("Lab config sweep must be a string.");
  }
  if (record.sampler != null) {
    if (
      typeof record.sampler !== "string" ||
      !isLabSweepSampler(record.sampler)
    ) {
      throw new Error("Lab config sampler must be grid, lhs, or sobol.");
    }
    config.sampler = record.sampler;
  }
  assignPositiveInt(config, record, "samples");
  if (typeof record.baseline === "string") {
    config.baseline = record.baseline;
  } else if (record.baseline != null) {
    throw new Error("Lab config baseline must be a string.");
  }
  if (typeof record.writeBaseline === "string") {
    config.writeBaseline = record.writeBaseline;
  } else if (record.writeBaseline != null) {
    throw new Error("Lab config writeBaseline must be a string.");
  }
  if (typeof record.calibrate === "boolean") {
    config.calibrate = record.calibrate;
  } else if (record.calibrate != null) {
    throw new Error("Lab config calibrate must be a boolean.");
  }
  if (record.ksAlpha != null) {
    if (
      typeof record.ksAlpha !== "number" ||
      !Number.isFinite(record.ksAlpha) ||
      record.ksAlpha <= 0 ||
      record.ksAlpha >= 1
    ) {
      throw new Error("Lab config ksAlpha must be in (0, 1).");
    }
    config.ksAlpha = record.ksAlpha;
  }
  if (record.keep != null) {
    if (typeof record.keep !== "number") {
      throw new Error("Lab config keep must be a positive integer.");
    }
    config.keep = assertLabKeep(record.keep);
  }
  return config;
}

export function loadLabConfigFile(filePath: string): LabFileConfig {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  return parseLabFileConfig(parsed);
}

export function mergeLabConfig(input: {
  file?: LabFileConfig;
  cli: Partial<LabCliState>;
}): LabCliState {
  const file = input.file ?? {};
  const cli = input.cli;
  return {
    seed: cli.seed ?? file.seed ?? LAB_CLI_DEFAULTS.seed,
    games: cli.games ?? file.games ?? LAB_CLI_DEFAULTS.games,
    scenario: cli.scenario ?? file.scenario ?? LAB_CLI_DEFAULTS.scenario,
    rotation: cli.rotation ?? file.rotation ?? LAB_CLI_DEFAULTS.rotation,
    format: cli.format ?? file.format ?? LAB_CLI_DEFAULTS.format,
    out: cli.out ?? file.out,
    quiet: cli.quiet ?? file.quiet ?? LAB_CLI_DEFAULTS.quiet,
    channel: cli.channel ?? file.channel ?? LAB_CLI_DEFAULTS.channel,
    mode: cli.mode ?? file.mode ?? LAB_CLI_DEFAULTS.mode,
    seasons: cli.seasons ?? file.seasons ?? LAB_CLI_DEFAULTS.seasons,
    persist: cli.persist ?? file.persist ?? LAB_CLI_DEFAULTS.persist,
    resultsDir: cli.resultsDir ?? file.resultsDir,
    runId: cli.runId ?? file.runId,
    jobs: cli.jobs ?? file.jobs ?? LAB_CLI_DEFAULTS.jobs,
    chunkSize: cli.chunkSize ?? file.chunkSize,
    timeoutMs: cli.timeoutMs ?? file.timeoutMs ?? LAB_CLI_DEFAULTS.timeoutMs,
    resume: cli.resume ?? file.resume ?? LAB_CLI_DEFAULTS.resume,
    sweep: cli.sweep ?? file.sweep,
    sampler: cli.sampler ?? file.sampler ?? LAB_CLI_DEFAULTS.sampler,
    samples: cli.samples ?? file.samples ?? LAB_CLI_DEFAULTS.samples,
    baseline: cli.baseline ?? file.baseline,
    writeBaseline: cli.writeBaseline ?? file.writeBaseline,
    calibrate: cli.calibrate ?? file.calibrate ?? LAB_CLI_DEFAULTS.calibrate,
    ksAlpha: cli.ksAlpha ?? file.ksAlpha,
    keep: cli.keep ?? file.keep,
    dryRun: cli.dryRun ?? LAB_CLI_DEFAULTS.dryRun,
    listScenarios: cli.listScenarios ?? LAB_CLI_DEFAULTS.listScenarios,
    help: cli.help ?? LAB_CLI_DEFAULTS.help,
    configPath: cli.configPath,
  };
}

export function parseLabArgv(argv: string[]): LabCliState {
  const configPath = findConfigPath(argv);
  const file = configPath != null ? loadLabConfigFile(configPath) : undefined;
  const cli = parseLabCliOverrides(argv);
  const merged = mergeLabConfig({ file, cli: { ...cli, configPath } });
  if (
    merged.mode === "game" &&
    !merged.listScenarios &&
    !merged.help &&
    !isLabScenarioId(merged.scenario) &&
    merged.scenario !== "owner-career"
  ) {
    throw new Error(`Unknown scenario: ${merged.scenario}`);
  }
  return merged;
}

export function parseLabCliOverrides(argv: string[]): Partial<LabCliState> {
  const cli: Partial<LabCliState> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const next = argv[index + 1];
    const [flag, inline] = arg.includes("=")
      ? arg.split("=", 2)
      : [arg, undefined];
    const value = inline ?? next;
    const consume = inline == null && next != null;

    if (flag === "--help" || flag === "-h") {
      cli.help = true;
      continue;
    }
    if (flag === "--config") {
      if (value == null || value.length === 0) {
        throw new Error("--config requires a path");
      }
      if (consume && inline == null) index += 1;
      continue;
    }
    if (flag === "--seed") {
      if (value == null) throw new Error("--seed requires a value");
      const asNumber = Number(value);
      cli.seed =
        Number.isFinite(asNumber) && value.trim() !== "" ? asNumber : value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--games") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("--games requires a positive integer");
      }
      cli.games = parsed;
      if (consume && inline == null) index += 1;
    } else if (flag === "--scenario") {
      if (value == null) throw new Error("--scenario requires a value");
      cli.scenario = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--rotation") {
      if (value !== "on" && value !== "off") {
        throw new Error("--rotation must be on or off");
      }
      cli.rotation = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--format") {
      if (value !== "json" && value !== "text") {
        throw new Error("--format must be json or text");
      }
      cli.format = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--out") {
      if (value == null) throw new Error("--out requires a path");
      cli.out = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--quiet") {
      cli.quiet = true;
    } else if (flag === "--channel") {
      if (value !== "pr" && value !== "nightly") {
        throw new Error("--channel must be pr or nightly");
      }
      cli.channel = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--mode") {
      if (value !== "game" && value !== "owner-career") {
        throw new Error("--mode must be game or owner-career");
      }
      cli.mode = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--seasons") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("--seasons requires a positive integer");
      }
      cli.seasons = parsed;
      if (consume && inline == null) index += 1;
    } else if (flag === "--no-persist") {
      cli.persist = false;
    } else if (flag === "--results-dir") {
      if (value == null) throw new Error("--results-dir requires a path");
      cli.resultsDir = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--run-id") {
      if (value == null) throw new Error("--run-id requires a value");
      cli.runId = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--jobs") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("--jobs requires a positive integer");
      }
      cli.jobs = parsed;
      if (consume && inline == null) index += 1;
    } else if (flag === "--chunk-size") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("--chunk-size requires a positive integer");
      }
      cli.chunkSize = parsed;
      if (consume && inline == null) index += 1;
    } else if (flag === "--timeout-ms") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error("--timeout-ms requires a non-negative integer");
      }
      cli.timeoutMs = parsed;
      if (consume && inline == null) index += 1;
    } else if (flag === "--resume") {
      cli.resume = true;
    } else if (flag === "--sweep") {
      if (inline != null) {
        cli.sweep = inline.length > 0 ? inline : "default";
      } else if (next != null && !next.startsWith("-")) {
        cli.sweep = next;
        index += 1;
      } else {
        cli.sweep = "default";
      }
    } else if (flag === "--sampler") {
      if (value == null || !isLabSweepSampler(value)) {
        throw new Error("--sampler must be grid, lhs, or sobol");
      }
      cli.sampler = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--samples") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("--samples requires a positive integer");
      }
      cli.samples = parsed;
      if (consume && inline == null) index += 1;
    } else if (flag === "--baseline") {
      if (value == null || value.length === 0) {
        throw new Error("--baseline requires a path");
      }
      cli.baseline = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--write-baseline") {
      if (value == null || value.length === 0) {
        throw new Error("--write-baseline requires a path");
      }
      cli.writeBaseline = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--calibrate") {
      cli.calibrate = true;
    } else if (flag === "--ks-alpha") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) {
        throw new Error("--ks-alpha must be in (0, 1)");
      }
      cli.ksAlpha = parsed;
      if (consume && inline == null) index += 1;
    } else if (flag === "--keep") {
      const parsed = Number(value);
      cli.keep = assertLabKeep(parsed);
      if (consume && inline == null) index += 1;
    } else if (flag === "--dry-run") {
      cli.dryRun = true;
    } else if (flag === "--list-scenarios") {
      cli.listScenarios = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return cli;
}

function findConfigPath(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const [flag, inline] = arg.includes("=")
      ? arg.split("=", 2)
      : [arg, undefined];
    if (flag !== "--config") {
      continue;
    }
    const value = inline ?? argv[index + 1];
    if (value == null || value.length === 0) {
      throw new Error("--config requires a path");
    }
    return value;
  }
  return undefined;
}

function assignPositiveInt(
  config: LabFileConfig,
  record: Record<string, unknown>,
  key: "games" | "seasons" | "jobs" | "chunkSize" | "samples",
): void {
  if (record[key] == null) {
    return;
  }
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`Lab config ${key} must be a positive integer.`);
  }
  config[key] = value;
}
