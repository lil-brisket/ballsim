/**
 * Offline portrait-library prompt list: one prompt per library entry, planned
 * with stratified sampling so coverage is designed, not random. Makes no API
 * calls, reads no saves, and never touches simulation RNG.
 *
 * Usage:
 *   npm run portraits:prompts -- [--count 800] [--seed SEED] [--offset N] [--limit N] [--missing]
 *
 * Output (under the gitignored portraits/ work folder):
 *   portraits/_work/targets.json   the full plan; the ingest step reads traits from it
 *   portraits/_work/prompts.jsonl  { id, prompt, traits, sourcePath } per line
 *
 * Generate each image yourself on the chroma-key background, save it at
 * sourcePath, then run `npm run portraits:ingest`. --missing skips ids that are
 * already in the manifest; --offset/--limit generate in batches (every prefix
 * of the plan is balanced).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPortraitLibraryPrompt } from "@/presentation/portrait-prompt";
import { PORTRAIT_LIBRARY } from "@/systems/portraits/portrait-library";
import {
  DEFAULT_PORTRAIT_LIBRARY_SEED,
  DEFAULT_PORTRAIT_LIBRARY_SIZE,
  planLibraryTargets,
} from "@/systems/portraits/plan-library-targets";

export const PORTRAIT_WORK_DIR = "portraits/_work";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function numberArg(flag: string, fallback: number): number {
  const raw = argValue(flag);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }
  return value;
}

function main(): void {
  const count = numberArg("--count", DEFAULT_PORTRAIT_LIBRARY_SIZE);
  const seed = argValue("--seed") ?? DEFAULT_PORTRAIT_LIBRARY_SEED;
  const offset = numberArg("--offset", 0);
  const limit = numberArg("--limit", Infinity);
  const skipExisting = process.argv.includes("--missing");

  const plan = planLibraryTargets(count, seed);
  const have = new Set(PORTRAIT_LIBRARY.map((entry) => entry.id));
  const selected = plan
    .slice(offset)
    .filter((target) => !skipExisting || !have.has(target.id))
    .slice(0, limit);

  const lines = selected.map((target) =>
    JSON.stringify({
      id: target.id,
      prompt: buildPortraitLibraryPrompt(target.traits),
      traits: target.traits,
      sourcePath: `${PORTRAIT_WORK_DIR}/source/${target.id}.png`,
    }),
  );

  const dir = join(process.cwd(), PORTRAIT_WORK_DIR);
  mkdirSync(join(dir, "source"), { recursive: true });
  writeFileSync(
    join(dir, "targets.json"),
    `${JSON.stringify({ seed, count, targets: plan }, null, 2)}\n`,
  );
  const out = join(dir, "prompts.jsonl");
  writeFileSync(out, lines.length === 0 ? "" : `${lines.join("\n")}\n`);
  process.stdout.write(`wrote ${lines.length} prompts -> ${out}\n`);
}

main();
