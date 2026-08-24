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

`schemaVersion` 13 expands `TeamStanding` (win %, points for/against/differential, streak, conference/division records). Pre-v13 saves recompute standings via `calculateStandings` from teams, games, and schedule.

`schemaVersion` 14 adds `competition.playoffs`. Pre-v14 saves migrate with an empty `PlayoffTournament` (`not_started`).

`schemaVersion` 15 adds `user.objectives` and `TeamFinances.revenue` / `expenses`. Pre-v15 saves migrate with `objectives: []` and `revenue: 0` / `expenses: 0`. Owner Mode exposes a derived non-persisted `OwnerGameState` view via `toOwnerGameState` — it is never a field on `GameState` and has no separate schema version.

`schemaVersion` 16 expands `Contract` from `salaryPerYear` / `yearsRemaining` to `startYear` / `endYear` / `salaryByYear` plus optional `teamOption` / `playerOption`. Pre-v16 contracts migrate using `competition.season.year` as `startYear`, expand flat salary across remaining years, and never invent options. Historical migration steps emit literal target schema versions (not the current `GAME_STATE_SCHEMA_VERSION` constant). Contract status is derived (not persisted). Salary-cap payroll is derived from contracts; `TeamFinances.payroll` remains a snapshot only.

`schemaVersion` 17 adds `business.freeAgency.offers`. Pre-v17 saves migrate with empty offers.

`schemaVersion` 18 adds `world.draftPicks` and `business.tradeBlocks`. Pre-v18 saves migrate with empty trade blocks and deterministic draft picks for the next three seasons via pure `generateDraftPicksForSeason` (no RNG). `originalTeamId` is immutable; only `ownerTeamId` changes in trades.

`schemaVersion` 19 adds `world.drafts` (draft class aggregates: prospects, order, scouting, selections). Pre-v19 saves migrate with empty `drafts: {}`. Prospect snapshots live on the draft class until selection; selection inserts the reserved player id into `world.players`.

`schemaVersion` 20 replaces scalar `TeamFinances.revenue` / `expenses` with period-keyed `booksByYear` (category revenue and posted expenses). Pre-v20 non-zero `revenue` maps to `books[seasonYear].revenue.other`; non-zero `expenses` maps to `books[seasonYear].expenses.operations`. Zeros are discarded. Player salary expense on financial statements is derived from contracts via `getTeamPayroll`; it is never stored in books. `cash` is unchanged by revenue/expense posting.

`schemaVersion` 21 adds the Owner Mode simulation backbone: `calendar.lastSimulatedDate` / `lastSimulatedWeekId`, `season.offseasonStage`, `world.scheduledEvents`, and `postseason` on `SeasonPhase`.

`schemaVersion` 22 adds Owner Mode gameplay: objective `status` / `seasonYear` / `consequenceApplied` (replacing `completed`), `user.notifications`, and `user.appliedGameplayConsequenceKeys` for idempotent financial and AI consequence guards.

### Owner Mode vertical slice (Phase C)

Production new games use a **12-team** league via `generateLeague` (`rosterSize: 0`) then `bootstrapWorld` / `generateRosters`. Placeholder `user.controlledTeamId` is the first sorted team id until `selectOwnerTeam` (allowed only while `calendar.lastSimulatedDate === null`).

Owner mutations go through transactional application commands in `game-service.ts` (load → restore RNG → validate/execute on a working copy → validate → write RNG → persist once; failures persist nothing). UI and Server Actions must not mutate `GameState` directly.

Rapid advance uses `advanceSimulation({ days, stopOnPhaseChange })` only. `stopOnPhaseChange` stops after the first day that changes `{ phase, offseasonStage, year }`. Do not use `simulateSeason` for Owner Mode. Draft-clock state is derived from the active draft order (never persisted). Offseason FA→draft uses `advanceOffseasonStage`; drafts auto-`completeDraft` when every order slot is used.

## GameState (composed slices)

`GameState` is the single source of truth for one save, composed of typed slices:

