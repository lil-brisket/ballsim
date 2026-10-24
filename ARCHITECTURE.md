# Architecture

Authoritative technical architecture for this project.

When a significant architectural decision changes, update this document before or alongside the related implementation.

Before implementing a system, check `GAME_DESIGN.md` and this file for existing decisions and constraints.

## Technology stack (locked)

| Concern     | Choice                       |
| ----------- | ---------------------------- |
| Language    | TypeScript                   |
| App / UI    | Next.js (App Router) + React |
| Styling     | Tailwind CSS                 |
| Persistence | SQLite via Prisma            |
| Testing     | Vitest                       |

Do not change this stack unless a concrete technical limitation makes a choice unsuitable. Document the limitation and proposed change here before switching.

### Persistence driver note

Prisma ORM 7 requires a driver adapter. On this Windows environment, `better-sqlite3` failed to compile (missing MSVC C++ toolset). The foundation therefore uses `@prisma/adapter-libsql` + `@libsql/client` against a local SQLite file URL. This remains SQLite + Prisma; only the driver adapter differs from the common `better-sqlite3` path.

## Layering

```text
UI (Next.js app / components)
  -> Application (commands, GameService facades)
    -> Domain / Systems (GameState, entities, SystemResult, events, RNG)
      -> Persistence (Prisma SaveGame snapshot + SaveTeam/SavePlayer projections)
```

Rules:

- Simulation logic must not live in UI components.
- `src/domain`, `src/state`, and `src/systems` must not import `react`, `next`, or Prisma.
- Prisma models are a persistence mechanism only. They are **not** the source of truth for game mechanics.
- `GameState` is the authoritative in-memory / serialized game model for a save.
- **League phase authority:** `competition.phase.activePhaseId` is authoritative; `season.phase` / `offseasonStage` are derived compatibility fields.
- **Hard locks / transaction legality:** `src/systems/league-rules/` is the read-only rules façade (`canPerformAction`). It must not import `phase-engine` (avoids cycles). See `docs/HARD_LOCKS.md`.

## Directory map

```text
src/
  app/                 # Next.js routes and layouts (UI only)
  components/          # Presentational UI
  application/         # Use-cases / server commands
    game-service.ts    # Barrel: named re-exports of game-service/* (import from here)
    game-service/      # Owner use-cases by domain (save-lifecycle, owner-time-advance, trades-decisions, ...); internal.ts = shared helpers, not re-exported
    actions.ts         # Barrel (no directive): named re-exports of actions/*
    actions/           # "use server" modules, one per domain; shared.ts = non-async helpers (no directive)
  domain/              # Entities, events, RNG, SystemResult
  data/                # Static string pools (e.g. name lists); not typed domain catalogs
  presentation/        # UI-adjacent pure helpers (portrait fallback hash/overlay paths); not simulation, not React
  state/               # GameState composition + factories + selectors
    selectors.ts       # Barrel: named re-exports of selectors/* (dashboard, teams-roster, market, schedule, box-score, fantasy-draft)
    owner-dashboard.ts # toOwnerDashboardView + core builders; owner-dashboard/ holds types, trade-inbox, action items, metrics
  systems/             # Simulation systems (added incrementally)
  simulation/
    validation/        # Statistical validation harness (box-score aggregates; uses production simulateGame)
    lab/               # Simulation Lab / QA harness: runLabGames, scenarios, reports (wraps simulateGame / advanceSimulation)
    league-sanity/     # Multi-year career analytics
  persistence/         # Prisma client, repositories, mappers
    validate-game-state.ts   # validateGameState (body kept whole); validate-game-state/ holds the per-slice helper validators
    mappers/
      game-state-mapper.ts   # Envelope, MIGRATE_ONE_STEP dispatch, (de)serialize
      game-state-migrations/ # One-step migrations grouped by source version (v01-v07 ... v56-v65); shared.ts = cross-range legacy helpers
```

Typed domain catalogs such as `PlayerArchetype` and `PlayerNationality` live under `domain/entities/`, not `data/`. Name string pools (`first-names`, `last-names`) are expandable data under `src/data/names/`.

### Save schema history

