/**
 * CLI: offseason balance bands. Measures offseason outcomes per season across
 * seeds and checks them against tests/offseason/baselines.json. Not part of
 * `npm test`.
 *
 *   npm run offseason:balance                       # check (4 seeds x 4 seasons)
 *   npm run offseason:balance -- --seed-start 201   # a different seed set
 *   npm run offseason:balance -- --write-baseline   # accept a deliberate change
 *   npm run offseason:balance -- --seasons 20 --seeds 2 --no-check   # inflation watch
 *
 * See docs/testing.md ("Offseason balance bands").
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildBaseline,
  collectSeedMetrics,
  aggregatePerSeed,
  compareToBaseline,
  failureMessages,
  metricsPerSeed,
  specFor,
  stdevPerSeed,
  type BaselineFile,
  type MetricComparison,
  type SeedSamples,
} from "../tests/offseason/metrics";

const BASELINE_PATH = path.join(
  process.cwd(),
  "tests",
  "offseason",
  "baselines.json",
);
const BASELINE_LABEL = "tests/offseason/baselines.json";
const RESULT_PREFIX = "BALANCE_RESULT ";

type Options = {
  seeds: number;
  seasons: number;
  seedStart: number;
  workers: number | null;
  jsonPath: string | null;
  writeBaseline: boolean;
  check: boolean;
};

function positiveInt(flag: string, raw: string | undefined): number {
  const value = Number(raw);
  if (raw === undefined || !Number.isInteger(value) || value < 1) {
    throw new Error(`${flag} needs a positive integer (got "${raw ?? ""}").`);
  }
  return value;
}

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    seeds: 4,
    seasons: 4,
    seedStart: 101,
    workers: null,
    jsonPath: null,
    writeBaseline: false,
    check: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument "${token}".`);
    }
    const eq = token.indexOf("=");
    const flag = eq === -1 ? token : token.slice(0, eq);
    const inline = eq === -1 ? undefined : token.slice(eq + 1);
    const takeValue = (): string | undefined => {
      if (inline !== undefined) return inline;
      index += 1;
      return argv[index];
    };
    switch (flag) {
      case "--seeds":
        options.seeds = positiveInt(flag, takeValue());
        break;
      case "--seasons":
        options.seasons = positiveInt(flag, takeValue());
        break;
      case "--seed-start":
        options.seedStart = positiveInt(flag, takeValue());
        break;
      case "--workers":
        options.workers = positiveInt(flag, takeValue());
        break;
      case "--json": {
        const raw = takeValue();
        if (raw === undefined || raw === "") {
          throw new Error("--json needs a file path.");
        }
        options.jsonPath = raw;
        break;
      }
      case "--write-baseline":
        options.writeBaseline = true;
        break;
      case "--no-check":
        options.check = false;
        break;
      default:
        throw new Error(`Unknown flag "${flag}".`);
    }
  }
  if (options.writeBaseline && !options.check) {
    throw new Error("--write-baseline and --no-check cannot be combined.");
  }
  return options;
}

// ---------------------------------------------------------------------------
// Worker: one seed, prints one JSON line.

function runWorker(argv: readonly string[]): number {
  let seed = 0;
  let seasons = 0;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--seed") seed = positiveInt("--seed", argv[++i]);
    if (argv[i] === "--seasons") seasons = positiveInt("--seasons", argv[++i]);
  }
  const samples = collectSeedMetrics({
    seed,
    seasons,
    onSeason: (index, ms) =>
      console.error(`  seed ${seed}: season ${index}/${seasons} in ${ms} ms`),
  });
  process.stdout.write(`${RESULT_PREFIX}${JSON.stringify(samples)}\n`);
  return 0;
}

function runChild(seed: number, seasons: number): Promise<SeedSamples> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        process.argv[1]!,
        "--worker",
        "--seed",
        String(seed),
        "--seasons",
        String(seasons),
      ],
      { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      err += text;
      process.stderr.write(text);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const line = out
        .split(/\r?\n/)
        .find((candidate) => candidate.startsWith(RESULT_PREFIX));
      if (code !== 0 || line === undefined) {
        reject(
          new Error(
            `Worker for seed ${seed} failed (exit ${code}).\n${err.slice(-2000)}`,
          ),
        );
        return;
      }
      resolve(JSON.parse(line.slice(RESULT_PREFIX.length)) as SeedSamples);
    });
  });
}

async function runPool(
  seeds: readonly number[],
  seasons: number,
  workers: number,
): Promise<SeedSamples[]> {
  const results: SeedSamples[] = new Array(seeds.length);
  let next = 0;
  const lane = async () => {
    while (next < seeds.length) {
      const index = next;
      next += 1;
      console.error(`seed ${seeds[index]} started`);
      results[index] = await runChild(seeds[index]!, seasons);
      console.error(`seed ${seeds[index]} done`);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(workers, seeds.length) }, lane),
  );
  return results;
}

// ---------------------------------------------------------------------------
// Output

function fmt(value: number | null): string {
  return value === null ? "-" : String(Math.round(value * 1000) / 1000);
}

function printTable(rows: readonly MetricComparison[]): void {
  const header = ["metric", "baseline", "current", "tolerance", "status"];
  const body = rows.map((row) => [
    row.name,
    fmt(row.baseline),
    fmt(row.current),
    row.tolerance === null ? "-" : `+/- ${fmt(row.tolerance)}`,
    row.status,
  ]);
  const widths = header.map((h, c) =>
    Math.max(h.length, ...body.map((r) => r[c]!.length)),
  );
  const line = (cells: readonly string[]) =>
    cells.map((cell, c) => cell.padEnd(widths[c]!)).join("  ");
  console.log(line(header));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const cells of body) console.log(line(cells));
}

function readBaseline(): BaselineFile | null {
  if (!existsSync(BASELINE_PATH)) return null;
  return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as BaselineFile;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv[0] === "--worker") return runWorker(argv.slice(1));

  let options: Options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(
      "Flags: --seeds N (4) --seasons M (4) --seed-start S (101) --workers N " +
        "--json <path> --write-baseline --no-check",
    );
    return 2;
  }
  if (options.writeBaseline && options.seeds < 3) {
    console.error(
      "--write-baseline needs at least 3 seeds (--seeds 3 or more): the tolerance comes from the spread across seeds.",
    );
    return 2;
  }

  const seedList = Array.from(
    { length: options.seeds },
    (_, i) => options.seedStart + i,
  );
  const workers = options.workers ?? Math.min(options.seeds, 4);
  console.error(
    `offseason balance: seeds ${seedList.join(",")}, ${options.seasons} seasons, ${workers} workers`,
  );
  const started = Date.now();
  const samples = await runPool(seedList, options.seasons, workers);
  const wallSeconds = (Date.now() - started) / 1000;

  const perSeed = metricsPerSeed(samples);
  const current = aggregatePerSeed(perSeed);
  const spread = stdevPerSeed(perSeed);

  if (options.jsonPath !== null) {
    writeFileSync(
      options.jsonPath,
      `${JSON.stringify({ options, aggregate: current, stdevAcrossSeeds: spread, perSeed, raw: samples }, null, 2)}\n`,
    );
    console.log(`wrote ${options.jsonPath}`);
  }

  if (options.writeBaseline) {
    const baseline = buildBaseline({
      perSeed,
      seeds: options.seeds,
      seasons: options.seasons,
      seedStart: options.seedStart,
    });
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
    printTable(compareToBaseline(baseline, current));
    console.log(
      `\nwrote ${BASELINE_LABEL} (${Object.keys(baseline.metrics).length} metrics)`,
    );
    console.log(`wall time ${wallSeconds.toFixed(1)} s`);
    return 0;
  }

  const baseline = readBaseline();
  if (baseline === null) {
    printTable(
      Object.entries(current).map(([name, value]) => ({
        name,
        baseline: null,
        current: value,
        tolerance: null,
        unit: specFor(name)?.unit ?? "",
        status: "new" as const,
      })),
    );
    console.log(`\nwall time ${wallSeconds.toFixed(1)} s`);
    if (!options.check) return 0;
    console.error(
      `No ${BASELINE_LABEL}. Create it with --write-baseline (3 or more seeds).`,
    );
    return 1;
  }

  const rows = compareToBaseline(baseline, current);
  printTable(rows);
  console.log(`\nwall time ${wallSeconds.toFixed(1)} s`);
  const generated = baseline.generatedWith;
  if (
    generated.seasons !== options.seasons ||
    generated.seeds !== options.seeds
  ) {
    console.log(
      `note: the baseline was written with ${generated.seeds} seeds x ${generated.seasons} seasons; this run used ${options.seeds} x ${options.seasons}, so bands are only indicative.`,
    );
  }
  const newOnes = rows.filter((row) => row.status === "new");
  if (newOnes.length > 0) {
    console.log(
      `note: ${newOnes.length} metric(s) not in the baseline: ${newOnes.map((r) => r.name).join(", ")}. Rerun with --write-baseline to add them.`,
    );
  }
  const failures = failureMessages(rows, BASELINE_LABEL);
  if (failures.length === 0) {
    console.log("\nAll metrics are inside their bands.");
    return 0;
  }
  console.log(`\n${failures.length} metric(s) outside their bands:`);
  for (const message of failures) console.log(`  ${message}`);
  return options.check ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(
      error instanceof Error ? (error.stack ?? error.message) : error,
    );
    process.exitCode = 1;
  },
);
