# Basketball

Fictional basketball simulation / management game (Owner Mode foundation).

## Stack

- TypeScript
- Next.js + React
- Tailwind CSS
- SQLite via Prisma (`@prisma/adapter-libsql`)
- Vitest

## Docs

- [`GAME_DESIGN.md`](./GAME_DESIGN.md) — authoritative game design
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — authoritative technical architecture
- [`CHANGELOG.md`](./CHANGELOG.md) — notable persistence, tooling, and dependency changes
- [`docs/testing.md`](./docs/testing.md) — Vitest layout, determinism, Simulation Lab, CI
- [`docs/test-catalog.md`](./docs/test-catalog.md) — what to run: Vitest projects, Lab CLI, file index

## Scripts

```bash
npm run dev
npm run lab                 # Simulation Lab UI at /dev/sim-lab
npm run lint
npm run format
npm run format:check
npm run db:migrate
npm run db:generate
```

## Tests

Suites live under `tests/`. `npm test` is unit + integration + React only. Lab 100-game batches and multi-year regression are separate.

```bash
npm test                     # unit + integration + react
npm run test:unit
npm run test:integration
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

`npm run test:coverage` writes `coverage/` (HTML + LCOV). CI uploads that folder as an artifact and sends `coverage/lcov.info` to Codecov. Set a `CODECOV_TOKEN` repository secret if the Codecov upload should authenticate (public tokenless upload may still work).

## Simulations

Simulation Lab wraps production `simulateGame` / `advanceSimulation`. Use the UI **or** the CLI — you do not need to play Owner Mode first.

### UI

```bash
npm run lab
```

Opens [`http://localhost:3000/dev/sim-lab`](http://localhost:3000/dev/sim-lab). Starts `npm run dev` if nothing is already listening on port 3000. Game batches, multi-season careers, and full schedule runs are tabs on that page.

If the app is already running, you can also visit `/dev/sim-lab` directly.

### CLI

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

## Environment

Copy `.env.example` to `.env` (already created for local SQLite):

```env
DATABASE_URL="file:./prisma/dev.db"
```
