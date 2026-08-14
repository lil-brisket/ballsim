# Architecture

Authoritative technical architecture for this project.

When a significant architectural decision changes, update this document before or alongside the related implementation.

Before implementing a system, check `GAME_DESIGN.md` and this file for existing decisions and constraints.

## Technology stack (locked)

| Concern | Choice |
| --- | --- |
| Language | TypeScript |
| App / UI | Next.js (App Router) + React |
| Styling | Tailwind CSS |
| Persistence | SQLite via Prisma |
| Testing | Vitest |

Do not change this stack unless a concrete technical limitation makes a choice unsuitable. Document the limitation and proposed change here before switching.

### Persistence driver note

Prisma ORM 7 requires a driver adapter. On this Windows environment, `better-sqlite3` failed to compile (missing MSVC C++ toolset). The foundation therefore uses `@prisma/adapter-libsql` + `@libsql/client` against a local SQLite file URL. This remains SQLite + Prisma; only the driver adapter differs from the common `better-sqlite3` path.

## Layering

```text
UI (Next.js app / components)
  -> Application (commands, GameService facades)
    -> Domain / Systems (GameState, entities, SystemResult, events, RNG)
      -> Persistence (Prisma SaveGame record; serialize GameState JSON)
```

Rules:

- Simulation logic must not live in UI components.
- `src/domain`, `src/state`, and `src/systems` must not import `react`, `next`, or Prisma.
- Prisma models are a persistence mechanism only. They are **not** the source of truth for game mechanics.
- `GameState` is the authoritative in-memory / serialized game model for a save.

## Directory map

```text
src/
  app/                 # Next.js routes and layouts (UI only)
  components/          # Presentational UI
  application/         # Use-cases / server commands
  domain/              # Entities, events, RNG, SystemResult
  state/               # GameState composition + factories + selectors
  systems/             # Simulation systems (added incrementally)
  persistence/         # Prisma client, repositories, mappers
```

## GameState (composed slices)

`GameState` is the single source of truth for one save, composed of typed slices:

```text
GameState
├── meta          # save identity, schemaVersion, timestamps, rng seed
├── world         # calendar, league structure, teams, people
├── competition   # season, schedule, games, standings
├── business      # contracts, finances
└── user          # controlled team, mode
```

Slice boundaries may be refined as domain models grow, but composition remains mandatory to avoid one undifferentiated mega-object.

`schemaVersion` enables save migrations as the model evolves.

## Systems and state transitions

Systems operate on `GameState` and return:

```ts
type SystemResult = {
  state: GameState;
  events: DomainEvent[];
};
```

Preferences:

- Immutable or otherwise controlled transitions (return next state; do not arbitrarily mutate shared references).
- Deterministic, testable, reproducible behavior.
- Stochastic systems must accept an injected `Rng` — never call `Math.random()` directly.

## RNG

`src/domain/rng` defines an `Rng` interface and a seeded implementation.

- All future stochastic systems receive RNG explicitly.
- Seeds live in `GameState.meta` so runs can be reproduced in tests and debugging.
- Foundation establishes the capability only; complex simulation randomness is not implemented yet.

## Domain events

Domain events are first-class. Systems publish events in `SystemResult.events` without coupling to UI.

Planned event types (types may exist early; producers are added with their systems):

- `GameCompleted`
- `PlayerInjured`
- `PlayerDeveloped`
- `PlayerDeclined`
- `ContractSigned`
- `PlayerTraded`
- `PlayerReleased`
- `DraftPickMade`
- `FreeAgentSigned`
- `CoachHired`

UI and other listeners consume events through application-layer orchestration later (news feed, notifications, etc.).

## Persistence

Initial `SaveGame` Prisma record:

| Field | Purpose |
| --- | --- |
| `id` | Save identity |
| `name` | Display name |
| `schemaVersion` | Serialized state schema version |
| `stateJson` | Serialized authoritative `GameState` |
| `createdAt` | Created timestamp |
| `updatedAt` | Updated timestamp |

Load/save flow:

1. Application loads `SaveGame`
2. Mapper deserializes `stateJson` -> `GameState`
3. Systems produce `SystemResult`
4. Mapper serializes `GameState` back to `stateJson` and updates the row

## Application ↔ UI communication

1. UI issues commands (Server Actions) such as create save / load save.
2. Application facades orchestrate persistence and (later) systems.
3. UI receives serializable DTOs / snapshots derived from `GameState`.
4. UI never mutates domain state directly.

## World simulation & AI (architectural intent)

Documented in `GAME_DESIGN.md` and mirrored here:

- Future advance-day processing is a world pipeline, not a single-team update.
- AI team decisions are an algorithmic layer under `systems/` (name TBD when introduced).
- LLMs are out of scope for core sim/decision loops unless explicitly justified later.

## Testing

- Vitest covers domain/state/persistence pure logic first.
- Important simulation logic must gain tests when introduced.
- Prefer testing systems with seeded `Rng` for reproducibility.

## Risks

| Risk | Mitigation |
| --- | --- |
| Save format churn | `schemaVersion` + explicit migrations |
| God-object state | Typed slices (`meta` / `world` / `competition` / `business` / `user`) |
| JSON blob query limits | Start with blob; extract query tables only when UI proves need |
| Logic leaking into UI | Layer rules above; systems tested without React |
| Non-determinism | Injected seeded `Rng` |
| Prisma client in client bundles | Persistence modules use `server-only` |
| Scope creep | No fake systems; implement only requested features |
