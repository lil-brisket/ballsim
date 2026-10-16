# Test speed and CI plan

## Outcome (2026-10-16)

Measurements are in [`test-speed-baseline.md`](./test-speed-baseline.md). The baseline changed the plan in three places:

- **Task 1:** `npm test` wall time came from three minutes-long files. They (or just their slow tests) moved to a new `slow` tier (`tests/**/*.slow.test.ts`, `npm run test:slow`). It runs as its own PR CI job and is not part of `npm test`. Suites with timeouts over 30s moved from `unit` to `integration`. The broad ">3s per file" move was skipped because both tiers are in `npm test`, so it would not have sped anything up.
- **Task 2 (cached world helper):** dropped. `bootstrapWorld` costs about 10–30ms and tests almost never share a `saveId` and seed.
- **Task 3:** integration was under 30% of coverage time, so it stays in `test:coverage`. The CI jobs are `static`, `test`, `slow`, `simulation` and `build`.
- **Also done:** fixed the 8 test files already failing in PR tiers (7 React files missing a `server-only` mock, plus one stale fixture; `migration-v66-v67` asserting a mode that became valid). The 2 failing multi-year regression tests are left for a separate issue.

Result: `npm test` went from 229s to 58s locally, with every file passing.

## Context

The user supplied a plan to make `npm test` and PR CI faster without weakening tests, changing `src/` behavior, or adding paid CI. I checked its claims against the repo. Most hold. Several do not, and two of them block the plan's own acceptance criteria:

| Plan claim / assumption                                                  | Actual (verified)                                                                                                                                                                                                                                                                 | Effect on plan                                                                                                                           |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| CI can be compared against a recent green run                            | Master CI is **red at Format check**: 99 files fail Prettier (~57 in `src/`). Tests, simulation and build have been **skipped** on every run since.                                                                                                                               | New Step A (user approved): formatting-only commit first. Before/after CI comparison uses the first green run on the branch, not master. |
| CI runs on push to the main branch                                       | `ci.yml` triggers on `push: branches: [main]`, but the default branch is `master` (changed in `003f07c`, 2026-10-12). Pushes to master no longer run CI.                                                                                                                          | Fix trigger to `master` in Task 3.                                                                                                       |
| `test:coverage` means "unit + react"                                     | It is `unit + integration + react`.                                                                                                                                                                                                                                               | Dropping integration from coverage is a real change; decide with Task 0 numbers (rule below).                                            |
| Branch protection may require job `check`                                | `master` is not protected (API 404).                                                                                                                                                                                                                                              | No required-check rename needed. Mention in PR anyway.                                                                                   |
| `resetDomainEventSequenceForTests` makes cached worlds risky (event ids) | `createDomainEvent` uses `crypto.randomUUID()` when available (Node 22 always), so `eventSequence` never reaches an id (`src/domain/events/domain-event.ts:133-155`).                                                                                                             | Event-id risk is moot. Real cached-world risks are listed in Task 2. Still migrate file by file.                                         |
| Slow-in-unit list                                                        | Confirmed, plus `tests/systems/player-generation.test.ts` (two 60s cases). `simulate-to-date` has no large timeout; Task 0 decides.                                                                                                                                               | Add player-generation (split slow cases out).                                                                                            |
| Duplicate `season-rng-desync`                                            | `tests/systems/simulation/season-rng-desync.test.ts` (unit; seed 42, 8 days, asserts `daysAdvanced > 0`) is a subset of `tests/simulation/lab/season-rng-desync.test.ts` (simulation tier; same boot path, seed 7, advances the whole regular season with RNG alignment asserts). | Deletion is justified. Note the lab copy runs in the `simulation` CI job, not `npm test`.                                                |
| 50 `scripts/_*` scratch files, unreferenced                              | Confirmed 50. Only references: `tsconfig.tsbuildinfo` (generated), a `.gitignore` comment naming `_decade_health.ts`, and `_play_10_year_dynasty.ts` → its own JSON output. 3 of them fail Prettier.                                                                              | Delete them **before** the format commit; fix the `.gitignore` comment.                                                                  |
| `performance-budget` strict in nightly                                   | `sim-nightly.yml` runs simulation + regression only, not integration.                                                                                                                                                                                                             | Task 4 must add a nightly step that runs it strictly.                                                                                    |

Note: the user's memory says not to run suites unprompted. This plan explicitly calls for measurement and verification runs, so those runs are in scope. Timing JSON goes to the scratchpad, not the repo.