Notes for each `GameState.schemaVersion` bump that changed persisted shape, oldest first. The current version is `GAME_STATE_SCHEMA_VERSION` in `src/state/game-state.ts`; migrations live in `src/persistence/mappers/game-state-mapper.ts`. Versions not listed here have no architecture-level notes.

`schemaVersion` 6 adds `Player.nationality`. Pre-nationality saves migrate with a fixed legacy default of `"USA"` (no RNG).

`schemaVersion` 7 adds Team relationship fields: conference ID, roster references, staff references, team finance placeholder, arena ID, and reputation. Legacy teams migrate with conference derived from division, empty roster/staff, `{}` finances, deterministic `arena_${teamId}`, and reputation `50`.

`schemaVersion` 9 extends `Game` with `periodScores` and expanded `GamePlayerStats` (FG/3PT/FT, OREB/DREB). Pre-v9 saves migrate with zeros and empty `periodScores`.

`schemaVersion` 10 adds `touches` to `GamePlayerStats`. Pre-v10 saves migrate with `touches: 0`.

`schemaVersion` 11 adds `Team.playStyle` (six 1–99 tendencies). Pre-v11 teams migrate with all-neutral values (`50`). The migration is lossless except for adding `playStyle` (no RNG, no other field changes).

`schemaVersion` 12 adds `Team.coachingPhilosophy` (discrete pace / offensiveEmphasis / defensiveApproach). Pre-v12 teams migrate with all-balanced defaults. Existing `playStyle` values are preserved exactly.

`schemaVersion` 13 expands `TeamStanding` (win %, points for/against/differential, streak, conference/division records). Pre-v13 saves recompute standings via `calculateStandings` from teams, games, and schedule.

`schemaVersion` 14 adds `competition.playoffs` (`PlayoffTournament`). Pre-v14 saves migrate with `createEmptyPlayoffTournament()` (`not_started`, empty field). Empty/inactive playoffs are valid; a missing or null `playoffs` field is not.

`schemaVersion` 15 adds `user.objectives` and `TeamFinances.revenue` / `expenses`. Pre-v15 saves migrate with `objectives: []` and `revenue: 0` / `expenses: 0`. Owner Mode exposes a derived non-persisted `OwnerGameState` view via `toOwnerGameState` — it is never a field on `GameState` and has no separate schema version. `toOwnerGameState(state)` derives a live-reference view (selected team, finances, roster, staff ids, league grouping).

`schemaVersion` 16 expands `Contract` from `salaryPerYear` / `yearsRemaining` to `startYear` / `endYear` / `salaryByYear` plus optional `teamOption` / `playerOption`. Pre-v16 contracts migrate using `competition.season.year` as `startYear`, expand flat salary across remaining years, and never invent options. Historical migration steps emit literal target schema versions (not the current `GAME_STATE_SCHEMA_VERSION` constant). Contract status is derived (not persisted). Salary-cap payroll is derived from contracts; `TeamFinances.payroll` remains a snapshot only.

`schemaVersion` 17 adds `business.freeAgency.offers`. Pre-v17 saves migrate with empty offers.

`schemaVersion` 18 adds `world.draftPicks` and `business.tradeBlocks`. Pre-v18 saves migrate with empty trade blocks and deterministic draft picks for the next three seasons via pure `generateDraftPicksForSeason` (no RNG). `originalTeamId` is immutable; only `ownerTeamId` changes in trades. Trade Block entries are references to existing players/picks (status on the entry only). The trade engine (`validateTrade` / `executeTrade`) is the only authoritative mutation path for player/pick trades.

`schemaVersion` 19 adds `world.drafts` (draft class aggregates: prospects, order, scouting, selections). Pre-v19 saves migrate with empty `drafts: {}`. Prospect snapshots live on the draft class until selection; selection inserts the reserved player id into `world.players`. `createDraft` / `activateDraft` / `makeDraftSelection` / `completeDraft` own the draft lifecycle. Selection does not consume RNG; order ownership for an active draft is `DraftOrderSlot.ownerTeamId` (pick-asset ownership is not mutated by the draft system).

