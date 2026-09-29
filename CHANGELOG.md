# Changelog

## Unreleased

### Persistence

- Dual-write `SaveTeam` / `SavePlayer` query projections next to `SaveGame.stateJson`.
- Additive Prisma migrations for those tables and for `SaveGame.name` / `SaveGame.updatedAt` listing indexes.
- Load backfills empty projection tables from the blob without changing `updatedAt`.

### Tooling

- Simulation Lab writes `results/<runId>/manifest.json` before the first game (`ENGINE_VERSION`, git SHA, resolved config, seed list). `npm run sim:compare` refuses mismatched engine versions. Game-mode RNG is per-game streams (`{scenarioId}:game:{n}`); bump `ENGINE_VERSION` when a change alters output for a fixed seed. Hard invariant failures write `results/<runId>/failures/<n>.ndjson` plus `<n>.json`; `npm run sim:replay` diffs a single game against that event log. Game-mode aggregates report mean, 95% CI, and n; persisted runs stream `results/<runId>/games.ndjson` and `checkpoint.json` (`--resume`). `--jobs N` parallelizes `--rotation=off` games; `--timeout-ms` bounds a game. `--sweep` samples a config space (grid / Latin hypercube / Sobol) and writes a Spearman sensitivity ranking. `--write-baseline` / `--baseline` compare score distributions with a two-sample KS test; `--calibrate` checks NBA-inspired mean bands. `--config` loads JSON defaults; `--dry-run` and `--list-scenarios` inspect without simulating. Persisted runs append `results/index.json`; `--keep N` prunes older directories. KS, calibration, and CI fields are omitted from the checksum.
- CI runs `npm run test:coverage`, uploads `coverage/` as an artifact, and sends LCOV to Codecov.
- Prettier (`format` / `format:check`) with `eslint-config-prettier`. CI also runs `format:check`.

### Dependencies (safe in-range)

- Prisma ORM 7.9.1 → 7.10.0 (`prisma`, `@prisma/client`, `@prisma/adapter-libsql`)
- Next.js 16.3.1 → 16.3.6 (security patch for GHSA-vcvr-r3jv-pc5j / `next/og`)
- `eslint-config-next` 16.3.1 → 16.3.6
- zod 4.4.3 → 4.6.5
- jsdom 30.0.1 → 30.1.1
- `@vitejs/plugin-react` 6.0.5 → 6.1.1
- `@testing-library/dom` 10.4.1 → 10.4.2
- `@testing-library/react` 16.3.2 → 16.3.3

### Deferred (majors / 0.x / React minor)

Do not apply these without a dedicated upgrade plan and test pass:

| Package              | Current | Blocked target | Why                                        |
| -------------------- | ------- | -------------- | ------------------------------------------ |
| React / react-dom    | 19.2.8  | 19.3.0         | Called out as a coordinated framework bump |
| `@types/node`        | 20.x    | 26.x           | Next.js 16 and CI stay on Node 20          |
| `@libsql/client`     | 0.17.4  | 0.18.0         | 0.x minor can break the Prisma adapter     |
| dotenv               | 17.x    | 18.x           | Major                                      |
| ESLint               | 9.x     | 10.x           | Major; `eslint-config-next` still on 9     |
| Vitest / coverage-v8 | 4.1.10  | 5.x            | Major runner change                        |
| Prisma               | 7.10.0  | 8.0.0-rc       | Pre-release major                          |
| TypeScript           | 5.x     | 7.x            | Major                                      |
