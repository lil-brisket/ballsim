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

GitHub Actions (`.github/workflows/ci.yml`) on pushes to `master` and on every `pull_request`. Five jobs run in parallel on `ubuntu-latest`, each with Node **22** (matches `.nvmrc` and `engines.node >=22`; `@types/node` is `^22`) and `npm ci`. PR wall time is the slowest job.

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

## Expectations for contributors

- Add tests with new simulation / domain logic.
- Keep tests deterministic and readable.
- Extend factories instead of inventing one-off objects.
- Do not rewrite the testing stack without updating `ARCHITECTURE.md` and this guide.
