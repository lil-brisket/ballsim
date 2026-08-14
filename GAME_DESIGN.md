# Game Design

Authoritative description of game mechanics and design constraints for this fictional basketball simulation/management game.

When a significant design decision changes, update this document before or alongside the related implementation.

## Premise

This is a fully fictional basketball simulation and management game.

- There are no real NBA teams, players, leagues, cities, or copyrighted assets.
- There are no traditional basketball graphics.
- Games are simulated through data, statistics, events, and text.

Working product title: **Basketball** (subject to rename).

## Modes

| Mode | Status | Description |
| --- | --- | --- |
| Owner Mode | Active foundation | Control a franchise as owner/front office |
| Career Mode | Future | Player or staff career progression |
| Dynasty Mode | Future | Long-horizon franchise legacy play |

## Owner Mode (current focus)

The player controls one team inside a larger simulated basketball world.

Near-term Owner Mode surfaces (UI destinations, not all implemented yet):

- Dashboard
- Roster
- Player Profile
- Schedule
- Standings
- Finances
- Team
- League
- Front Office

## World simulation (design intent)

The user's team is not isolated. "Advance day" processing updates the entire
world via `runWorldPipeline` in `src/systems/world-pipeline.ts`:

- Bootstrap roster/schedule if missing
- Simulate scheduled games for the current world date
- Rebuild standings
- Advance the calendar by one day

Still future work within that pipeline:

- Other AI team decisions
- Player development season tick (engine exists: `developPlayer`)
- Injuries
- Contract / finance ticks
- League events / news

## AI / decision layer (design intent)

Computer-controlled teams will eventually use an algorithmic decision layer for:

- Trades
- Free agency
- Draft decisions
- Lineups
- Player development
- Contracts
- Staff decisions

Constraints:

- Do **not** use an LLM for core basketball simulation or basic team decision logic unless a specific future feature clearly benefits from generative AI.
- Core simulation must remain deterministic, algorithmic, testable, and performant.

This AI decision layer is **not implemented** in the foundation phase.

## Domain concepts (planned)

Entities expected in the long-term model:

- Player, Team, League, Conference, Division
- Contract, Coach, Staff
- Game, Season, Schedule
- Finances

`Team.playStyle` holds six independent 1–99 play-style tendencies (`pace`, `threePointFrequency`, `insideFrequency`, `passing`, `defensiveAggression`, `offensiveFocus`). They are nested domain data only — simulation does not consume them yet. `offensiveFocus` stays abstract (not an offensive-system or player-role enum). All newly generated teams start neutral (`50`).

`Team.coachingPhilosophy` holds three discrete strategic dimensions (`pace`, `offensiveEmphasis`, `defensiveApproach`). Defaults are all `"balanced"`. Simulation applies modest modifiers from coaching philosophy on top of existing attribute-driven probabilities (tempo seconds, shot-selection weights, foul action weight, pass defensive pressure). Coaching does not change player ability ratings or shot/pass/rebound outcome formulas.

Systems expected later (do not treat as present until implemented):

- Game simulation — **implemented** (`src/systems/game-simulation.ts` possession orchestration → `GameResult`)
- Season simulation — partial (phase set to regular with schedule; playoffs TBD)
- Calendar / advance day — **implemented** (`src/systems/world-pipeline.ts`)
- Player development — **implemented** as a building block (`src/systems/player-development.ts`); not yet called from the world pipeline
- Injuries
- Finances — payroll set at roster gen; advanced ticks TBD
- Standings — **implemented** (`src/systems/standings.ts`)
- Schedule generation — **implemented** as building block `generateSeasonSchedule` + world adapter `generateSchedule` (`src/systems/schedule-generation.ts`); validates via `validateSeasonSchedule`
- Save/load (foundation persistence exists)
- Roster generation — **implemented** (`src/systems/roster-generation.ts`)
- Roster rules validation — **implemented** as a building block (`src/systems/roster-rules.ts`)

## Explicit non-goals for the foundation phase (superseded where implemented)

The original foundation phase deferred simulation. The following are now
**implemented** at a first-pass level:

- Roster generation (fictional players + contracts)
- Schedule generation (configurable games-per-team round robin; default double RR via world adapter)
- Calendar / advance day world pipeline
- Game simulation (possession-based engine with quarters/OT and `GameResult`)
- Standings updates
- Player development (annual attribute-level building block)
- Roster rules validation (configurable size, positions, starters/bench/inactive)

Still deferred:

- Draft
- Trades
- Free agency
- Player development season tick / aging operation
- Injuries
- Advanced finances
- AI team management
- Career Mode
- Dynasty Mode
- Narrative / news feed UI beyond recent results on the dashboard

## Player ability model

Players store current ability as category attributes on a **1–99** integer scale:

