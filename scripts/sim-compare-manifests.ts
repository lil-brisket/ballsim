/**
 * Compare two Lab manifests (or LabReport JSON) and refuse mismatched engineVersion.
 *
 * Usage:
 *   npm run sim:compare -- results/runA/manifest.json results/runB/manifest.json
 */

import { readFileSync } from "node:fs";
import { compareLabPayloads } from "@/simulation/lab";

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function main(): void {
  const args = process.argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h") {
    console.log(
      "Usage: npm run sim:compare -- <manifest-or-report-a.json> <manifest-or-report-b.json>",
    );
    process.exit(0);
  }
  if (args.length !== 2) {
    console.log(
      "Usage: npm run sim:compare -- <manifest-or-report-a.json> <manifest-or-report-b.json>",
    );
    process.exit(1);
  }
  const leftPath = args[0]!;
  const rightPath = args[1]!;
  compareLabPayloads(loadJson(leftPath), loadJson(rightPath));
  process.stdout.write(
    `engineVersion matches for ${leftPath} and ${rightPath}\n`,
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`sim:compare failed: ${message}`);
  process.exitCode = 1;
}
