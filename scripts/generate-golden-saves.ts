/**
 * CLI: regenerate golden old-save fixtures from git history.
 *
 * Usage:
 *   npx tsx scripts/generate-golden-saves.ts            # all versions
 *   npx tsx scripts/generate-golden-saves.ts 23 41      # only these versions
 *   npx tsx scripts/generate-golden-saves.ts --played   # played saves only
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
 * `--played` writes vNN-played.json.gz instead: a CBL league bootstrapped
 * and played by that era's own engine through one season, stopped on the
 * first day of free agency (expired contracts released, draft done, RFA
 * classified). These are what a real mid-offseason save looked like.
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

/** Played saves for the recent versions (see `--played`). */
const GOLDEN_PLAYED_SAVE_COMMITS: ReadonlyArray<{
  version: number;
  commit: string;
}> = [
  { version: 65, commit: "cb49c8d" },
  { version: 71, commit: "a5b766e" },
  { version: 77, commit: "9669a03" },
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

const PLAYED_ENTRY_SOURCE = `
import { writeFileSync } from "node:fs";

async function main() {
  const [outPath, saveId] = process.argv.slice(2);
  const { createInitialGameState } = await import("./src/state/create-initial-state");
  const { CBL_GAME_SETTINGS, cloneGameSettings } = await import("./src/domain/game-settings");
  const { applyPreset } = await import("./src/domain/ai-management-presets");
  const { createSeededRng } = await import("./src/domain/rng");
  const { bootstrapWorld } = await import("./src/systems/world-pipeline");
  const { advanceSimulation } = await import("./src/systems/simulation/advance-simulation");
  const { enterOffseasonFromPostseason } = await import("./src/systems/simulation/season-lifecycle");
  const { autoResolveGeneratedDraftClass } = await import("./src/systems/draft/draft-creation");
  const { resolvePendingOwnerDecision } = await import("./src/systems/owner-decisions/enqueue-trade-offer");
  const { getActivePhaseId } = await import("./src/systems/phase-engine/resolve-current-phase");

  const settings = cloneGameSettings(CBL_GAME_SETTINGS);
  settings.ai = {
    ...settings.ai,
    managementPreset: "full_management",
    assistance: applyPreset("full_management"),
  };
  let state = createInitialGameState({
    saveId,
    rngSeed: ${GOLDEN_RNG_SEED},
    nowIso: "${GOLDEN_NOW_ISO}",
    settings,
  });
  const rng = createSeededRng(state.meta.rngState);
  const keep = (next) => ({ ...next, meta: { ...next.meta, rngState: rng.getState() } });
  state = keep(bootstrapWorld(state, rng).state);
  let seenReview = false;
  for (let day = 0; day < 800; day += 1) {
    for (const decision of state.user.pendingOwnerDecisions) {
      if (decision.blockingLevel !== "blocking") continue;
      state = resolvePendingOwnerDecision(state, {
        decisionId: decision.id,
        status: "declined",
        decisionSource: "system",
      }).state;
    }
    const phase = getActivePhaseId(state);
    if (phase === "postseason.season_review") {
      seenReview = true;
      state = enterOffseasonFromPostseason(state).state;
      continue;
    }
    if (seenReview && phase === "offseason.free_agency") {
      writeFileSync(outPath, JSON.stringify(state));
      return;
    }
    if (phase === "offseason.draft_preparation") {
      state = keep(autoResolveGeneratedDraftClass(state, rng).state);
    }
    state = keep(advanceSimulation(state, rng, { days: 1, gameFidelity: "box_score" }).state);
  }
  throw new Error("Did not reach free agency within 800 days.");
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
  played: boolean,
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
    writeFileSync(entry, played ? PLAYED_ENTRY_SOURCE : ENTRY_SOURCE);
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
    const name = played ? `v${tag}-played.json.gz` : `v${tag}.json.gz`;
    writeFileSync(join(outDir, name), gz);
    console.log(
      `${name} (${commit}): ${(raw.length / 1024).toFixed(0)} KB raw, ${(gz.length / 1024).toFixed(0)} KB gz`,
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
  const args = process.argv.slice(2);
  const played = args.includes("--played");
  const only = new Set(args.filter((arg) => arg !== "--played").map(Number));
  const commits = played ? GOLDEN_PLAYED_SAVE_COMMITS : GOLDEN_SAVE_COMMITS;
  for (const { version, commit } of commits) {
    if (only.size > 0 && !only.has(version)) continue;
    generate(repoRoot, outDir, version, commit, played);
  }
  rmSync(join(repoRoot, ".golden-worktrees"), { recursive: true, force: true });
}

main();