- Physical: speed, strength, athleticism, stamina
- Offensive: finishing, mid range, three point, free throw, ball handling, passing
- Defensive: perimeter defense, interior defense, steal, block, rebounding
- Mental: basketball IQ, offensive IQ, defensive IQ, consistency

**Potential** is stored separately as a developmental ceiling (`potential.overall`, same 1–99 scale). It is not derived from current attributes at runtime. During player generation:

1. Derive current overall from position + attributes (`calculatePlayerOverall`).
2. Roll an age-banded gap: young (`age <= 24`) 4–22; prime (`25–30`) 1–10; veteran (`age >= 31`) 0–5.
3. `potential.overall = clamp(currentOverall + gap, 1, 99)`.

**Quality** is a generation-time latent attribute-center (40–85). It is not stored on `Player` and is not current overall or potential.

**Position** (`PG` | `SG` | `SF` | `PF` | `C`) and **archetype** (machine-readable style tag such as `floor_general`) are stored on the player. Archetype influences how attributes are *generated* (position baseline + archetype modifiers + RNG). It is not the source of truth for ability and does not assign a stored overall rating. Attributes remain the ability model. Uncommon position/archetype pairs are allowed on stored players; compatibility is a generation constraint only.

**Nationality** is a typed catalog field on the player (same ownership pattern as archetype). It is selected during name generation and stored for identity/flavor. It does **not** yet affect attributes, tendencies, or simulation. Pre-nationality saves (schema versions before 6) migrate every player to `"USA"` deterministically — a fixed legacy compatibility default, not RNG-based generation.

**Work ethic** is a personality trait (`personality.workEthic`); it is not a current-ability attribute. It modestly scales **positive** development deltas only.

Personality, injury status, and development stage are stored on the player. Development stage is derived from age (`< 25` developing, `25–30` prime, `> 30` declining) during generation and again on each `developPlayer` call. Injury status does not affect v1 development. Other personality traits besides work ethic are reserved.

## Player development

`developPlayer(player, rng)` applies **one year** of development at the player's current age. It does not increment age. A future season/aging system should advance age, then call this engine.

Current ability develops toward `potential.overall`, which is a ceiling (not raised by normal development). After a development step, derived overall must remain `<= potential.overall`. Overall is never stored or edited directly; attributes change, then `calculatePlayerOverall` is recomputed.

Behavior by stage:

- **Developing** (age < 25): strongest positive opportunity, tapered by remaining potential (`potential.overall - currentOverall`).
- **Prime** (25–30): generally stable, with small improvement, hold, or isolated decline.
- **Declining** (age > 30): gradual decline; physical attributes trend down more than skills; mental attributes are more stable. A 31-year-old should not collapse in one year.

Each of the 19 attributes in `PLAYER_ATTRIBUTE_KEYS` receives one seeded integer roll. Positive deltas are scaled by remaining-potential taper and work ethic, then clamped. High work ethic does not guarantee improvement; low work ethic does not forbid it.

Constants live in `src/systems/player-development-config.ts`.

## Offensive usage and role (v1)

Offensive involvement is differentiated among the **on-court eligible pool** passed into `choosePossessionDecision`. There is no second simulation path: usage changes **who** is selected; existing shot/pass/rebound/foul/FT resolvers and `actionBaseWeights` are unchanged.

Conceptual layers (do not collapse them):

```text
Player attributes
      ↓
  usageScore          general offensive-involvement score (not a shot/pass %)
      ↓
 offensive role       derived, ephemeral rank in the eligible pool
      ↓
 ┌────┴────┐
 ↓         ↓
shot      pass        usageScore × roleMult × scoring|creation, then normalize
weight    weight
```

- **usageScore** mixes scoring ability, creation ability, ball handling, and offensive IQ (config in `player-usage-config.ts`), floored by `USAGE_SCORE_FLOOR`.
- **Roles** (`primary_creator`, `secondary_creator`, `scorer`, `role_player`, `low_usage`) are assigned by usageScore rank inside the pool. Players outside the pool are `bench` and are not ranked. Roles are never stored on `Player`.
- Role multipliers are modest so attributes dominate (e.g. a 90-rated role player still out-weights a 50-rated primary).
- **Receiver** selection uses shot weight (passes toward scoring threats) and does **not** change pass completion probability.
- Team depth is the normalize step: adding another high-usage teammate reduces existing shares. No fixed superstar percentages.

**Touches** are box-score instrumentation only (`GamePlayerStats.touches`). A touch is meaningful on-ball offensive involvement. A player gets **at most one touch per possession** (overlapping events dedup). Touches do not influence selection or resolution. Shooting fouls credit the fouled shooter once whether or not an FGA is recorded; completed-pass receivers are the only success-dependent credit.

## Design rules

- Prefer real, tested foundation pieces over fake "working" placeholders.
- Keep mechanics documented here when introduced; keep technical structure in `ARCHITECTURE.md`.
- All content remains fictional and original.
