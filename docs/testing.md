# Testing Guide

Concise conventions for unit, integration, and React tests in this project.

## Stack

| Layer              | Tool                                              |
| ------------------ | ------------------------------------------------- |
| Runner             | Vitest 4                                          |
| Path aliases       | `vite-tsconfig-paths` (`@/*` → `src/*`)           |
| Coverage           | `@vitest/coverage-v8`                             |
| React (jsdom only) | `@testing-library/react` + `@testing-library/dom` |

Domain, state, systems, and persistence tests run in the **Node** Vitest project. Component smoke tests use the **React/jsdom** project. Do not add Jest or Playwright unless architecture is updated first.

## Commands

```bash
npm test                 # vitest run (CI / one-shot: unit + integration + react)
npm run test:simulation  # Lab 100-game rotation-on + season RNG (PR CI; not in npm test)
npm run test:watch       # watch mode
npm run test:coverage    # same projects as npm test, plus v8 coverage (text/html/lcov)
npm run sim -- --seed=42 --games=100   # Simulation Lab CLI (default --channel pr)
```

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

`src/simulation/lab/` wraps production `simulateGame` / `advanceSimulation`. Fast Lab unit tests (mapper, 2-game checksum, planted failure, scenarios) stay in `npm test`. The 100-game rotation-on suite and season RNG check run via `npm run test:simulation` (PR CI). Statistical FAIL does not fail the `pr` channel; `--channel nightly` does.

## React tests

- Only synchronous presentational components (or test-only smoke components under `tests/react/`).
- Do not Vitest-test async Server Components (e.g. `src/app/page.tsx`); use E2E later if needed.
- Keep React coverage minimal until client UI grows.

## CI

GitHub Actions (`.github/workflows/ci.yml`) on `push` / `pull_request`:

1. Node **20** (Next.js 16 requires `>=20.9.0`; `@types/node` is `^20`)
2. `npm ci`
3. `npx tsc --noEmit`
4. `npm run lint` (stylistic rules deferred to Prettier via `eslint-config-prettier`)
5. `npm run format:check`
6. `npm run test:coverage` (unit + integration + react, writes `coverage/lcov.info`)
7. `npm run test:simulation` (Lab rotation-on 100 games, season RNG)
8. Upload `coverage/` as a workflow artifact (`coverage-report`)
9. Upload `coverage/lcov.info` to Codecov (`codecov/codecov-action@v5`; optional `CODECOV_TOKEN` repo secret)
10. `npm run build` with `DATABASE_URL=file:./prisma/ci.db`

Coverage HTML/LCOV live under `coverage/` (gitignored). Codecov project/patch status is configured in `codecov.yml` (auto target, 2% project drop tolerance; patch is informational).

`next build` requires `DATABASE_URL` to be defined (Prisma client construction) but does **not** query the database during build for current dynamic routes. CI uses a real local SQLite `file:` URL, not a fake remote host. No migrate step is required for build today. Prisma adapter tests apply migrations themselves against a temp file.

## Expectations for contributors

- Add tests with new simulation / domain logic.
- Keep tests deterministic and readable.
- Extend factories instead of inventing one-off objects.
- Do not rewrite the testing stack without updating `ARCHITECTURE.md` and this guide.
