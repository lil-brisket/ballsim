# Ballsim

Ballsim is a basketball franchise management game for the browser. You own a team in a fully fictional league: you set ticket prices and budgets, hire staff, sign free agents, make trades and draft picks, and watch the results play out across many seasons. Every game is simulated possession by possession from player ratings, coaching and fatigue, and is shown as box scores, play-by-play and standings. Your own games can also be replayed on a simple SVG court drawn from the recorded play-by-play; it is a presentation layer, not a second simulation. The simulation uses a seeded RNG, so the same save and the same seed always produce the same league. All teams, players, cities and leagues are generated; nothing is based on real people or licensed assets.

## Screenshots

> Placeholder. Capture these screens from a Standard (30-team) save in its first regular season, and save them as PNGs under `docs/screenshots/`.

1. **Splash and mode select** (`/` and `/home`)
2. **Game setup** (`/new/setup?mode=owner`), with the Standard preset and the roster source options visible
3. **Choose your franchise location**, the city map (`/new/<saveId>/team`)
4. **Owner dashboard** (`/dashboard/<saveId>`) in mid-season, with the action center and notifications
5. **Calendar** (`/dashboard/<saveId>/calendar`) with the "Simulate to date" confirmation open
6. **Game page** (`/dashboard/<saveId>/games/<gameId>`), showing the box score and play-by-play of a close game
7. **Standings** (`/dashboard/<saveId>/standings`)
8. **Finances** (`/dashboard/<saveId>/finances`), showing the season revenue and expense breakdown
9. **Trade negotiation** (`/dashboard/<saveId>/trades/<decisionId>/negotiate`)
10. **Draft board** (`/dashboard/<saveId>/draft`) during the offseason draft
11. **Player profile** (`/dashboard/<saveId>/players/<playerId>`), with a procedural portrait and career stats
12. **Simulation Lab** (`/dev/sim-lab`) after a 100-game batch

## Features

- **Owner Mode.** Run one franchise, or several at once, inside a living league:
  - **Business:** finances, ticket pricing, marketing, sponsorships, facilities, media, relocation and league expansion.
  - **Basketball operations:** roster, rotations and lineups, coaching staff, trades, free agency, scouting, the draft and a development league.
  - **Owner objectives:** season goals and ownership confidence.
- **Flexible league setup.** Start from the Standard preset (30 teams, 82 games, 16 playoff teams, best-of-7) or the compact CBL preset (12 / 22 / 8), or tune team count, conferences, schedule length, playoff format, salary cap, luxury tax and revenue sharing yourself. Rosters can be generated, built through a fantasy draft or imported as a custom roster package, and you can generate prior league history before your first season.
- **Possession-level game simulation.** Shots, passes, fouls, rebounds, injuries and fatigue are resolved from player attributes and team tendencies. A faster box-score mode, calibrated against the possession engine, is available for long simulations.
- **A league that runs without you.** AI teams sign free agents, draft, trade and manage their own business. Players age, develop, decline and retire. Awards, the All-Star game, fan voting, conference-based playoffs and franchise history are tracked season after season.
- **Simulation Lab.** A developer UI and CLI (`npm run lab`, `npm run sim`) for running seeded batches of games or multi-season careers, checking invariants and calibration bands, and comparing runs.
- **Procedural portraits.** Every player gets a unique generated SVG headshot that stays with them for their whole career.

## Quick start

Requires **Node 22** (see `.nvmrc`).

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # local SQLite: DATABASE_URL="file:./prisma/dev.db"
npm run db:migrate          # creates prisma/dev.db and applies migrations
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Your first season

1. **Start a career.** On the splash screen click through to **Choose your mode** and pick **Owner Mode**.
2. **Set up the league.** On **Game setup**, keep the **Standard** preset for a full-size league (or pick **CBL** for a quick 12-team season), choose a roster source (**Generated roster** is the simplest), give the save a name, and confirm.
3. **Pick your franchise.** Choose a city on the map, then set the team name, colors and logo. If you chose a fantasy draft, you draft your roster next.
4. **Get your bearings.** The dashboard shows the next game, your objectives and anything that needs a decision. Check **Roster**, **Team management → Rotations** and **Finances** before the season starts.
5. **Advance time.** From the **Calendar** you can simulate one day, **Simulate to next game**, **Simulate to date**, or **Advance phase** to jump to the next part of the season. The sim stops when a decision needs you, for example an incoming trade offer.
6. **Manage as you go.** Adjust ticket prices and marketing, answer trade offers, and watch fan sentiment and cash. Open any finished game to read its box score.
7. **Playoffs and offseason.** After the regular season come the playoffs, then the offseason: re-sign or release players in **Contracts**, bid in **Free agency**, scout and make your picks in the **Draft**, then advance into next season's preseason.

## Development

```bash
npm run dev            # app at http://localhost:3000
npm run lab            # Simulation Lab at /dev/sim-lab
npm test               # unit + integration + React tests
npm run lint
npm run format:check
npx tsc --noEmit
```

The full list of scripts, test suites, Simulation Lab CLI flags and diagnostic tools is in [`docs/testing.md`](./docs/testing.md#command-reference).

Stack: TypeScript, Next.js and React, Tailwind CSS, SQLite via Prisma (`@prisma/adapter-libsql`), Vitest.

## Docs

- [`GAME_DESIGN.md`](./GAME_DESIGN.md): authoritative game design
- [`ARCHITECTURE.md`](./ARCHITECTURE.md): authoritative technical architecture
- [`CHANGELOG.md`](./CHANGELOG.md): notable persistence, tooling and dependency changes
- [`docs/testing.md`](./docs/testing.md): Vitest layout, determinism, Simulation Lab, CI, command reference
- [`docs/test-catalog.md`](./docs/test-catalog.md): what to run, with an index of Vitest projects, Lab CLI options and test files
- [`docs/agent-skills.md`](./docs/agent-skills.md): where agent skills live and how to link them for Claude Code or Windsurf
