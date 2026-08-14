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
| `roster-generation` | World-gen: fictional players + contracts per team |
| `schedule-generation` | World-gen: double round-robin schedule |
| `game-simulation` | Box-score sim for scheduled games on a date |
| `standings` | Rebuild W/L from final games |
| `calendar` | Advance world date by one day |
| `world-pipeline` | `bootstrapWorld` + `runWorldPipeline({ type: "advanceDay" })` |

Advance day processes games for the **current** calendar date, updates standings, then ticks the calendar. Stochastic steps use the injected `Rng`; callers persist `rng.getState()` to `GameState.meta.rngState`.
