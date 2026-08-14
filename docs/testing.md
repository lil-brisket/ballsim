# Testing Guide

Concise conventions for unit, integration, and React tests in this project.

## Stack

| Layer | Tool |
| --- | --- |
| Runner | Vitest 4 |
| Path aliases | `vite-tsconfig-paths` (`@/*` → `src/*`) |
| Coverage | `@vitest/coverage-v8` |
| React (jsdom only) | `@testing-library/react` + `@testing-library/dom` |

Domain, state, systems, and persistence tests run in the **Node** Vitest project. Component smoke tests use the **React/jsdom** project. Do not add Jest or Playwright unless architecture is updated first.

## Commands

```bash
npm test              # vitest run (CI / one-shot)
npm run test:watch    # watch mode
npm run test:coverage # coverage report
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

## Determinism

Simulation correctness depends on reproducibility:

- Use `createSeededRng` / `createTestRng` — never `Math.random()` in sim or tests of sim.
- Pass `nowIso` and calendar `YYYY-MM-DD` — do not rely on `new Date()` in assertions.
- Use stable IDs in factories.
- Call `resetDomainEventSequenceForTests` (via `resetTestEventSequence`) when event IDs matter.
- Stochastic systems must accept an injected `Rng` (see `ARCHITECTURE.md`).

## React tests

- Only synchronous presentational components (or test-only smoke components under `tests/react/`).
- Do not Vitest-test async Server Components (e.g. `src/app/page.tsx`); use E2E later if needed.
- Keep React coverage minimal until client UI grows.

## CI

GitHub Actions (`.github/workflows/ci.yml`) on `push` / `pull_request`:

1. Node **20** (Next.js 16 requires `>=20.9.0`; `@types/node` is `^20`)
2. `npm ci`
3. `npx tsc --noEmit`
4. `npm run lint`
5. `npm test`
6. `npm run build` with `DATABASE_URL=file:./prisma/ci.db`

`next build` requires `DATABASE_URL` to be defined (Prisma client construction) but does **not** query the database during build for current dynamic routes. CI uses a real local SQLite `file:` URL, not a fake remote host. No migrate step is required for build today.

## Expectations for contributors

- Add tests with new simulation / domain logic.
- Keep tests deterministic and readable.
- Extend factories instead of inventing one-off objects.
- Do not rewrite the testing stack without updating `ARCHITECTURE.md` and this guide.
