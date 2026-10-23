# Changelog

## Unreleased

### Persistence

- Dual-write `SaveTeam` / `SavePlayer` query projections next to `SaveGame.stateJson`.
- Additive Prisma migrations for those tables and for `SaveGame.name` / `SaveGame.updatedAt` listing indexes.
- Load backfills empty projection tables from the blob without changing `updatedAt`.

### Tooling

- Simulation Lab writes `results/<runId>/manifest.json` before the first game (`ENGINE_VERSION`, git SHA, resolved config, seed list). `npm run sim:compare` refuses mismatched engine versions. Game-mode RNG is per-game streams (`{scenarioId}:game:{n}`); bump `ENGINE_VERSION` when a change alters output for a fixed seed. Hard invariant failures write `results/<runId>/failures/<n>.ndjson` plus `<n>.json`; `npm run sim:replay` diffs a single game against that event log. Game-mode aggregates report mean, 95% CI, and n; persisted runs stream `results/<runId>/games.ndjson` and `checkpoint.json` (`--resume`). `--jobs N` parallelizes `--rotation=off` games; `--timeout-ms` bounds a game. `--sweep` samples a config space (grid / Latin hypercube / Sobol) and writes a Spearman sensitivity ranking. `--write-baseline` / `--baseline` compare score distributions with a two-sample KS test; `--calibrate` checks NBA-inspired mean bands. `--config` loads JSON defaults; `--dry-run` and `--list-scenarios` inspect without simulating. Persisted runs append `results/index.json`; `--keep N` prunes older directories. KS, calibration, and CI fields are omitted from the checksum.
- CI runs as parallel jobs (`static`, `test`, `slow`, `simulation`, `build`) on pushes to `master` and on pull requests. `test` runs `npm run test:coverage` and uploads `coverage/` as an artifact; there is no coverage service. Actions are on v7 (Node 24 runtime).
- New `slow` Vitest tier: `tests/**/*.slow.test.ts`, run by `npm run test:slow` and its own CI job, not by `npm test`. Suites with timeouts over 30s moved from `unit` to `integration`. `npm test` drops from about 229s to about 58s locally.
- `PERF_BUDGET_MODE=warn` makes the performance-budget wall-clock limits warn-only (PR CI); they stay strict locally and nightly.
- Prettier (`format` / `format:check`) with `eslint-config-prettier`. CI also runs `format:check`.
- Vitest resolves `@/*` with Vite's native `resolve.tsconfigPaths` instead of the `vite-tsconfig-paths` plugin (removed). That plugin shared one stateful instance across all test projects and is the suspected cause of intermittent `reading 'config'` import failures (#96).
- `test-results.txt` keeps the full stack for module-collection failures and unhandled errors, and failing runs also write `test-results.last-failure.txt`, which a later passing run does not overwrite.

### Dependencies (safe in-range)

- Prisma ORM 7.9.1 → 7.10.0 (`prisma`, `@prisma/client`, `@prisma/adapter-libsql`)
- Next.js 16.3.1 → 16.3.6 (security patch for GHSA-vcvr-r3jv-pc5j / `next/og`)
- `eslint-config-next` 16.3.1 → 16.3.6
- zod 4.4.3 → 4.6.5
- jsdom 30.0.1 → 30.1.1
- `@vitejs/plugin-react` 6.0.5 → 6.1.1
- `@testing-library/dom` 10.4.1 → 10.4.2
- `@testing-library/react` 16.3.2 → 16.3.3

### Dependencies (majors)

- Next.js 16.4.3 and `eslint-config-next` 16.4.3; npm audit advisories cleared (#172)
- React / react-dom 19.3.1, fast-check 4, dotenv 18 (#173)
- Vitest and `@vitest/coverage-v8` 5 (#174)
- TypeScript 6.0, pinned `~6.0.3` (#176)
- Node 24: `.nvmrc`, `engines.node >=24`, `@types/node ^24` and both CI workflows (#177)
- ESLint 10 (#177). npm warns about the peer ranges of the React, jsx-a11y and import plugins; lint output is unchanged.

### Deferred

Do not apply these without a dedicated upgrade plan and test pass:

| Package          | Current | Blocked target | Why                                            |
| ---------------- | ------- | -------------- | ---------------------------------------------- |
| TypeScript       | 6.0.x   | 7.x            | typescript-eslint peer range is `<6.1.0`       |
| Prisma           | 7.10.x  | 8.x            | Pre-release rewrite with no libsql adapter yet |
| `@libsql/client` | 0.17.4  | 0.18.x         | `@prisma/adapter-libsql` 7.x requires `^0.17`  |