```text
GameState
├── meta          # save identity, schemaVersion, timestamps, rng seed/state
├── world         # calendar, league structure, teams, people, draft picks, drafts, scheduledEvents
├── competition   # season (phase + offseasonStage), schedule, games, standings, playoffs
├── business      # contracts, finances, free agency, trade blocks,
#                   staffContracts, sponsorships, franchiseOps, leagueEconomy,
#                   relocationByTeamId, expansion, franchiseHistory
└── user          # controlled team, mode, objectives, notifications, eventLog,
#                   appliedGameplayConsequenceKeys, narrative
```

`schemaVersion` 30 adds `user.narrative` (situations, lean month snapshots, cooldowns) for the owner narrative layer. Narrative interprets simulation state and emits stories/situations; it does not invent hidden simulation truth. Milestone `OwnerNotification`s remain separate.

`schemaVersion` 24 adds Phase E franchise depth under `business`: `staffContracts`, `sponsorships`, `franchiseOps` (operational knobs + slow metrics only — not a miscellaneous bucket), `leagueEconomy`, `relocationByTeamId`, `expansion`, and `franchiseHistory`. Calendar gains `lastSimulatedMonthId`. Facility upgrades post through existing `expenses.facilities` (no separate capex ledger). Live franchise value is a selector (`calculateFranchiseValue`), never a mutable live field. Demand is the sole attendance calculator. Media is event-driven only.

`schemaVersion` 25 adds top-level `GameState.settings` (`GameSettings`): league size/structure, regular-season games per team, playoff field/series/play-in, simulation frequency, AI difficulty (persisted for later use), and financial rule toggles. Pre-v25 saves reconstruct settings from the live league (e.g. 12-team CBL → 22 games / 8 playoff teams) rather than stamping Standard 30/82/16. Settings are configuration; runtime remains on world/competition/business/user. After expansion, do not treat `settings.league.teamCount` as the live team count.

`schemaVersion` 14 adds `competition.playoffs` (`PlayoffTournament`). Pre-v14 saves migrate with `createEmptyPlayoffTournament()` (`not_started`, empty field). Empty/inactive playoffs are valid; a missing or null `playoffs` field is not.

`schemaVersion` 15 adds owner objectives on `user.objectives` and extends `business.finances` with `revenue` and `expenses`. `toOwnerGameState(state)` derives a live-reference Owner Mode view (selected team, finances, roster, staff ids, league grouping). It must not be persisted independently.

`schemaVersion` 16 expands contracts under `business.contracts` to multi-year `salaryByYear` with optional team/player options. Cap space helpers derive payroll from contracts only.

`schemaVersion` 18 stores draft picks under `world.draftPicks` and trade-block listings under `business.tradeBlocks`. Trade Block entries are references to existing players/picks (status on the entry only). The trade engine (`validateTrade` / `executeTrade`) is the only authoritative mutation path for player/pick trades.

`schemaVersion` 19 stores draft classes under `world.drafts`. `createDraft` / `activateDraft` / `makeDraftSelection` / `completeDraft` own draft lifecycle. Selection does not consume RNG; order ownership for an active draft is `DraftOrderSlot.ownerTeamId` (pick-asset ownership is not mutated by the draft system).

`schemaVersion` 20 stores team accounting books under `business.finances[*].booksByYear`. `recordRevenue` / `recordExpense` are additive posts; `getFinancialStatement` derives totals and contract-based player salaries. Totals and `playerSalaries` are never persisted. `applyCashAndBooksImpact` posts books and adjusts `cash` by the same signed amount for gameplay consequences.

`schemaVersion` 22 stores owner notifications and applied gameplay consequence keys on `user`. Phase B gameplay order inside `advanceSimulation` is: daily pipeline → AI team decisions → financial consequences → owner objectives → owner notifications.

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

### Simulation ownership rule

Systems may calculate and return state changes. **Only** `advanceSimulation`
(`src/systems/simulation/advance-simulation.ts`) controls simulation ordering
and calendar advancement. Domain systems must not call `advanceCalendar`.

