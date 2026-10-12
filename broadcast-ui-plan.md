# BallSim: "Broadcast / Arena" UI overhaul plan

Presentation-only overhaul. Implement one phase at a time; after each phase run
`npm run lint`, `npm test` and `npm run format:check`, then stop for review.
Do not change simulation, persistence or application logic.

## Goal

The app currently reads as an admin panel: every screen is the same dark zinc
rounded box, small mono labels, and text-link buttons. Make it feel like a
basketball game with a TV-broadcast / arena-menu look: bold scoreboard type,
team-color theming, one clear hero moment per screen, and motion.

## Constraints

- Presentation only. No behavior changes in `src/systems`, `src/domain`,
  `src/persistence` or `src/application`.
- Fully fictional. No real league marks, logos or licensed imagery. No on-court
  2D/3D simulation graphics. Portraits remain presentation identity only.
- Accessible: keep `focusRingClass`, 44px touch targets (`touchTargetClass`),
  and `prefers-reduced-motion` handling.
- Keep existing tests passing. If a test asserts on changed text or markup,
  update it deliberately and say so.
- Mobile matters. Check every change at phone width.
- Prefer shared primitives in `src/components/ui/` over one-off Tailwind strings.

## Phase 1: Foundation (design tokens and primitives)

Files: `src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/styles.ts`,
new files in `src/components/ui/`.

- Tokens: `--team-primary`, `--team-secondary`, `--team-primary-rgb` with neutral
  amber defaults; surface scale; glow/shadow tokens; semantic win/loss/live/warning.
- Display typeface via `next/font/google` as `--font-display`. Keep Geist and
  Geist Mono.
- Primitives: `ArenaPanel`, `ScoreNumeral`, `TickerBar`, `TeamBadge`,
  `SectionHeading`.
- Motion utilities: staggered entrance (`.enter-up` with `--i`), hover lift,
  animated hero sheen/scanline. All disabled under reduced motion.
- Keep `panelClass` and existing exports working.
- Done when: lint and tests pass, and a dev route shows each primitive with two
  different team colors.

## Phase 2: Shell (header and navigation)

Files: `GameShell`, `GameHeader`, `DesktopNavigation`, `MobileNavigationDrawer`,
`GameNavigation`, `ActiveTeamBanner`, `OwnerTeamSwitcher`.

- Set `--team-*` variables on the GameShell root from the controlled team's
  branding (extend selectors minimally and read-only if needed).
- GameHeader becomes a scoreboard bar: TeamBadge, display-font team name,
  TickerBar with date, record, rank, unread notifications. Keep switcher and bell.
- Sidebar: team-colored group labels and active item, larger icons, keep collapsed
  state and keyboard/screen-reader behavior.
- Subtle, reduced-motion-safe page transition on route change.
- Done when: every in-save page shows the themed header and nav with no layout
  regressions at 375px, 768px and 1280px.

## Phase 3: Dashboard (Front Office)

- Merge FrontOfficeHeader and NextGamePanel into one matchup banner with a single
  dominant "Simulate to next game" button; "Open calendar" and "Review rotation"
  as quiet secondary actions.
- Action Center as an alert strip when something blocks time advancement.
- Recent results as a W/L chip ticker; league headlines as a news ticker.
- At most two visual tiers. Leave "Phase details" as-is.
- Preserve all server actions, hidden inputs, error display and conditional banners.

## Phase 4: Roster and player card

- Roster view toggle: Table (existing) and Cards (default on wider screens).
- Rating-tier treatment via tokens.
- Drawer/profile hero: large portrait on team plate, dominant overall rating,
  ratings as a bar strip, season averages as a ticker.
- "Add to block" moves into an overflow/hover action.
- Keep PlayerEntityLink and entity drawer behavior.

## Phase 5: Calendar and game day

- Day cells: opponent TeamBadge and score; home/away marker; W/L colored edge;
  today ring; next-game pulse; empty days recede.
- Day inspector as a matchup card beside the grid (desktop) / bottom sheet (mobile).
- Scoreboard presentation for the simulation summary modal and game result page.
  Keep `stream-simulate-to-date.ts` untouched.

## Phase 6: Home and splash

- Splash: stronger logo lockup, animated court lines, single "Enter Game" CTA.
- Mode picker: three large cards, bullets behind expand; Owner Mode live, others locked.
- Saves list as cards with team badge, record and last-played date.
- New-game flow picks up the shared primitives.

## Phase 7: Sweep remaining pages

Standings, schedule, league, finances, contracts, draft, free agency, trades,
staff, media: swap headers to SectionHeading, hero numbers to ScoreNumeral, and
top-of-page summaries to TickerBar. No per-page redesigns.

## Verification checklist (every phase)

- `npm run lint`, `npm test`, `npm run format:check` pass.
- `npm run build` passes at the end of phases 1, 3 and 6.
- Check touched screens at 375px, 768px and 1280px.
- Reduced motion: no entrance or ambient animation runs.
- Keyboard: tab order and focus rings intact on header, nav, roster, calendar.
- Contrast: body text on team-colored surfaces meets WCAG AA with very light and
  very dark team colors.

## Commits

One commit per phase so any phase can be reverted on its own.