## Order

`A → B → 0 → 1 → 2 → 3 → 4 → 6`. A and B are trivial and done in the main session. Task 4's duplicate deletion can go with Task 1. Work on one branch (e.g. `chore/test-speed-ci`), one commit per step. Ask before pushing (Task 3 verification needs a push). Use `shipper` only when the user asks for the commit or PR.

First action after approval: write this corrected plan to `docs/plans/test-speed-and-ci.md`.

## Step A: Remove scratch files (main session)

- `git rm` the 50 `scripts/_*` files. Add `scripts/_*` to `.gitignore`. Reword the comment at `.gitignore:57` so it no longer names `_decade_health.ts`.
- Verify: `npx tsc --noEmit`, `npm run lint`.

## Step B: Formatting-only commit (main session, user-approved src/ exception)

- `npx prettier --write .` then `npm run format:check`.
- Confirm the diff is whitespace/formatting only. Run `git diff --stat` and spot-check `src/systems`. Then `npx tsc --noEmit`, `npm run lint`, `npm test`.
- Commit alone (`style: apply prettier`). Suggest adding its SHA to `.git-blame-ignore-revs` in a follow-up commit.

## Task 0: Baseline (main session)

- Run each twice on Windows and keep the second (warm) run. Write output to the scratchpad:
  - `npx vitest run --project unit --project integration --project react --reporter=json --outputFile=<scratch>/test-timings-before.json`
  - `npx vitest run --project simulation --reporter=json --outputFile=<scratch>/sim-timings-before.json`
  - Also `npx vitest list --filesOnly --json` per project (fallback: `vitest list --json` + dedupe files) → `<scratch>/files-before.json`.
- Use a small node script in the scratchpad to build: wall time per project, the 25 slowest files, and the 25 slowest tests. Write `docs/plans/test-speed-baseline.md`.
- Also record wall time of `npm run test:coverage` (the CI-relevant number), and of `bootstrapWorld` alone (time one call) to size Task 2's payoff.
- Revise Tasks 1 and 2 if the data disagrees with the table above.

## Task 1: Tier leakage (implementer, review in main)

- Convention: `tests/**/*.slow.test.ts` is excluded from `unit` and included in `integration` (`vitest.config.mts`). Rename newly moved files to `*.slow.test.ts`. Leave the existing explicit integration and regression lists alone to avoid churn.
- Move: `season-events-{e2e,cycle,foundation}`, `franchise-identity-persistence`, `fantasy-draft`, `fantasy-draft-analysis`, plus any file over ~3s in Task 0. Anything multi-season goes to `regression` instead (explicit list).
- `player-generation.test.ts`: move only its two 60s cases into `player-generation.slow.test.ts`, verbatim, with the setup they need. Keep the fast cases in unit.
- Delete `tests/systems/simulation/season-rng-desync.test.ts` (Task 4 item, comparison already done above; re-confirm in review).
- Update tier tables and file links in `docs/test-catalog.md` and `docs/testing.md`.
- Acceptance: the `test:all` file set before and after differs only by the renames and the one deletion (diff the `vitest list` output). No `unit` test has a timeout above 30s (grep). `npm test` is faster than the baseline.

## Task 2: Cached world helper (main designs and writes the helper; implementer migrates)

Helper `tests/helpers/cached-world.ts` (main session):

```ts
cachedWorld({
  saveId,
  rngSeed,
  settings = CBL_GAME_SETTINGS,
  settingsKey = "cbl",
  stage,
});
// stage: "bootstrap" | "regular-season"
// returns { state: structuredClone(cached.state), rng: createSeededRng(cached.rngState) }
```

- Module-level `Map` keyed by `saveId|rngSeed|settingsKey|stage`. Vitest's default `isolate: true` gives each file its own module, so the cache is per file.
- It caches the **live** `rng.getState()` after the build, not `meta.rngState`. The two can differ (see the lab desync test), so a resumed rng then matches the fresh path exactly.
- Stages from the real pattern (`createInitialGameState` → `createSeededRng(state.meta.rngState)` → `bootstrapWorld` → optionally `beginRegularSeasonFromPreseason`). The plan's "bootstrap + rosters" stage looks redundant because `bootstrapWorld` already runs `generateRosters`. Add it only if a caller really has a separate roster step.
- Reuse `createSeededRng` (`@/domain/rng`), `createInitialGameState`, `bootstrapWorld` (`src/systems/world-pipeline.ts:33`). State is plain data (persisted as JSON; `structuredClone` already used in `tests/application/game-service.test.ts`).
- Self-test `tests/helpers/cached-world.test.ts`: two calls return deep-equal, non-identical states. Mutating one does not affect the next. Both rngs produce the same next N values as a fresh build's rng.
- Real risks: (1) `createInitialGameState` uses `crypto.randomUUID` for some ids, so cached clones share ids that fresh builds would not. Skip any test that compares two separately bootstrapped states for distinctness. (2) Only migrate call sites that match the exact pattern, with no rng use between seed and bootstrap and no custom roster package.

