# Systems

Simulation systems belong here.

Each system should:

- Accept `GameState` (and explicit inputs / `Rng` when stochastic)
- Return `SystemResult` `{ state, events }`
- Avoid importing React, Next.js, or Prisma
- Prefer controlled/immutable state transitions

## Implemented

| Module | Role |
| --- | --- |
| `player-name-generation` | Building block: first name, last name, nationality from pools + RNG |
| `player-attribute-generation` | Building block: 1–99 attributes from position/archetype + RNG |
| `player-generation-config` | Locked generation ranges (age, quality, potential gaps, body, personality) |
| `player-generation` | Seeded engine: `generatePlayer(seed)` / `generatePlayerWithRng(rng)` → `Player` |
| `player-development-config` | Annual development ranges (stage/category deltas, taper, work ethic, caps) |
| `player-development` | Building block: `developPlayer(player, rng)` → new `Player` (one year, no aging) |
| `shot-resolution-config` | Tunable make-probability bounds and shot/defense/fatigue coefficients |
| `shot-resolution` | Building block: `calculateShotProbability(input)` / `resolveShot(input, rng)` → make/miss (no GameState) |
| `rebound-resolution-config` | Tunable position modifiers, variance amplitude, and defensive positioning multiplier |
| `rebound-resolution` | Building block: `playerReboundBaseStrength` / `resolveRebound(input, rng)` → OREB/DREB + rebounder (no GameState) |
| `pass-resolution-config` | Tunable pass-success and assist-opportunity bounds and coefficients (gameplay tuning, not realism) |
| `pass-resolution` | Building block: `calculatePassProbabilities(input)` / `resolvePass(input, rng)` → complete/turnover + assist-opportunity precursor (no GameState) |
| `foul-resolution-config` | Tunable team-foul bonus thresholds and free-throw counts (generic defaults, not NBA rules) |
| `foul-resolution` | Building block: `resolveFoul(input)` → consequences (`teamFoulsAfter`, `freeThrowsAwarded`, `basketCounts`); no RNG, no GameState, no Game mutation |
| `free-throw-resolution-config` | Tunable free-throw make-probability bounds |
| `free-throw-resolution` | Building block: `calculateFreeThrowProbability(input)` / `resolveFreeThrow(input, rng)` using `Player.attributes.freeThrow` (not `resolveShot`) |
| `roster-generation` | World-gen: roster slots + contracts; calls player-generation per slot |
| `roster-rules` | Building block: configurable roster size/position/group validation; throws `Error`, not `SystemResult` |
| `schedule-generation` | World-gen: double round-robin schedule |
| `game-simulation-config` | Tunable period lengths, possession time costs, decision weights |
| `game-clock` | Building block: simulated integer-second period clock (`consumeTime`) |
| `possession-decision-selection` | Building block: `choosePossessionDecision` → `PossessionDecision` (not outcome resolution) |
| `game-simulation` | `simulateGame` (possession orchestration → `GameResult` including `possessionCounts`) + `simulateGamesForDate` for the world pipeline |

Statistical box-score validation lives under `src/simulation/validation/` and is run via `npx tsx scripts/validate-simulation-stats.ts` (not a second simulation path).
| `standings` | Rebuild W/L from final games |
| `calendar` | Advance world date by one day |
| `world-pipeline` | `bootstrapWorld` + `runWorldPipeline({ type: "advanceDay" })` |

Advance day processes games for the **current** calendar date, updates standings, then ticks the calendar. Stochastic steps use the injected `Rng`; callers persist `rng.getState()` to `GameState.meta.rngState`.

`developPlayer` is a player-level building block (returns `Player`, not `SystemResult`). It recalculates `development.stage` from age, modifies attributes in `PLAYER_ATTRIBUTE_KEYS` order (19 RNG rolls), and leaves age unchanged. Injury status is ignored in v1. A future season tick should age players and then call this engine.

`roster-rules` is a validation building block (`createRosterRulesConfig` / `validateRoster`). A fully assigned roster is a partition: `players.length === startingLineupSize + benchSize + inactiveSize`. Min/max roster size is independent of that composition sum. Validators throw `Error` and do not mutate input, accept a `Team`, or look up GameState.

`resolveFoul` / `resolveFreeThrow` are resolution building blocks. Possession resolution composes them and emits `GameEvent`s / `PlayerStatsDelta`s. `simulateGame` applies each `PossessionResolution` exactly once via `applyPossessionResolution`, advances a simulated clock, and returns a self-contained `GameResult` for box scores.
