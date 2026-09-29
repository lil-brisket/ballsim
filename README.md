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

25-season soak (skipped unless `STRESS=1`):

```bash
STRESS=1 npx vitest run tests/application/multi-year-simulation-stress.test.ts
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

```bash
npm run sim -- --seed=42 --games=100
npm run sim -- --seed=42 --scenario=superteam --rotation=off --channel=pr
npm run sim -- --seed=42 --mode owner-career --seasons 10 --channel nightly
```

Game-mode `--scenario` values: `normal`, `superteam`, `weak`, `shooting`, `rebounding`, `min-roster`, `matchup-90-40`, `injury-heavy`, `overtime`.

```bash
npm run bench:sim            # game cost model + season profiler
npm run bench:sim:game
npm run bench:sim:season
npm run sanity:league        # default 10 sims × 5 seasons
npm run sanity:compare -- baseline.json current.json
```

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
