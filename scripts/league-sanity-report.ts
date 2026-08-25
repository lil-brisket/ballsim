/**
 * Deterministic multi-simulation league sanity CLI.
 * Diagnostic — not a CI gate by default.
 *
 * Run:
 *   npx tsx scripts/league-sanity-report.ts --sims 10 --seasons 5 --seed 42
 *   npx tsx scripts/league-sanity-report.ts --sims 100 --seasons 20 --seed 42 --format json
 */

import { writeFileSync } from "node:fs";
import {
  buildLeagueSanityReport,
  formatLeagueSanityReport,
} from "@/simulation/league-sanity";

function parseArgs(argv: string[]): {
  sims: number;
  seasons: number;
  seed: number;
  format: "text" | "json";
  out: string | null;
} {
  let sims = 10;
  let seasons = 5;
  let seed = 42;
  let format: "text" | "json" = "text";
  let out: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const next = argv[i + 1];
    if (arg === "--sims" && next) {
      sims = Number(next);
      i += 1;
    } else if (arg === "--seasons" && next) {
      seasons = Number(next);
      i += 1;
    } else if (arg === "--seed" && next) {
      seed = Number(next);
      i += 1;
    } else if (arg === "--format" && next) {
      format = next === "json" ? "json" : "text";
      i += 1;
    } else if (arg === "--out" && next) {
      out = next;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: npx tsx scripts/league-sanity-report.ts [--sims N] [--seasons N] [--seed N] [--format text|json] [--out path]",
      );
      process.exit(0);
    }
  }

  if (!Number.isFinite(sims) || sims < 1) {
    throw new Error("--sims must be >= 1");
  }
  if (!Number.isFinite(seasons) || seasons < 1) {
    throw new Error("--seasons must be >= 1");
  }

  return { sims, seasons, seed, format, out };
}

const args = parseArgs(process.argv.slice(2));

console.error(
  `League sanity: sims=${args.sims} seasons=${args.seasons} seed=${args.seed}`,
);

const started = Date.now();
const report = buildLeagueSanityReport({
  simulations: args.sims,
  seasonsPerSimulation: args.seasons,
  seed: args.seed,
});
const elapsedMs = Date.now() - started;
console.error(`Completed in ${(elapsedMs / 1000).toFixed(1)}s`);

const output =
  args.format === "json"
    ? JSON.stringify(report, null, 2)
    : formatLeagueSanityReport(report);

if (args.out) {
  writeFileSync(args.out, output, "utf8");
  console.error(`Wrote ${args.out}`);
} else {
  console.log(output);
}
