# Testing Guide

Concise conventions for unit, integration, and React tests in this project. For a command-and-file index of every suite and simulation CLI, see [`test-catalog.md`](./test-catalog.md).

## Stack

| Layer              | Tool                                              |
| ------------------ | ------------------------------------------------- |
| Runner             | Vitest 4                                          |
| Path aliases       | Vite `resolve.tsconfigPaths` (`@/*` → `src/*`)    |
| Coverage           | `@vitest/coverage-v8`                             |
| React (jsdom only) | `@testing-library/react` + `@testing-library/dom` |

Domain, state, systems, and persistence tests run in the **Node** Vitest project. Component smoke tests use the **React/jsdom** project. Do not add Jest or Playwright unless architecture is updated first.

## Commands

```bash
npm test                 # vitest run (CI / one-shot: unit + integration + react)
npm run test:slow        # minutes-long *.slow.test.ts files (PR CI; not in npm test)
npm run test:simulation  # Lab 100-game rotation-on, fidelity parity, season invariants + RNG (PR CI; not in npm test)
npm run test:watch       # watch mode
npm run test:coverage    # same projects as npm test, plus v8 coverage (text/html/lcov)
npm run sim -- --seed=42 --games=100   # Simulation Lab CLI (default --channel pr)
npm run sim -- --seed=42 --games=300 --fidelity=box_score --calibrate   # box-score path against the same bands
```

Every Vitest run writes `test-results.txt` at the repo root (gitignored): summary plus each failure with expected/received and a short stack (import-time "module collection" failures keep the full stack). Failing runs also write `test-results.last-failure.txt`, which a later passing run does not overwrite, so flaky failures stay inspectable. Override the path with `TEST_RESULTS_FILE`. A CLI `--reporter=` flag replaces config reporters; add `--reporter=./scripts/vitest-txt-reporter.ts` if you still want the file.

