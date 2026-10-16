# Test speed baseline

Measured on 2026-10-15/16 on a Windows 11 dev machine (Node 22, Vitest 4) with `--reporter=json`. Durations are per-test sums from the JSON report, so the files in a project add up to more than the wall time. Wall times vary by roughly 2× between runs on this machine, so read small differences as noise.

## Wall time

| Run                                     | Before                                          | After                                                 |
| --------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- |
| `npm test` (unit + integration + react) | 229s (2 tests failing, 8 files failing to load) | 58s (113s on a first, colder run); all 414 files pass |
| `npm run test:slow` (new)               | n/a                                             | 150s, 4 files                                         |
| `npm run test:simulation`               | 75s                                             | unchanged                                             |
| `npm run test:coverage`                 | not measured                                    | 85s, 71.9% lines                                      |
| `npm run test:regression`               | 2652s (44 min), 2 failing                       | unchanged (nightly only)                              |

## Why `npm test` was slow

Its wall time was set by three single files, not by the many medium ones:

| File                                                                                             | Tier before | Time | Now                                   |
| ------------------------------------------------------------------------------------------------ | ----------- | ---- | ------------------------------------- |
| `tests/application/owner-vertical-slice.test.ts`                                                 | integration | 218s | `slow` (`*.slow.test.ts`)             |
| `tests/systems/franchise-identity-persistence.test.ts`                                           | unit        | 195s | `slow`                                |
| `tests/state/create-initial-state-league-area.test.ts` (one 1-season smoke test)                 | unit        | 132s | that test split into a `slow` sibling |
| `tests/systems/world-pipeline.test.ts` (RNG continuation test, 38s, timed out at 30s under load) | unit        | 38s  | that test split into a `slow` sibling |

Moving files between `unit` and `integration` does not change `npm test`, which runs both. Only leaving `npm test` does.

## Slowest files after the change (`npm test`)

| Sum   | Project | File                                                  |
| ----- | ------- | ----------------------------------------------------- |
| 21.8s | unit    | `tests/systems/simulation/advance-simulation.test.ts` |
| 19.1s | unit    | `tests/application/simulate-to-date.test.ts`          |
| 14.4s | unit    | `tests/systems/ai-team-decisions.test.ts`             |

## Cached world helper (plan Task 2): dropped

- `bootstrapWorld` takes about 7–27ms per call. `structuredClone` of the result takes about 7ms, so a cache would save almost nothing per call.
- All 281 calls together cost a few seconds of CPU across the whole run.
- Almost no test shares a `saveId` and seed (one file does). `saveId` feeds `leagueId`, `seasonId` and portrait assignment, so a cache keyed without it would not reproduce the same world.

The long tests are long because they simulate whole seasons, not because of setup.

## Side findings

- The domain event counter never shows up in event ids under Node 22: `createDomainEvent` uses `crypto.randomUUID()`. `resetDomainEventSequenceForTests` therefore has no observable effect today.
- The two `multi-year-simulation` regression failures ("Simulation failed to progress", `STACK_TRACE_ERROR`) were already failing and are not addressed here.
