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
| `roster-generation` | World-gen: roster slots + contracts; calls player-generation per slot |
| `schedule-generation` | World-gen: double round-robin schedule |
| `game-simulation` | Box-score sim for scheduled games on a date |
| `standings` | Rebuild W/L from final games |
| `calendar` | Advance world date by one day |
| `world-pipeline` | `bootstrapWorld` + `runWorldPipeline({ type: "advanceDay" })` |

Advance day processes games for the **current** calendar date, updates standings, then ticks the calendar. Stochastic steps use the injected `Rng`; callers persist `rng.getState()` to `GameState.meta.rngState`.

`developPlayer` is a player-level building block (returns `Player`, not `SystemResult`). It recalculates `development.stage` from age, modifies attributes in `PLAYER_ATTRIBUTE_KEYS` order (19 RNG rolls), and leaves age unchanged. Injury status is ignored in v1. A future season tick should age players and then call this engine.
