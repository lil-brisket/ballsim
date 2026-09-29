/**
 * CLI: BallSim Simulation Lab
 *
 * Usage:
 *   npm run sim -- --seed=42 --games=100 --format json
 *   npm run sim -- --seed=42 --scenario=superteam --rotation=off --channel=pr
 */

import { writeFileSync } from "node:fs";
import {
  formatLabReport,
  labExitCode,
  runLabGames,
  runLabSeason,
  type LabReport,
  type SimChannel,
} from "@/simulation/lab";
import { isLabScenarioId } from "@/simulation/lab/scenarios";
import type { LabRotationMode } from "@/simulation/lab/types";

type ParsedArgs = {
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
};

function parseArgs(argv: string[]): ParsedArgs {
  let seed: number | string = 42;
  let games = 100;
  let scenario = "normal";
  let rotation: LabRotationMode = "on";
  let format: "json" | "text" = "text";
  let out: string | undefined;
  let quiet = false;
  let channel: SimChannel = "pr";
  let mode: "game" | "owner-career" = "game";
  let seasons = 1;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const next = argv[index + 1];
    const [flag, inline] = arg.includes("=")
      ? arg.split("=", 2)
      : [arg, undefined];
    const value = inline ?? next;
    const consume = inline == null && next != null;

    if (flag === "--help" || flag === "-h") {
      console.log(
        "Usage: npm run sim -- [--seed S] [--games N] [--scenario ID] [--rotation on|off] [--format json|text] [--out path] [--quiet] [--channel pr|nightly] [--mode game|owner-career] [--seasons N]",
      );
      process.exit(0);
    }

    if (flag === "--seed") {
      if (value == null) throw new Error("--seed requires a value");
      const asNumber = Number(value);
      seed =
        Number.isFinite(asNumber) && value.trim() !== "" ? asNumber : value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--games") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("--games requires a positive integer");
      }
      games = parsed;
      if (consume && inline == null) index += 1;
    } else if (flag === "--scenario") {
      if (value == null) throw new Error("--scenario requires a value");
      scenario = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--rotation") {
      if (value !== "on" && value !== "off") {
        throw new Error("--rotation must be on or off");
      }
      rotation = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--format") {
      if (value !== "json" && value !== "text") {
        throw new Error("--format must be json or text");
      }
      format = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--out") {
      if (value == null) throw new Error("--out requires a path");
      out = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--quiet") {
      quiet = true;
    } else if (flag === "--channel") {
      if (value !== "pr" && value !== "nightly") {
        throw new Error("--channel must be pr or nightly");
      }
      channel = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--mode") {
      if (value !== "game" && value !== "owner-career") {
        throw new Error("--mode must be game or owner-career");
      }
      mode = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--seasons") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("--seasons requires a positive integer");
      }
      seasons = parsed;
      if (consume && inline == null) index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (
    mode === "game" &&
    !isLabScenarioId(scenario) &&
    scenario !== "owner-career"
  ) {
    throw new Error(`Unknown scenario: ${scenario}`);
  }

  return {
    seed,
    games,
    scenario,
    rotation,
    format,
    out,
    quiet,
    channel,
    mode,
    seasons,
  };
}

function printReport(report: LabReport, options: ParsedArgs): void {
  const text = formatLabReport(report, {
    json: options.format === "json",
    quiet: options.quiet && options.format !== "json",
  });
  if (options.out) {
    writeFileSync(options.out, text, "utf8");
  }
  process.stdout.write(text);
  process.exitCode = labExitCode(report, options.channel);
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  if (options.mode === "owner-career") {
    if (typeof options.seed !== "number") {
      throw new Error("owner-career mode requires a numeric --seed");
    }
    const { report } = runLabSeason({
      seed: options.seed,
      seasons: options.seasons,
    });
    printReport(report, options);
    return;
  }
  const report = runLabGames({
    seed: options.seed,
    games: options.games,
    scenarioId: options.scenario,
    rotation: options.rotation,
  });
  printReport(report, options);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Simulation Lab failed: ${message}`);
  process.exitCode = 1;
}
