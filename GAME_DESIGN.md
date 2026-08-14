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
- Player development
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

Systems expected later (do not treat as present until implemented):

- Game simulation — **implemented** (`src/systems/game-simulation.ts`)
- Season simulation — partial (phase set to regular with schedule; playoffs TBD)
- Calendar / advance day — **implemented** (`src/systems/world-pipeline.ts`)
- Player development
- Injuries
- Finances — payroll set at roster gen; advanced ticks TBD
- Standings — **implemented** (`src/systems/standings.ts`)
- Schedule generation — **implemented** (`src/systems/schedule-generation.ts`)
- Save/load (foundation persistence exists)
- Roster generation — **implemented** (`src/systems/roster-generation.ts`)

## Explicit non-goals for the foundation phase (superseded where implemented)

The original foundation phase deferred simulation. The following are now
**implemented** at a first-pass level:

- Roster generation (fictional players + contracts)
- Schedule generation (double round-robin)
- Calendar / advance day world pipeline
- Game simulation (box-score engine)
- Standings updates

Still deferred:

- Draft
- Trades
- Free agency
- Player development
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

**Potential** is stored separately as a developmental ceiling (`potential.overall`, same 1–99 scale). It is not derived from current attributes at runtime.

**Work ethic** is a personality trait only (`personality.workEthic`); it is not a current-ability attribute.

Personality, injury status, and development stage are player state only; they do not yet affect simulation composites or progression systems.

## Design rules

- Prefer real, tested foundation pieces over fake "working" placeholders.
- Keep mechanics documented here when introduced; keep technical structure in `ARCHITECTURE.md`.
- All content remains fictional and original.