Migration (implementer, batches of ~3 files): `owner-decisions` (11 calls), `owner-notifications`, `hard-locks`, `ai-team-decisions`, `world-pipeline`, `phase5-hub-selectors`, `ticket-revenue`, `advance-simulation`, `migration-v39`, `phase5-offseason-lifecycle`. Brief per batch: no assertion changes; run each file alone before and after and report pass counts and durations; skip and report any file whose results change. Review every diff.

- End: `npm test`, `npm run test:regression`.

## Task 3: CI split (implementer writes, main reviews YAML)

- `.github/workflows/ci.yml`: change the push trigger to `master`. Keep `concurrency`/`cancel-in-progress`. Split into parallel jobs, each with checkout, `setup-node@v4` (node 22, npm cache), `npm ci` and `timeout-minutes`:
  1. `static`: tsc, lint, format:check
  2. `test`: `npm run test:coverage`, coverage artifact, Codecov (`fail_ci_if_error: false`, `if: always()`)
  3. `integration`: `npm run test:integration` (only if split out, see rule)
  4. `simulation`: `npm run test:simulation`
  5. `build`: `npm run build` with `DATABASE_URL: file:./prisma/ci.db`
- Coverage rule (from Task 0): if integration is ≥ ~30% of `test:coverage` wall time, change `test:coverage` to `--project unit --project react`, add the `integration` job, and update the `npm test`/coverage lines in `docs/testing.md` and `docs/test-catalog.md`. Otherwise keep integration in coverage and get the gain from the other parallel jobs. Codecov has had no uploads since CI went red (no lcov produced), so its base is stale. Call out the possible coverage shift in the PR.
- No sharding, larger runners or paid features. Stay on `ubuntu-latest`.
- Verify: with user OK, push the branch. Read the Actions run: all jobs green, and wall time is close to the slowest job.

## Task 4: Test-quality items (main session, since these change assertions)

- Duplicate deletion: done in Task 1.
- `performance-budget.test.ts`: strict by default. When `PERF_BUDGET_MODE=warn`, a budget overrun calls `console.warn` instead of failing. Set that env var only in the PR CI job that runs integration. Add a strict `npm run test:integration` step (or a `vitest run tests/systems/simulation/performance-budget.test.ts --project integration` step) to `sim-nightly.yml`.
- Invariants for "it ran" tests: add only where an existing invariant helper already applies (look for one in `tests/simulation/lab/check-invariants` and `validate-simulation-state` before writing new checks). Skip if not obvious.

## Task 6: Re-measure and document (main session)

- Re-run Task 0 commands. Add the before/after table to `docs/plans/test-speed-baseline.md` and the PR text.
- Add a short "Keeping tests fast" section to `docs/testing.md`: tier rules, `*.slow.test.ts`, `cachedWorld`, no unit timeout above 30s, `PERF_BUDGET_MODE`.
- Full verification: `npx tsc --noEmit`, `npm run lint`, `npm run format:check`, `npm test`, `npm run test:simulation`, `npm run test:regression`.

## Critical files

`vitest.config.mts`, `package.json`, `.github/workflows/ci.yml`, `.github/workflows/sim-nightly.yml`, `.gitignore`, `tests/helpers/cached-world.ts` (new), `tests/systems/simulation/performance-budget.test.ts`, the moved/renamed test files, `docs/testing.md`, `docs/test-catalog.md`, `docs/plans/test-speed-and-ci.md`, `docs/plans/test-speed-baseline.md`. `src/` is touched only by Step B's formatting commit.

## Out of scope (unchanged from user plan)

Per-state domain event sequence, `isolate: false`, Playwright, sharding. Side note for later: since `eventSequence` never reaches ids under Node 22, the 34 reset calls are effectively no-ops. That makes the event-sequence refactor lower-stakes than the plan assumes. Other module-level state still makes `isolate: false` unsafe until audited.