`schemaVersion` 20 replaces scalar `TeamFinances.revenue` / `expenses` with period-keyed `booksByYear` (category revenue and posted expenses). Pre-v20 non-zero `revenue` maps to `books[seasonYear].revenue.other`; non-zero `expenses` maps to `books[seasonYear].expenses.operations`. Zeros are discarded. Player salary expense on financial statements is derived from contracts via `getTeamPayroll`; it is never stored in books. `cash` is unchanged by revenue/expense posting. `recordRevenue` / `recordExpense` are additive posts; `getFinancialStatement` derives totals and contract-based player salaries. Totals and `playerSalaries` are never persisted. `applyCashAndBooksImpact` posts books and adjusts `cash` by the same signed amount for gameplay consequences.

`schemaVersion` 21 adds the Owner Mode simulation backbone: `calendar.lastSimulatedDate` / `lastSimulatedWeekId`, `season.offseasonStage`, `world.scheduledEvents`, and `postseason` on `SeasonPhase`.

`schemaVersion` 22 adds Owner Mode gameplay: objective `status` / `seasonYear` / `consequenceApplied` (replacing `completed`), `user.notifications`, and `user.appliedGameplayConsequenceKeys` for idempotent financial and AI consequence guards. Phase B gameplay order inside `advanceSimulation` is: daily pipeline → AI team decisions → financial consequences → owner objectives → owner notifications.

`schemaVersion` 24 adds Phase E franchise depth under `business`: `staffContracts`, `sponsorships`, `franchiseOps` (operational knobs + slow metrics only — not a miscellaneous bucket), `leagueEconomy`, `relocationByTeamId`, `expansion`, and `franchiseHistory`. Calendar gains `lastSimulatedMonthId`. Facility upgrades post through existing `expenses.facilities` (no separate capex ledger). Live franchise value is a selector (`calculateFranchiseValue`), never a mutable live field. Demand is the sole attendance calculator. Media is event-driven only.

`schemaVersion` 25 adds top-level `GameState.settings` (`GameSettings`): league size/structure, regular-season games per team, playoff field/series/play-in, simulation frequency, AI difficulty (persisted for later use), and financial rule toggles. Pre-v25 saves reconstruct settings from the live league (e.g. 12-team CBL → 22 games / 8 playoff teams) rather than stamping Standard 30/82/16. Settings are configuration; runtime remains on world/competition/business/user. After expansion, do not treat `settings.league.teamCount` as the live team count.

`schemaVersion` 30 adds `user.narrative` (situations, lean month snapshots, cooldowns) for the owner narrative layer. Narrative interprets simulation state and emits stories/situations; it does not invent hidden simulation truth. Milestone `OwnerNotification`s remain separate.

`schemaVersion` 37 adds offseason stage entry dates (`offseasonStageEnteredDate`, `freeAgencyExtendedUntil`), configurable free-agency duration under `settings.offseason.freeAgency`, AI management/assist settings (`ai.managementMode`, `ai.assistance`), and user continuity records (`explicitDecisions`, `phaseSkips`). Pre-v37 saves migrate with `smart_assist` defaults, FA duration 30 days, and stage entry date set to `currentDate` when already in an offseason stage.

`schemaVersion` 65 adds `world.playerPortraits`: a persisted procedural portrait (`PlayerPortraitAssignment` — generator version, trait indices, collision salt) keyed by player / draft-prospect id. Pre-v65 saves migrate by running the pure `ensurePlayerPortraits` (no RNG, no I/O), so repeated loads of an un-resaved save show identical faces.

`schemaVersion` 66 adds `competition.playByPlay: Record<GameId, PlayByPlayLog>` (`src/domain/entities/play-by-play.ts`): a compact columnar log (player index table plus parallel `period` / `clock` / `poss` / `code` / `side` / `player` / `player2` arrays, ~6 KB per game) for the active owner team's possession-sim games of the current season, including play-in and playoff games (and Midseason Cup games in older saves; the cup is retired). Only main-competition games are recorded; Development League games are not. `simulateScheduledGame` sets `recordPlayByPlay` when the owner plays. Recording draws no RNG, so results are identical with or without it. `GameResult.playByPlay` only carries the log in memory; `storePlayByPlayLogs` writes it to the map, and `initializeNewSeason` clears it. From v66, finalized games no longer persist the thin `Game.events` array (it was never read and cost ~37 KB per possession game). Older saves keep their stored events, and `migrateV65ToV66` only adds an empty map. `validateGameState` requires every key to reference a final current-season game, checks the code table and `player2` rules, period and clock ranges, and that each player was in the game on the recorded side. It also replays the log to the exact final score, period scores and per-player points. Owner involvement is not validated, because a team can be sold mid-season.