`transitionPhase` is the **sole writer** of `competition.season.phase`.
`generateSchedule` and `startPlayoffs` do not mutate phase.

Hierarchy:

```text
Application (advanceOwnerDay)
  → advanceSimulation
    → season/offseason lifecycle (season_finalization includes development tick)
    → scheduled events → daily pipeline
    → home ticket/merch/concessions revenue → fan sentiment
    → owner gameplay (AI → finances → objectives → notifications)
    → media from day events
    → advanceCalendar → weekly pipeline (staff + player payroll + facilities + marketing + media + AI franchise)
    → monthly pipeline on month boundary
    → narrative layer (once per day; cadences for daily/weekly/monthly/offseason; max 2 stories)
```

### World pipeline (advance day)

`runWorldPipeline({ type: "advanceDay" })` is a thin wrapper over
`advanceSimulation`. Per-day order:

1. Bootstrap rosters/draft picks if missing (not schedule)
2. Season + offseason lifecycle (may `transitionPhase`, generate schedule, start playoffs)
3. Process due `world.scheduledEvents` in `(triggerDate, id)` order
4. Daily pipeline — regular games and/or one playoff step; rebuild standings
5. Home game ticket / merchandise / concessions revenue (`HomeGameDaySettled`)
6. Daily fan sentiment
7. Owner gameplay — AI decisions, financial consequences, objective evaluation, notifications
8. Media bumps from the day's domain events
9. Record `calendar.lastSimulatedDate`
10. `advanceCalendar` — `currentDate + 1` (preserves progress markers)
11. Weekly pipeline when crossing ISO week (`lastSimulatedWeekId` = completed week): staff payroll, **player payroll cash**, facility opex/upgrades, marketing, media decay, AI franchise ops
12. Monthly pipeline on month boundary (sponsorships, reputation, broadcast, league economy)

`currentDate` is the date being simulated; after advance it is the next unprocessed day.

Season phases: `preseason | regular | playoffs | postseason | offseason`.
Allowed transitions only: preseason→regular, regular→playoffs|postseason,
playoffs→postseason, postseason→offseason, offseason→preseason.

Application layer (`advanceOwnerDay`) reconstructs `Rng` from `meta.rngState`,
runs `advanceSimulation`, then writes `rng.getState()` back to `meta.rngState`
before persisting. Result metadata (`phaseChanged`, `gamesSimulated`, …) is
returned for future Owner Mode UI.

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

Application code depends on `SaveGameStore` (`list` / `create` / `load` / `save` / `delete`). Adapters:

- `PrismaSaveGameStore` — production (single-row create/update of `stateJson`; `deleteMany` by id)
- `MemorySaveGameStore` — tests

Compatibility wrappers (`createSaveGame`, `getSaveGame`, `updateSaveGameState`, `deleteSaveGame`, etc.) delegate to the Prisma store.

Save deletion is by `SaveGame.id` only. There is no user/session ownership check because the current save model is local/single-user; do not introduce a parallel authorization model here.

Owner Mode new-save is rejected when the current `SaveGame` row count is `>= MAX_OWNER_SAVE_SLOTS` (10). This is a current-row check in `createNewOwnerSave` (`list` then `create`), not a lifetime creation counter and not an atomic database constraint. Concurrent creates could theoretically exceed the cap; that is accepted for the current single-user local SQLite model. Multiplayer or multi-process creation would need an atomic reservation/transaction.

Save pipeline: `serializeGameState` (JSON.stringify) → parse clone → `validateGameState` → write blob.  
Load pipeline: read `stateJson` → JSON.parse → migrate v1→v16 → `validateGameState` → return `GameState`.

`serializeGameState` and `deserializeGameState` must not call each other. Crash consistency beyond Prisma/SQLite’s existing guarantees is out of scope.

Load/save flow:

1. Application loads via `SaveGameStore`
2. Mapper deserializes `stateJson` → migrate → validate → `GameState`
3. Systems produce `SystemResult`
4. Store validates a serialized clone, then writes `stateJson` in a single row update

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