On Windows, Vitest 4 fails every test file with `Cannot read properties of undefined (reading 'config')` when it starts from a working directory with a lowercase drive letter (`c:\…`, as VS Code and some agent shells use). The npm test scripts start Vitest through `scripts/vitest.mjs`, which switches to the canonical `C:\…` path first. A direct `npx vitest` from a lowercase cwd stops with a startup error that says so. Run it from `C:\…` or use `npm run test:unit -- <path>` instead (issue #96, upstream vitest-dev/vitest#10812).

## Directory structure

```text
tests/
  domain/       # pure domain unit tests
  state/        # GameState / selectors
  systems/      # systems and pipelines (often integration)
  persistence/  # mappers / serialization
  factories/    # deterministic entity builders
  fixtures/     # static sample constants
  helpers/      # shared test utilities (RNG, clocks)
  react/        # jsdom + Testing Library smoke only
  simulation/
    lab/        # Simulation Lab (fast unit files in npm test; 100-game/season in test:simulation)
```

Vitest isolation:

- `*.test.ts` → Node project
- `*.test.tsx` → jsdom project

Do not put domain tests in `.tsx` files.

## Unit vs integration

- **Unit**: one module’s behavior (e.g. `calendar-date`, `createPlayer`).
- **Integration**: multiple modules together (e.g. world pipeline → games → standings). Prefer real implementations over mocks.

Classify by what you import, not by folder renames.

## Naming

- Files: `{subject}.test.ts` or `{subject}.test.tsx`
- `describe("subject")` — the unit under test
- `it("observable behavior")` — what the caller should see

## Factories and fixtures

- Factories (`tests/factories/`) return complete, deterministic entities with optional overrides.
- Nested objects (e.g. `ratings`) merge with defaults.
- Fixtures (`tests/fixtures/`) hold static constants (dates, IDs), not builders.
- Prefer factories over copying object literals across tests.
- `createTestGameState` always sets `saveId`, `rngSeed`, and `nowIso`. Production `createInitialGameState` still uses `crypto.randomUUID` for some IDs; use `createPlayer` / `createTeam` when IDs must be stable.

## Old saves

`tests/fixtures/saves/` holds genuine old saves, each written by the code that shipped its schema version (`scripts/generate-golden-saves.ts` checks that commit out into a temporary worktree):

- `vNN.json.gz` are freshly created leagues across the whole schema chain. `tests/persistence/golden-saves.test.ts` migrates and validates each and pins a digest of the result; `golden-saves-rules.test.ts` checks that later rules do not change an old league (the draft lottery stays off before v75, RFA is on, the luxury tax keeps its stored value).
- `vNN-played.json.gz` (v65, v71, v77, v79) are CBL leagues played by that version's engine through one season and stopped on the first day of free agency. `tests/regression/old-save-playthrough.test.ts` loads each, finishes the offseason, plays a full season and offseason, and checks the offseason invariants at every phase. Damage an old engine wrote is listed per fixture in `HISTORICAL_ISSUES` and must heal by the next Roster Decisions.

When a change bumps `GAME_STATE_SCHEMA_VERSION`, add the new version's commit to `GOLDEN_PLAYED_SAVE_COMMITS` and run `npx tsx scripts/generate-golden-saves.ts --played <version>` once the bump is committed, in the same pull request as the migration, so the old-save playthrough covers it.

## Mocking

Prefer:

- Real deterministic domain logic
- Injected `Rng` / fixed timestamps
- Factories and fixtures

Mock only when isolating I/O (Prisma, filesystem, network). Avoid tests that only assert a mock was called without checking meaningful outcomes.

Prisma adapter tests (`tests/persistence/prisma-save-game-store.test.ts`) use a temp SQLite file and `prisma migrate deploy`. They inject `PrismaClient` into `createPrismaSaveGameStore`. Mock `server-only` in that file. Do not point these tests at `prisma/dev.db`.

## Determinism

Simulation correctness depends on reproducibility:

- Use `createSeededRng` / `createTestRng` — never `Math.random()` in sim or tests of sim.
- Pass `nowIso` and calendar `YYYY-MM-DD` — do not rely on `new Date()` in assertions.
- Use stable IDs in factories.
- Call `resetDomainEventSequenceForTests` (via `resetTestEventSequence`) when event IDs matter.
- Stochastic systems must accept an injected `Rng` (see `ARCHITECTURE.md`).

## Simulation Lab

`src/simulation/lab/` wraps production `simulateGame` / `advanceSimulation`. Fast Lab unit tests (mapper, 2-game checksum, planted failure, scenarios, manifest, engineVersion) stay in `npm test`. The 100-game rotation-on suite, the possession-vs-box-score parity test (`fidelity-parity.test.ts`, which runs `--calibrate` on both fidelities), the headless-owner season guard (`season-fidelity.test.ts`) and the season RNG check run via `npm run test:simulation` (PR CI). Statistical FAIL does not fail the `pr` channel; `--channel nightly` does.

Game batches use per-game RNG streams: `deriveSeed(master, "{scenarioId}:roster")` for rosters and `deriveSeed(master, "{scenarioId}:game:{n}")` for each game. That layout is `ENGINE_VERSION` 1 (version 2 conserves stored minutes per team and recalibrates the box-score projection) — bump [`src/simulation/lab/engine-version.ts`](../src/simulation/lab/engine-version.ts) on any later change that alters output for a fixed seed.

CLI (`npm run sim`) writes `results/<runId>/manifest.json` before the first game. Flags: `--no-persist`, `--results-dir`, `--run-id`. Replay a game-mode run with `runLabGamesFromManifest`. `npm run sim:compare -- a.json b.json` refuses mismatched `engineVersion` (and `scenarioVersion` when the scenario name matches). Hard failures write `results/<runId>/failures/<n>.ndjson` and `<n>.json`; `npm run sim:replay -- --run <runId> --game <n>` re-runs that game from its seed and diffs the stored event log. Game batches also stream `results/<runId>/games.ndjson` (snapshot + `gameIndex` + `gameSeed`) so aggregates can be recomputed. Lab text reports print mean, 95% CI, and n; they also print two-sample n needed to detect d=0.2 and d=0.5 at 80% power. CI fields are not part of the checksum. Persisted game runs write `checkpoint.json` after each game; `--resume --run-id <id>` continues from it. `--jobs N` (with `--rotation=off`) parallelizes independent games; `--timeout-ms` kills a hung game. Rotation-on cannot use `--jobs > 1` (shared rotation/injury state). SIGINT/SIGTERM abort and leave the checkpoint. `--sweep [space.json]` runs a parameter sweep (`--sampler grid|lhs|sobol`, `--samples N`) and writes `sweep.ndjson` plus a Spearman sensitivity ranking. `--write-baseline path` writes a golden of team points, game totals, and absolute differentials. `--baseline path` compares the current run with a two-sample KS test (default `--ks-alpha 0.01`); mismatched `engineVersion` is refused. `--fidelity possession|box_score` (default `possession`) picks the engine for game-mode runs; box-score results go through the same invariants, aggregates and calibration, and the repro command carries `--fidelity=box_score`. `--calibrate` checks per-team-game means (team points 88-120, FG% .42-.50, 3P% .34-.44, FT% .72-.82) that bracket what both engines produce on the canonical `normal` seed-42 run; `PLAUSIBILITY_BANDS` are separate, unchanged, and stay hashed into engine identity. Game-mode runs also hard-fail `MINUTES_NOT_CONSERVED` when a team's player minutes do not sum to 240 (+25 per OT); season runs (`runLabSeason`, which accepts `fidelity` and `skipOwnerGameplay`) hard-fail `TEAM_PPG_OUT_OF_RANGE` and `PLAYER_PPG_OUTLIER` (see [`season-invariants.ts`](../src/simulation/lab/season-invariants.ts)). A KS or calibration FAIL fails the run on every channel. These checks are opt-in and are not part of the checksum. `--config path` supplies JSON defaults; CLI flags override the file. `--dry-run` prints engineVersion, scenario version, and seed streams without simulating. `--list-scenarios` prints every Lab scenario id and its `scenarioVersion` (bump `LAB_SCENARIO_VERSIONS` when a scenario definition changes; bump `ENGINE_VERSION` too if that change alters output for a fixed seed). Persisted runs append `results/index.json`. `--keep N` deletes the oldest run directories beyond N.

```bash
npm run sim -- --seed=42 --games=100
npm run sim:compare -- results/<runA>/manifest.json results/<runB>/manifest.json
npm run sim:replay -- --run <runId> --game 0
```

## React tests

- Only synchronous presentational components (or test-only smoke components under `tests/react/`).
- Do not Vitest-test async Server Components (e.g. `src/app/page.tsx`); use E2E later if needed.
- Keep React coverage minimal until client UI grows.

## CI

GitHub Actions (`.github/workflows/ci.yml`) on pushes to `master` and on every `pull_request`. Five jobs run in parallel on `ubuntu-latest`, each with Node **24** (matches `.nvmrc` and `engines.node >=24`; `@types/node` is `^24`) and `npm ci`. PR wall time is the slowest job.

| Job          | Runs                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `static`     | `npx tsc --noEmit`, `npm run lint` (stylistic rules deferred to Prettier via `eslint-config-prettier`), `npm run format:check`                               |
| `test`       | `npm run test:coverage` (unit + integration + react, writes `coverage/`) with `PERF_BUDGET_MODE=warn`; uploads `coverage/` as the `coverage-report` artifact |
| `slow`       | `npm run test:slow` (no coverage)                                                                                                                            |
| `simulation` | `npm run test:simulation` (Lab rotation-on 100 games, possession vs box-score parity with `--calibrate`, headless-owner season invariants, season RNG)       |
| `build`      | `npm run build`                                                                                                                                              |

`DATABASE_URL=file:./prisma/ci.db` is set for every job.

Coverage HTML/LCOV live under `coverage/` (gitignored). There is no coverage service or threshold; download the `coverage-report` artifact from a run to inspect it. Slow, simulation and regression tests do not contribute to coverage.

The nightly workflow (`.github/workflows/sim-nightly.yml`) runs simulation, the performance budgets with strict wall-clock limits, regression and the 10k-game / 10-season Lab channels.

## Keeping tests fast

- **`unit`** stays under the 30s default timeout. A test that needs a longer timeout belongs in another tier; do not raise it in place.
- **`integration`** (explicit list in `vitest.config.mts`) holds seconds-long suites, including unit-style files whose tests set timeouts above 30s.
- **`slow`** picks up any `tests/**/*.slow.test.ts` by glob: single tests that take minutes but should still gate PRs. Split just the slow cases into a `*.slow.test.ts` sibling rather than moving a whole file of fast tests.
- **`regression`** is for multi-season, economy and league-sanity suites. It runs nightly only, at most 4 files at a time, so the multi-year suites don't starve each other and overrun their timeouts.
- Wall-clock assertions go through `PERF_BUDGET_MODE` (see `performance-budget.test.ts`): strict locally and nightly, warn-only in PR CI.
- Measure before optimizing: `npx vitest run --project unit --reporter=json --outputFile=<file>` gives per-test durations. Baseline numbers are in [`plans/test-speed-baseline.md`](./plans/test-speed-baseline.md). `bootstrapWorld` costs about 10–30ms, so caching worlds is not worth it; the long tests are long because they simulate seasons.

`next build` requires `DATABASE_URL` to be defined (Prisma client construction) but does **not** query the database during build for current dynamic routes. CI uses a real local SQLite `file:` URL, not a fake remote host. No migrate step is required for build today. Prisma adapter tests apply migrations themselves against a temp file.

## Command reference

Every npm script and diagnostic CLI, moved here from the README.

### Scripts

```bash
npm run dev
npm run lab                 # Simulation Lab UI at /dev/sim-lab
npm run lint
npm run format
npm run format:check
npm run db:migrate
npm run db:generate
```

### Tests

Suites live under `tests/`. `npm test` is unit + integration + React only. Slow tests, Lab 100-game batches and multi-year regression are separate.

```bash
npm test                     # unit + integration + react
npm run test:unit
npm run test:integration
npm run test:slow            # *.slow.test.ts, minutes-long (PR CI)
npm run test:simulation      # Lab 100-game rotation-on + season RNG (PR CI)
npm run test:regression      # multi-year, economy, league-sanity (nightly CI)
npm run test:all             # every Vitest project
npm run test:watch
npm run test:coverage        # same projects as npm test, plus coverage/
```

Single file:

```bash
npx vitest run tests/systems/game-sim-state.test.ts
```

30-team trade invariants (100 random player/pick trades; roster 8–15 and payroll at or under the salary cap). CPU/AI trading exists to confirm that path works — not as a load the decade sim has to run every calendar day. Also included in `npm run test:integration` / `npm test`:

```bash
npx vitest run tests/systems/trades/thirty-team-trade-invariants.test.ts
```

50-season soak (skipped unless `STRESS=1`):

```bash
STRESS=1 npx vitest run tests/application/multi-year-simulation-stress.test.ts
```

PowerShell:

```powershell
$env:STRESS=1; npx vitest run tests/application/multi-year-simulation-stress.test.ts
```

Every Vitest run writes `test-results.txt` (gitignored) with the pass/fail counts and each failure’s reason. Open that file after `npm test`. Override the path with `TEST_RESULTS_FILE`.

`npm run test:coverage` writes `coverage/` (HTML + LCOV). CI uploads that folder as the `coverage-report` artifact.

### Simulations

Simulation Lab wraps production `simulateGame` / `advanceSimulation`. Use the UI **or** the CLI — you do not need to play Owner Mode first.

#### UI

```bash
npm run lab
```

Opens [`http://localhost:3000/dev/sim-lab`](http://localhost:3000/dev/sim-lab). Starts `npm run dev` if nothing is already listening on port 3000. Game batches, multi-season careers, and full schedule runs are tabs on that page.

If the app is already running, you can also visit `/dev/sim-lab` directly.

#### CLI

Default `--channel pr` fails on hard invariants only; `--channel nightly` also fails on statistical FAIL.

Each `npm run sim` writes `results/<runId>/manifest.json` **before the first game** (engine version, git SHA, resolved config, seed list). Opt out with `--no-persist`. Compare two manifests with `npm run sim:compare` — mismatched `engineVersion` is refused. Hard invariant failures also write `results/<runId>/failures/<gameIndex>.ndjson` (event log) and `<gameIndex>.json` (seed, config, failures). Replay that game with `npm run sim:replay`. Game-mode runs also stream `results/<runId>/games.ndjson` (raw per-game snapshots) and `checkpoint.json`. Resume with `--resume --run-id <id>`. `--jobs N` requires `--rotation=off`. `--timeout-ms` bounds a single game. `--sweep` runs a config-space sweep (`grid` / Latin hypercube / Sobol) and prints a ranked sensitivity table. `--write-baseline path` saves score distributions; `--baseline path` runs a two-sample KS test (default α=0.01) against that golden. `--calibrate` checks NBA-inspired mean bands. KS or calibration FAIL exits non-zero on every channel. `--config path` loads JSON defaults (CLI flags win). `--dry-run` prints the resolved run without simulating. `--list-scenarios` prints ids and scenario versions. Persisted runs append `results/index.json`. `--keep N` prunes older run directories.

```bash
npm run sim -- --seed=42 --games=100
npm run sim -- --seed=42 --scenario=superteam --rotation=off --channel=pr
npm run sim -- --seed=42 --rotation=off --jobs=4 --games=1000
npm run sim -- --resume --run-id <runId> --seed=42 --rotation=off --games=1000
npm run sim -- --seed=42 --mode owner-career --seasons 10 --channel nightly
npm run sim -- --seed=42 --games=2 --sweep --sampler lhs --samples 8 --rotation=off
npm run sim -- --seed=42 --games=2 --sweep space.json --sampler sobol --samples 16
npm run sim -- --seed=42 --games=20 --write-baseline results/golden.json --rotation=off
npm run sim -- --seed=42 --games=20 --baseline results/golden.json --rotation=off
npm run sim -- --seed=42 --games=20 --calibrate --rotation=off
npm run sim -- --list-scenarios
npm run sim -- --config lab.json --dry-run
npm run sim -- --seed=42 --games=2 --keep 10 --rotation=off
npm run sim:compare -- results/<runA>/manifest.json results/<runB>/manifest.json
npm run sim:replay -- --run <runId> --game 0
```

Game-mode `--scenario` values: `normal`, `superteam`, `weak`, `shooting`, `rebounding`, `min-roster`, `matchup-90-40`, `injury-heavy`, `overtime`.

```bash
npm run bench:sim            # game cost model + season profiler
npm run bench:sim:game
npm run bench:sim:season
npm run sanity:league        # default 10 sims × 5 seasons
npm run sanity:compare -- baseline.json current.json
npm run generate:league-history   # 10 Standard seasons → tests/fixtures/league-history.json
```

`generate:league-history` uses `createSeededRng` (default seed 42) and writes standings, completed playoff brackets, and award winners. It skips daily CPU trade AI during the regular season and playoffs; offseason draft/FA still run. Trading is checked by the 30-team invariant test above, not by this fixture.

Diagnostic CLIs (not npm scripts):

```bash
npx tsx scripts/validate-simulation-stats.ts --games 1000 --seed 12345
npx tsx scripts/injury-simulation-analysis.ts
npx tsx scripts/behavioral-harness.ts
npx tsx scripts/inspect-owner-economy.ts baseline 1
npx tsx scripts/analyze-player-population.ts
npx tsx scripts/analyze-player-development.ts
```

League sanity example:

```bash
npx tsx scripts/league-sanity-report.ts --sims 10 --seasons 5 --seed 42 --format json --out sanity.json
```

## Offseason soak

`npm run test:offseason-soak` plays many seeds through many full seasons with the real engine, one phase at a time, and checks the offseason invariants (`tests/offseason/invariants.ts`) at the start state and after every phase. It is not part of `npm test` and not in CI.

```bash
npm run test:offseason-soak                                  # 8 seeds x 12 seasons x both profiles
npm run test:offseason-soak -- --seeds 2 --seasons 3        # quick pass
npm run test:offseason-soak -- --seed 17 --profile busy --season 6 --phase free-agency   # replay one failure
```

Profiles:

- `auto`: the user team is delegated to the engine (Full Management).
- `busy`: the user team is manual, and every phase a seeded script fires extensions, releases, free-agent signings and trades, many of them deliberately illegal (wrong phase, retired player, player on another team, bad terms). A rejected action must leave the state it was given untouched; an applied one must not introduce invariant issues; a deliberately illegal one must not apply. Routine clicks (begin offseason, draft class, pick on the clock) still happen. The script draws from its own streams (`seed * 7919 + phaseIndex`), never from the engine RNG or `Math.random`.

Flags: `--seeds N` (8), `--seasons M` (12), `--seed-start S` (1; seeds are S..S+N-1), `--profile auto|busy|both` (both), `--max-season-ms T` (120000; a slower season is reported as `slow`), `--max-phase-days D` (400; a phase that does not advance is `stuck`), `--fail-fast`, `--verify-determinism` (runs the first seed twice per profile and compares `stateForComparison` digests at the end of every season), `--probe-salary-bounds` (busy only: also offer free agents salaries below the league minimum or above the maximum; off by default because the owner signing path does not validate them yet). Replay: `--seed X --season Y --phase P` (all three; accepts `free-agency`, `free_agency` or `offseason.free_agency`) re-runs only that seed and profile, prints every phase start snapshot and user action outcome, and stops after phase P of season Y. `--profile` and `--probe-salary-bounds` apply in replay too.

Each failure prints the seed, profile, season index and year, phase, the broken invariant codes and messages, a `snapshotOffseason` diff between the last good boundary and the failing state, the error and stack for engine exceptions, and a copy-paste replay command. The exit code is non-zero if anything failed.

Run time (one CBL league, this development machine, other work running): about 20-60 s per season, growing over the first seasons (roughly 20-25 s for season 1, 35 s for season 2, 40-60 s for season 3). `--seeds 2 --seasons 3` on both profiles (12 seasons) took about 7 minutes. The default 8 seeds x 12 seasons x 2 profiles is 192 seasons, so plan on 2 to 3 hours or more; use `--seeds`, `--seasons` and `--profile` to scale it down. Boundary checks cost under 0.2 s per season; the time is the engine's.

Run it before releases and after changing offseason, contract, free-agency, trade, draft or development code. When it reports a failure, run the printed replay command, fix the cause, then re-run the same seeds.

## Offseason balance bands

`npm run offseason:balance` measures offseason outcomes per season across seeds and checks them against tolerance bands in `tests/offseason/baselines.json`. It only measures and guards; it does not tune anything. A sim change that moves a metric outside its band fails with a message such as:

```
meanOverallChange[<=22] 2.31 is outside 2.23 +/- 0.40 (baseline tests/offseason/baselines.json). If this change is intentional, rerun with --write-baseline and commit the baseline on its own.
```

What is measured (definitions: `METRIC_SPECS` in `tests/offseason/balance-stats.ts`, collection in `tests/offseason/metrics.ts`): mean overall change by age bucket and the share of players at +3 or more, -3 or less and at the annual cap; 90+ players at preseason start (first, last, max); free agents left unsigned at preseason start; mean new-season salary of free-agency signings by overall tier; how often the best free agent signs with the highest-payroll team; star (80+) spread across teams; roster turnover; payroll to win % correlation, insolvency rate, cash after the offseason and mean payroll; rookie overall by pick group and the share of top-5 picks who are top-5 players on their team at the next preseason. Each seed is one delegated CBL league run by the real engine, one phase at a time.

```bash
npm run offseason:balance                                   # check: 4 seeds x 4 seasons, seeds 101-104
npm run offseason:balance -- --seed-start 201               # a different seed set (should also pass)
npm run offseason:balance -- --seeds 2 --seasons 20 --no-check   # 20-season inflation watch, informational
npm run offseason:balance -- --json out.json                # raw per-season samples plus aggregates
```

Flags: `--seeds N` (4), `--seasons M` (4), `--seed-start S` (101), `--workers N` (default min(seeds, 4); one child process per seed), `--json <path>`, `--write-baseline`, `--no-check` (print the table and exit 0 even when metrics are outside their bands). Exit code is non-zero when any metric is outside its band or no longer measured; metrics that are not in the baseline yet are listed but do not fail.

Tolerance rule: `max(3 * stdev across seeds, 0.10 * |baseline|, absolute floor)`, with the floor per metric unit (0.25 for overall-change means, 0.05 for shares, 1 for counts; see `METRIC_SPECS`). A metric that proved too noisy gets a larger floor and a `floorNote` there, which is copied to the baseline note.

Accepting a deliberate change: run `npm run offseason:balance -- --write-baseline` (needs 3 or more seeds; use the defaults so the baseline stays comparable) and commit the new `baselines.json` on its own, with the reason in the message, so the shift in the numbers is reviewable apart from the code change.

Run time: roughly 25 s for the first season of a league and more as it ages (up to a minute), seeds run in parallel, so the default 4 x 4 takes several minutes. The 20-season run (`--seasons 20 --seeds 2`) takes far longer and is for watching long-run inflation (90+ count, payroll, cash); it is informational, so use `--no-check`. The baseline only describes the 4-season window.

## Expectations for contributors

- Add tests with new simulation / domain logic.
- Keep tests deterministic and readable.
- Extend factories instead of inventing one-off objects.
- Do not rewrite the testing stack without updating `ARCHITECTURE.md` and this guide.