`schemaVersion` 70 removes `Team.playStyle`. Nothing read it; `Team.coachingPhilosophy` carries team style. `migrateV69ToV70` deletes the field and changes nothing else. The legacy shape lives in `game-state-migrations/legacy-team-play-style.ts` for the v11 and v12 steps.

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

### Player portraits

- **Boundary:** `ensurePlayerPortraits` (`src/systems/portraits/`) is called in the application layer on every save write (`persistWorkingState`, `createNewOwnerSave`, `saveOwnerGame`). Any path that adds a player or prospect is covered there; systems don't call it. Failures are caught and logged, and the save proceeds without new portraits.
- **Identity:** traits come from FNV-1a over `saveId:playerId:salt`. This is a presentation hash, never domain RNG. Prospect ids carry over through selection, so a drafted rookie keeps their prospect portrait. Valid entries are never overwritten, and age, ratings, team and contract don't feed into the traits.
- **Uniqueness / exhaustion:** each new face avoids the trait signatures of active players (non-retired, plus prospects in drafts that aren't complete), trying up to 32 salts. If every salt collides, the salt-0 face is kept and flagged `duplicate: true`. `getPortraitCapacityReport` reports utilization.
- **Repair:** `npm run portraits:backfill` (`repairPlayerPortraits`) fills missing or invalid entries in every save, one CAS write per save. It can be re-run safely.
- **UI:** selectors attach `portrait` to player view models via `selectPlayerPortrait`. `PlayerPortrait` renders `PortraitFace` (inline SVG) when the entry is valid, and the initials plate otherwise. The optional raster overlay (`src`) still renders on top. Nothing is generated during render or page load.

### Watch Game (play-by-play)

- **Recording (systems):** `possession-resolution` pushes `PossessionPlay` rows next to its existing stat credits. Nothing extra happens unless `recordPlays` is set. `game-sim-state` stamps each row with the period, the clock when the possession started, and the possession number. `sim-bridge` records substitutions at rotation checkpoints. Assister, blocker, stealer and fouled player go in `player2` on the primary row, never as separate rows. The code table lives in `src/domain/entities/play-by-play.ts`.
- **Storage:** `competition.playByPlay` holds one log per owner game for the current season (see schema v66).
- **Decoding (state):** `src/state/watch-game-selectors.ts` turns a log into `WatchGameView` (`src/state/watch-game-view.ts`). That covers feed text, the running score, highlights (lead change, tie, 8-0 run, clutch, foul-out, and-one) and key moments. It also builds the live box score and the shot-type summary for any number of revealed plays. It only decodes and tallies; it holds no simulation logic.
- **UI:** the route is `/dashboard/[saveId]/games/[gameId]/watch`, loaded by `loadOwnerWatchGameView`. Its components live in `src/components/game/watch/`. `WatchGameClient` owns playback state (revealed count, playing, speed) and calls the pure selectors; nothing is simulated in the browser. Row view models carry a `canWatch` flag (`canWatchGame`), so the Watch links on the schedule, dashboard, league hub and box score only appear when a log exists.

Slice boundaries may be refined as domain models grow, but composition remains mandatory to avoid one undifferentiated mega-object.

`schemaVersion` enables save migrations as the model evolves. Roster building blocks such as `player-name-generation` and `player-attribute-generation` accept an injected `Rng`. The player-generation engine composes those blocks into a full `Player` via `generatePlayer(seed)` / `generatePlayerWithRng(rng)`. Roster generation owns slots, contracts, and payroll, and calls the player generator per slot. Annual player development: `developPlayer(player, rng)` returns a new `Player` (attribute-level change, derived overall, stage from age) and does not increment age. The offseason season tick (`processSeasonPlayerDevelopment`, run from the offseason lifecycle during season finalization) ages every player by one year and then calls `developPlayer`. Roster rules validation is a building block (`src/systems/roster-rules.ts`): `createRosterRulesConfig` / `validateRoster` throw on invalid configuration or assignment. Min/max size is independent of the starting/bench/inactive composition sum; a fully assigned roster must partition players so `players.length === startingLineupSize + benchSize + inactiveSize`. It does not mutate `GameState` or `Team`, and does not return `SystemResult`. Season schedule generation is a building block (`generateSeasonSchedule` in `src/systems/schedule-generation.ts`): config is `teamIds` + `seasonLength` (games per team); circle/Berger rounds with a separate home/away phase; `validateSeasonSchedule` checks invariants. Even team counts may use a prefix of the next round-robin cycle; odd team counts accept only complete cycles (`seasonLength` multiple of `n - 1`). The world adapter `generateSchedule(state)` uses `defaultSeasonLength` (double round-robin), maps each round to one shared calendar date, and returns `SystemResult`. No `Game.round` field — the calendar date is the time slot.

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

`SaveGame` Prisma envelope:

| Field           | Purpose                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| `id`            | Save identity                                                              |
| `name`          | Display name                                                               |
| `schemaVersion` | Serialized state schema version                                            |
| `stateGzip`     | gzip of the serialized authoritative `GameState` (written by every save)   |
| `stateJson`     | Legacy uncompressed snapshot; `""` once a save has been written compressed |
| `createdAt`     | Created timestamp                                                          |
| `updatedAt`     | Updated timestamp                                                          |

The snapshot (`stateGzip`, or `stateJson` for a row not yet re-saved) is the source of truth for simulation. Saves are compressed because every owner action loads and saves the whole league: a season-4 CBL league is about 20 MB of JSON and about 2 MB gzipped (fastest level, ~35 ms). Normalized child tables are **query projections** so listings (roster, team directory) do not need to parse the blob.

Listing indexes on `SaveGame`: `name` (filter/search) and `updatedAt` (`list()` is `orderBy: { updatedAt: "desc" }`). Child tables index `(saveGameId, …)` query paths (conference, team name, player team, player name, position). Composite primary keys already cover `saveGameId`. These migrations are additive (`CREATE INDEX` only) and do not rewrite existing `SaveGame` rows.

### Migrations and golden saves

Each one-step migration lives in `src/persistence/mappers/game-state-migrations/`, in the range file named for its source version. A new `migrateVnToVn+1` goes in the last range file (or a new range file) and must be registered in `MIGRATE_ONE_STEP` in `game-state-mapper.ts`.

`tests/fixtures/saves/vNN.json.gz` are genuine saves produced by the commit that introduced each schema version (v1, v5, v11, ..., v65). `tests/persistence/golden-saves.test.ts` loads every fixture through the full chain and `validateGameState`, and pins a sha256 of the migrated output. Adding a migration changes every digest by design: review the change, then update the snapshot with `-u`. To add or replace a fixture, add its commit to `scripts/generate-golden-saves.ts` and run `npx tsx scripts/generate-golden-saves.ts <version>`.

### Normalized query tables (current slice)

| Model        | Grain                    | Purpose                                                                                                          |
| ------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `SaveTeam`   | `(saveGameId, teamId)`   | Team directory: name, city, abbreviation, conference, division, arena, reputation                                |
| `SavePlayer` | `(saveGameId, playerId)` | Player directory: name, `teamId` (nullable FA), position, age, derived overall, potential, availability, retired |

`SavePlayer.teamId` is the domain team id, not a Prisma foreign key to `SaveTeam`. Writes replace all projection rows for a save; an FK would fight that replace-all pattern.

### Planned later slices (do not add until a UI query needs them)

| Model               | Likely grain           | Query need                                         |
| ------------------- | ---------------------- | -------------------------------------------------- |
| `SaveStanding`      | `(saveGameId, teamId)` | Standings pages without loading full `competition` |
| `SaveTeamFinance`   | `(saveGameId, teamId)` | Finance listings (cash / payroll snapshot)         |
| `SaveCompletedGame` | `(saveGameId, gameId)` | Scoreboard / recent-results lists                  |

Simulation, validation, and `schemaVersion` migrations continue to operate on `GameState` only. Prisma rows must never become a second mechanics model.

### Dual-write and backfill

`PrismaSaveGameStore` writes the compressed snapshot and projection rows in **one transaction** on `create` and `save`. Delete removes children then the envelope (cascade is also declared on the relations).

Load returns `deserializeGameState` of the snapshot (gunzipped `stateGzip`, else `stateJson`). If a legacy row has blob data but empty `SaveTeam` / `SavePlayer` tables, load **backfills** projections from that deserialized state and does not bump `SaveGame.updatedAt`.

`MemorySaveGameStore` stays blob-only; projection tables are a Prisma concern.

`projectSaveEntities` (`src/persistence/mappers/save-projection-mapper.ts`) is a pure mapper (domain ids sorted) used by the Prisma adapter. Overall on `SavePlayer` is derived via `calculatePlayerOverall` at write time.

### Migration strategy

1. Additive Prisma migrations only. Do not drop `stateJson`: rows saved before `stateGzip` existed keep their snapshot there until their next save. Rolling the code back past `stateGzip` therefore needs a step that writes `stateJson` back from `stateGzip` for every row.
2. Existing saves keep working: blob load path is unchanged; projections fill on next `save` or on first `load` backfill.
3. Do not backfill by rewriting `stateJson` or bumping `GameState.schemaVersion` for this change — it is a persistence-shape change, not a game-state schema change.
4. If a later slice adds more tables, follow the same dual-write + empty-table backfill pattern.
5. Rollback is dropping the new tables; `SaveGame` rows remain valid.

Application code depends on `SaveGameStore` (`list` / `create` / `load` / `loadHistory` / `save` / `delete`). Adapters:

- `PrismaSaveGameStore` — production (compressed snapshot + history chunks + `SaveTeam` / `SavePlayer` in one transaction)
- `MemorySaveGameStore` — tests (snapshot and history chunks in memory)

### Finished-season history

Every owner action loads and saves the whole league, so history that only grows would make every click slower over a career. `save` and `create` therefore split it off (`src/persistence/save-history.ts`):

- **Kept in the snapshot:** the current and previous seasons' archived games, and draft classes that are not complete or are from the current season. The simulation never reads further back (a regression test runs a full offseason from the snapshot alone and gets the same league), and "last season" is on many screens.
- **Moved to `SaveHistoryChunk`:** archived games of older seasons (one `games:<seasonId>` chunk per season) and older completed draft classes (`draft:<draftClassId>`), gzipped JSON. A finished season does not change, so a chunk is written once and never rewritten.
- **Read back:** `load` returns the snapshot only. Views of finished seasons (player careers and game logs, box scores, the record book, past schedules and the league hub) use `loadSaveWithHistory`, which calls `loadHistory` and merges with `withSaveHistory`. The online-league store only serves history after a load of the same save in the request.

The `GameState` shape is unchanged: `business.gameArchive` and `world.drafts` simply hold less at rest. Old saves split on their next save.

Compatibility wrappers (`createSaveGame`, `getSaveGame`, `updateSaveGameState`, `deleteSaveGame`, etc.) delegate to the Prisma store.

Save deletion is by `SaveGame.id` only. There is no user/session ownership check because the current save model is local/single-user; do not introduce a parallel authorization model here.

Owner Mode new-save is rejected when the current `SaveGame` row count is `>= MAX_OWNER_SAVE_SLOTS` (10). This is a current-row check in `createNewOwnerSave` (`list` then `create`), not a lifetime creation counter and not an atomic database constraint. Concurrent creates could theoretically exceed the cap; that is accepted for the current single-user local SQLite model. Multiplayer or multi-process creation would need an atomic reservation/transaction.

Save pipeline: `serializeGameState` (JSON.stringify) → parse clone → `validateGameState` → write blob + replace projection rows in one transaction.  
Load pipeline: read the snapshot (gunzip `stateGzip`, else `stateJson`) → JSON.parse → migrate → `validateGameState` → return `GameState`; backfill empty projection tables from that state.

`serializeGameState` and `deserializeGameState` must not call each other. Crash consistency beyond Prisma/SQLite’s existing guarantees is out of scope.

Load/save flow:

1. Application loads via `SaveGameStore`
2. Mapper deserializes the snapshot (gunzipped `stateGzip`, else `stateJson`) → migrate → validate → `GameState`
3. Systems produce `SystemResult`
4. Store validates a serialized clone, then writes it gzipped (`stateGzip`, with `stateJson` emptied) and the query projections in a single transaction

## Application ↔ UI communication

1. UI issues commands (Server Actions) such as create save / load save / advance day.
2. Application facades orchestrate persistence and systems.
3. UI receives serializable DTOs / snapshots derived from `GameState`.
4. UI never mutates domain state directly.

## World simulation & AI (architectural intent)

- Advance-day processing is a world pipeline (`runWorldPipeline`), not a single-team update.
- AI team decisions are implemented as a deterministic algorithmic layer under `systems/`, driven by shared franchise preferences (`resolveFranchisePreferences`):
  - `runAiTeamDecisions` (`src/systems/ai-team-decisions.ts`) runs in the daily owner-gameplay step: offseason free agency and draft picks, trades while the trade window is open, roster-management upkeep, development-league moves, and max-roster enforcement.
  - `runAiFranchiseDecisions` (`src/systems/ai-franchise-decisions.ts`) runs in the weekly pipeline: ticket and premium pricing, marketing budget, sponsorships, and facility upgrades.
  - Both skip user-owned franchises (`isUserControlledTeam`); only max-roster enforcement applies to every team. Owner-delegated AI assistance is configured separately (`src/systems/simulation/ai-assist-settings.ts`). Cap and legality rules stay hard constraints, and doing nothing is a valid outcome.
- LLMs are out of scope for core sim/decision loops unless explicitly justified later.

## Testing

- Vitest covers domain/state/persistence pure logic first.
- Important simulation logic must gain tests when introduced.
- Prefer testing systems with seeded `Rng` for reproducibility.
- Conventions, factories, React/jsdom isolation, and CI: [`docs/testing.md`](./docs/testing.md).
- **Simulation Lab** (`src/simulation/lab/`, `npm run sim`, `npm run test:simulation`) wraps production `simulateGame` / `advanceSimulation` / `runLeagueCareer`. It does not replace the engine. Rotation-on is the Lab default; `--rotation=off` is legacy CLI parity only. Game batches derive independent per-game seeds (`deriveSeed(master, "{scenarioId}:game:{n}")`) under `ENGINE_VERSION` in `src/simulation/lab/engine-version.ts` — bump that integer when output for a fixed seed changes. PR CI uses the `pr` exit policy (HARD_FAILURE only, unless opt-in KS or calibration checks FAIL). Nightly uses `--channel nightly` (HARD or statistical FAIL). Statistical baselines stay monitor-only until `evaluateGraduation` (±3×MAD over 5 nightly values). `runSimulationValidation` remains the throw-on-invariant statistical CLI. Lab aggregates report mean, 95% CI, and n; persisted game runs write `games.ndjson` for recomputation and `checkpoint.json` for `--resume`. `--jobs N` parallelizes rotation-off games only. `--sweep` samples a config space (grid / LHS / Sobol) and ranks parameters by Spearman |ρ| vs `team_points.mean`. `--baseline` / `--write-baseline` compare score distributions with a KS test; `--calibrate` checks NBA-inspired mean bands. `--config` / `--dry-run` / `--list-scenarios` inspect runs without simulating. Persisted runs append `results/index.json`; `--keep N` prunes older directories. Checksums ignore CI, KS, and calibration fields.
- Season RNG: `advanceSimulation` passes the live `Rng` into `processSeasonLifecycle` and `runWeeklyPipeline`. Those functions still accept an omitted rng for existing tests and reconstruct from `meta.rngState` in that case. Callers must persist `rng.getState()` into `meta.rngState` after `advanceSimulation`. `validateGameSettings` currently forces `playInEnabled: false`; play-in consumption is therefore latent, but the injector is in place.

## Risks

| Risk                            | Mitigation                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| Save format churn               | `schemaVersion` + explicit migrations                                                  |
| God-object state                | Typed slices (`meta` / `world` / `competition` / `business` / `user`)                  |
| JSON blob query limits          | Dual-write listing projections (`SaveTeam` / `SavePlayer`); blob remains authoritative |
| Logic leaking into UI           | Layer rules above; systems tested without React                                        |
| Non-determinism                 | Injected seeded `Rng`                                                                  |
| Prisma client in client bundles | Persistence modules use `server-only`                                                  |
| Scope creep                     | No fake systems; implement only requested features                                     |
