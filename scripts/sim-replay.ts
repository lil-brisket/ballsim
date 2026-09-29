/**
 * Replay a single failed Lab game from its stored seed and diff event logs.
 *
 * Usage:
 *   npm run sim:replay -- --run <runId> --game <n> [--results-dir path]
 */

import { replayLabGame } from "@/simulation/lab/replay-lab-game";

function parseArgs(argv: string[]): {
  runId: string;
  gameIndex: number;
  resultsDir?: string;
} {
  let runId: string | undefined;
  let gameIndex: number | undefined;
  let resultsDir: string | undefined;
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
        "Usage: npm run sim:replay -- --run <runId> --game <n> [--results-dir path]",
      );
      process.exit(0);
    }
    if (flag === "--run") {
      if (value == null) throw new Error("--run requires a runId");
      runId = value;
      if (consume && inline == null) index += 1;
    } else if (flag === "--game") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error("--game requires a non-negative integer");
      }
      gameIndex = parsed;
      if (consume && inline == null) index += 1;
    } else if (flag === "--results-dir") {
      if (value == null) throw new Error("--results-dir requires a path");
      resultsDir = value;
      if (consume && inline == null) index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (runId == null || gameIndex == null) {
    throw new Error("sim:replay requires --run and --game");
  }
  return { runId, gameIndex, resultsDir };
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const result = replayLabGame({
    runId: options.runId,
    gameIndex: options.gameIndex,
    resultsRoot: options.resultsDir,
  });
  if (result.matches) {
    process.stdout.write(
      `replay game ${result.gameIndex} matches stored event log (${result.storedEventCount} events)\n`,
    );
    process.exitCode = 0;
    return;
  }
  process.stderr.write(
    `replay game ${result.gameIndex} diverged at ${result.diffs.length} event(s)\n`,
  );
  for (const diff of result.diffs.slice(0, 20)) {
    process.stderr.write(
      `  [${diff.index}] stored=${JSON.stringify(diff.stored)} replayed=${JSON.stringify(diff.replayed)}\n`,
    );
  }
  process.exitCode = 1;
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`sim:replay failed: ${message}`);
  process.exitCode = 1;
}
