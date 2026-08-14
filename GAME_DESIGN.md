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

The user's team is not isolated. Future "advance day" processing should eventually be capable of updating the entire world, including:

- Other teams
- Other games
- AI team decisions
- Player development
- Injuries
- Contracts
- Finances
- League events
- News/events

This world-processing pipeline is **not implemented** in the foundation phase.

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

- Game simulation
- Season simulation
- Calendar / advance day
- Player development
- Injuries
- Finances
- Standings
- Schedule generation
- Save/load (foundation persistence exists; simulation systems do not)

## Explicit non-goals for the foundation phase

Do not implement yet:

- Basketball game simulation
- Season simulation
- Draft
- Trades
- Free agency
- Player development
- Injuries
- Advanced finances
- AI team management
- Career Mode
- Dynasty Mode

## Design rules

- Prefer real, tested foundation pieces over fake "working" placeholders.
- Keep mechanics documented here when introduced; keep technical structure in `ARCHITECTURE.md`.
- All content remains fictional and original.
