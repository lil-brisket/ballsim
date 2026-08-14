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
- [`docs/testing.md`](./docs/testing.md) — testing stack, conventions, and CI

## Scripts

```bash
npm run dev
npm run test
npm run test:watch
npm run test:coverage
npm run lint
npm run db:migrate
npm run db:generate
```

## Environment

Copy `.env.example` to `.env` (already created for local SQLite):

```env
DATABASE_URL="file:./prisma/dev.db"
```
