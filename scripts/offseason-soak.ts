/**
 * CLI: offseason soak (many seeds x many seasons, invariants at every phase
 * boundary). Not part of `npm test`.
 *
 *   npm run test:offseason-soak
 *   npm run test:offseason-soak -- --seeds 2 --seasons 3 --profile busy
 *   npm run test:offseason-soak -- --seed 17 --profile busy --season 6 --phase free-agency
 *
 * See docs/testing.md ("Offseason soak").
 */

import { formatSummary, parseSoakArgs, runSoak } from "../tests/offseason/soak";

function main(): number {
  let options;
  try {
    options = parseSoakArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(
      "Flags: --seeds N --seasons M --seed-start S --profile auto|busy|both " +
        "--max-season-ms T --max-phase-days D --fail-fast --verify-determinism --probe-salary-bounds " +
        "--seed X --season Y --phase P (replay)",
    );
    return 2;
  }
  const summary = runSoak(options, { log: (line) => console.log(line) });
  for (const line of formatSummary(summary)) console.log(line);
  return summary.failures.length === 0 ? 0 : 1;
}

process.exitCode = main();
