# First-load JavaScript

What a browser downloads on a cold load of the main screens, for comparing
bundle changes over time.

## How to measure

```bash
npm run e2e:seed
DATABASE_URL=file:./prisma/e2e.db npm run build
DATABASE_URL=file:./prisma/e2e.db npx next start -p 3100
npx tsx scripts/first-load-js.ts --base=http://localhost:3100
```

`scripts/first-load-js.ts` loads each screen of the seeded regular-season save
in Chromium (1280×800, cache off) and sums every JavaScript response fetched
until the network is idle; it reports the median of three runs. "Transferred"
is the compressed size on the wire, "Parsed size" the decoded JavaScript the
browser has to parse. Code loaded only after an interaction is not counted.

For the module graph behind these numbers (which packages and files make up a
chunk, and why they are imported), use the Turbopack analyzer that ships with
Next.js 16: `npx next analyze` (interactive) or `npx next analyze --output`
(written to `.next/diagnostics/analyze`). `@next/bundle-analyzer` only works
with webpack builds, so it is not used here.

## 2026-10-27: interaction-only code on demand

Moved behind `next/dynamic` (`ssr: false`):

- the command palette: loads on the first open request (`/`, Ctrl/Cmd+K, the
  search button) and mounts open;
- the gamepad bridge: loads once a controller is connected;
- the dashboard moments (awards night, championship, season recap,
  progression): load only when the save has one to show.

| Screen     | Before: files | Before: transferred | Before: parsed | After: files | After: transferred | After: parsed |
| ---------- | ------------: | ------------------: | -------------: | -----------: | -----------------: | ------------: |
| Home       |            20 |            355.8 KB |      1160.5 KB |           22 |           351.9 KB |     1142.1 KB |
| Roster     |            22 |            366.1 KB |      1200.1 KB |           24 |           362.1 KB |     1181.7 KB |
| Watch Game |            23 |            391.6 KB |      1265.2 KB |           25 |           388.0 KB |     1247.6 KB |
| Draft      |            20 |            358.0 KB |      1166.6 KB |           22 |           354.0 KB |     1148.2 KB |

About 4 KB transferred and 18 KB parsed less on every screen. The two extra
files are the small launcher chunks; the deferred code itself is not fetched
until needed. The bulk of each page is the shared shell and React runtime;
`next analyze` is the place to look for the next saving.
