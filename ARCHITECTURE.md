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
  data/                # Static string pools (e.g. name lists); not typed domain catalogs
  state/               # GameState composition + factories + selectors
  systems/             # Simulation systems (added incrementally)
  simulation/
    validation/        # Statistical validation harness (box-score aggregates; uses production simulateGame)
  persistence/         # Prisma client, repositories, mappers
```

Typed domain catalogs such as `PlayerArchetype` and `PlayerNationality` live under `domain/entities/`, not `data/`. Name string pools (`first-names`, `last-names`) are expandable data under `src/data/names/`.

`schemaVersion` 6 adds `Player.nationality`. Pre-nationality saves migrate with a fixed legacy default of `"USA"` (no RNG).

`schemaVersion` 7 adds Team relationship fields: conference ID, roster references, staff references, team finance placeholder, arena ID, and reputation. Legacy teams migrate with conference derived from division, empty roster/staff, `{}` finances, deterministic `arena_${teamId}`, and reputation `50`.

`schemaVersion` 9 extends `Game` with `periodScores` and expanded `GamePlayerStats` (FG/3PT/FT, OREB/DREB). Pre-v9 saves migrate with zeros and empty `periodScores`.

`schemaVersion` 10 adds `touches` to `GamePlayerStats`. Pre-v10 saves migrate with `touches: 0`.

`schemaVersion` 11 adds `Team.playStyle` (six 1–99 tendencies). Pre-v11 teams migrate with all-neutral values (`50`). The migration is lossless except for adding `playStyle` (no RNG, no other field changes).

`schemaVersion` 12 adds `Team.coachingPhilosophy` (discrete pace / offensiveEmphasis / defensiveApproach). Pre-v12 teams migrate with all-balanced defaults. Existing `playStyle` values are preserved exactly.

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

`schemaVersion` enables save migrations as the model evolves. Roster building blocks such as `player-name-generation` and `player-attribute-generation` accept an injected `Rng`. The player-generation engine composes those blocks into a full `Player` via `generatePlayer(seed)` / `generatePlayerWithRng(rng)`. Roster generation owns slots, contracts, and payroll, and calls the player generator per slot. Annual player development is a building block: `developPlayer(player, rng)` returns a new `Player` (attribute-level change, derived overall, stage from age). It does not increment age; a future season tick should age players and then call `developPlayer`. It is not wired into `runWorldPipeline` yet. Roster rules validation is a building block (`src/systems/roster-rules.ts`): `createRosterRulesConfig` / `validateRoster` throw on invalid configuration or assignment. Min/max size is independent of the starting/bench/inactive composition sum; a fully assigned roster must partition players so `players.length === startingLineupSize + benchSize + inactiveSize`. It does not mutate `GameState` or `Team`, and does not return `SystemResult`. Season schedule generation is a building block (`generateSeasonSchedule` in `src/systems/schedule-generation.ts`): config is `teamIds` + `seasonLength` (games per team); circle/Berger rounds with a separate home/away phase; `validateSeasonSchedule` checks invariants. Even team counts may use a prefix of the next round-robin cycle; odd team counts accept only complete cycles (`seasonLength` multiple of `n - 1`). The world adapter `generateSchedule(state)` uses `defaultSeasonLength` (double round-robin), maps each round to one shared calendar date, and returns `SystemResult`. No `Game.round` field — the calendar date is the time slot.

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

### World pipeline (advance day)

`src/systems/world-pipeline.ts` orchestrates:

1. `bootstrapWorld` — roster generation + schedule generation when empty
2. `simulateGamesForDate` — possession-based `simulateGame` for each scheduled game on `calendar.currentDate`
3. `updateStandings` — rebuild W/L from final games
4. `advanceCalendar` — `currentDate + 1 day`

Application layer (`advanceOwnerDay`) reconstructs `Rng` from `meta.rngState`,
runs the pipeline, then writes `rng.getState()` back to `meta.rngState` before
persisting. Games for the **current** date are processed before the calendar ticks.

## RNG

`src/domain/rng` defines an `Rng` interface and a seeded Mulberry32 implementation.

- All stochastic systems receive RNG explicitly.
- `normalizeSeed` maps `number | string` to uint32 (`>>> 0` for numbers and
  canonical integer strings including leading zeros; FNV-1a for other strings).
- `Rng` exposes `next`, `nextInt`, `pick`, `chance`, and `getState`.
- `meta.rngSeed` stores the original seed; `meta.rngState` stores the live PRNG
  internal state so consecutive advances continue the stream.
- Reconstruct with `createSeededRng(state.meta.rngState)` after load.
- Invariant: `generatePlayer(seed) ≡ generatePlayerWithRng(createSeededRng(seed))`.
- Invariant: `developPlayer(player, createSeededRng(seed))` is reproducible for the same player and seed. Development consumes exactly 19 `nextInt` rolls in `PLAYER_ATTRIBUTE_KEYS` order.

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

1. UI issues commands (Server Actions) such as create save / load save / advance day.
2. Application facades orchestrate persistence and systems.
3. UI receives serializable DTOs / snapshots derived from `GameState`.
4. UI never mutates domain state directly.

## World simulation & AI (architectural intent)

- Advance-day processing is a world pipeline (`runWorldPipeline`), not a single-team update.
- AI team decisions remain a future algorithmic layer under `systems/` (not implemented).
- LLMs are out of scope for core sim/decision loops unless explicitly justified later.

## Testing

- Vitest covers domain/state/persistence pure logic first.
- Important simulation logic must gain tests when introduced.
- Prefer testing systems with seeded `Rng` for reproducibility.
- Conventions, factories, React/jsdom isolation, and CI: [`docs/testing.md`](./docs/testing.md).

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
