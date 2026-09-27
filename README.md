# Basketball

Fictional basketball simulation / management game (Owner Mode foundation).

## Stack

- TypeScript
- Next.js + React
- Tailwind CSS
- SQLite via Prisma (`@prisma/adapter-libsql`)
- Vitest

## Docs

- [`GAME_DESIGN.md`](./GAME_DESIGN.md) — authoritative game design
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — authoritative technical architecture
- [`CHANGELOG.md`](./CHANGELOG.md) — notable persistence, tooling, and dependency changes

## Scripts

```bash
npm run dev
npm run test
npm run test:watch
npm run test:coverage
npm run lint
npm run format
npm run format:check
npm run db:migrate
npm run db:generate
```

`npm run test:coverage` runs the same Vitest projects as `npm test` and writes `coverage/` (HTML + LCOV). CI uploads that folder as an artifact and sends `coverage/lcov.info` to Codecov. Set a `CODECOV_TOKEN` repository secret if the Codecov upload should authenticate (public tokenless upload may still work).

## Environment

Copy `.env.example` to `.env` (already created for local SQLite):

```env
DATABASE_URL="file:./prisma/dev.db"
```
