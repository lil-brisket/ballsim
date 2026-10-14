/**
 * CLI: regenerate golden old-save fixtures from git history.
 *
 * Usage:
 *   npx tsx scripts/generate-golden-saves.ts            # all versions
 *   npx tsx scripts/generate-golden-saves.ts 23 41      # only these versions
 *
 * For each entry in GOLDEN_SAVE_COMMITS this checks the commit out into a
 * temporary git worktree under .golden-worktrees/ (inside the repo, so module
 * resolution walks up to this repo's node_modules without any link), builds a
 * fresh league with that era's own
 * `createInitialGameState`, and writes the JSON gzipped to
 * tests/fixtures/saves/vNN.json.gz. The save is produced by the code that
 * shipped that schema version, so it is a genuine old save, not a
 * hand-downgraded modern one.
 *
 * Old eras use crypto.randomUUID for some ids, so reruns produce different
 * bytes. Regenerate only when replacing a fixture on purpose, then update
 * the digest snapshot in tests/persistence/golden-saves.test.ts.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

/** Commit that introduced each schema version (first commit at that version). */
const GOLDEN_SAVE_COMMITS: ReadonlyArray<{ version: number; commit: string }> =
  [
    { version: 1, commit: "31f9401" },
    { version: 5, commit: "ee8461a" },
    { version: 11, commit: "9574b63" },
    { version: 17, commit: "f965f05" },
    { version: 23, commit: "78609e6" },
    { version: 29, commit: "1196050" },
    { version: 35, commit: "0416aae" },
    { version: 41, commit: "4ef4935" },
    { version: 47, commit: "4e15641" },
    { version: 53, commit: "ef11cab" },
    { version: 59, commit: "e123f03" },
    { version: 65, commit: "cb49c8d" },
  ];

const GOLDEN_NOW_ISO = "2026-08-13T12:00:00.000Z";
const GOLDEN_RNG_SEED = 42;

const ENTRY_SOURCE = `
import { existsSync, writeFileSync } from "node:fs";

async function main() {
  const [outPath, saveId] = process.argv.slice(2);
  let state: { meta: { schemaVersion: number } };
  if (existsSync("tests/factories/game-state.ts")) {
    const factory = await import("./tests/factories/game-state");
    state = factory.createTestGameState({ saveId });
  } else {
    const initial = await import("./src/state/create-initial-state");
    state = initial.createInitialGameState({
      saveId,
      rngSeed: ${GOLDEN_RNG_SEED},
      nowIso: "${GOLDEN_NOW_ISO}",
    });
  }
  writeFileSync(outPath, JSON.stringify(state));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
`;

function generate(
  repoRoot: string,
  outDir: string,
  version: number,
  commit: string,
) {
  const tag = String(version).padStart(2, "0");
  const work = mkdtempSync(join(tmpdir(), `ballsim-golden-v${tag}-`));
  const worktree = join(repoRoot, ".golden-worktrees", `v${tag}`);
  execFileSync("git", ["worktree", "add", "--detach", worktree, commit], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  try {
    const entry = join(worktree, "golden-entry.ts");
    writeFileSync(entry, ENTRY_SOURCE);
    const rawPath = join(work, "state.json");
    execFileSync(
      process.execPath,
      [
        join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs"),
        entry,
        rawPath,
        `golden_v${tag}`,
      ],
      { cwd: worktree, stdio: "inherit" },
    );
    const raw = readFileSync(rawPath, "utf8");
    const parsed = JSON.parse(raw) as { meta: { schemaVersion: number } };
    if (parsed.meta.schemaVersion !== version) {
      throw new Error(
        `Commit ${commit} produced schemaVersion ${parsed.meta.schemaVersion}, expected ${version}.`,
      );
    }
    const gz = gzipSync(raw, { level: 9 });
    writeFileSync(join(outDir, `v${tag}.json.gz`), gz);
    console.log(
      `v${tag} (${commit}): ${(raw.length / 1024).toFixed(0)} KB raw, ${(gz.length / 1024).toFixed(0)} KB gz`,
    );
  } finally {
    execFileSync("git", ["worktree", "remove", "--force", worktree], {
      cwd: repoRoot,
      stdio: "ignore",
    });
    rmSync(work, { recursive: true, force: true });
  }
}

function main() {
  const repoRoot = resolve(__dirname, "..");
  const outDir = join(repoRoot, "tests", "fixtures", "saves");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const only = new Set(process.argv.slice(2).map(Number));
  for (const { version, commit } of GOLDEN_SAVE_COMMITS) {
    if (only.size > 0 && !only.has(version)) continue;
    generate(repoRoot, outDir, version, commit);
  }
  rmSync(join(repoRoot, ".golden-worktrees"), { recursive: true, force: true });
}

main();
