/**
 * CLI: simulation statistical validation harness.
 *
 * Usage:
 *   npx tsx scripts/validate-simulation-stats.ts --games 5000 --seed 12345
 *   npx tsx scripts/validate-simulation-stats.ts --games 1000 --seed 12345 --matchup-games 200
 */

import {
  formatValidationReport,
  runSimulationValidation,
} from "@/simulation/validation";

function parseArgs(argv: string[]): {
  games: number;
  seed: number | string;
  matchupGames?: number;
} {
  let games = 1000;
  let seed: number | string = 12345;
  let matchupGames: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--games") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error("--games requires a positive integer");
      }
      games = value;
      index += 1;
    } else if (arg === "--seed") {
      const raw = argv[index + 1];
      if (raw === undefined) {
        throw new Error("--seed requires a value");
      }
      const asNumber = Number(raw);
      seed = Number.isFinite(asNumber) && raw.trim() !== "" ? asNumber : raw;
      index += 1;
    } else if (arg === "--matchup-games") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 0) {
        throw new Error("--matchup-games requires a non-negative integer");
      }
      matchupGames = value > 0 ? value : undefined;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: npx tsx scripts/validate-simulation-stats.ts [--games N] [--seed S] [--matchup-games N]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { games, seed, matchupGames };
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const result = runSimulationValidation({
    games: options.games,
    seed: options.seed,
    matchupGames: options.matchupGames,
  });
  console.log(formatValidationReport(result));
  if (result.overallVerdict === "FAIL") {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Validation failed: ${message}`);
  process.exitCode = 1;
}
