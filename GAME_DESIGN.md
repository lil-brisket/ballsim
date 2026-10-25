# BallSim — Game Design

Authoritative description of game mechanics and design constraints for this fictional basketball simulation/management game.

When a significant design decision changes, update this document before or alongside the related implementation.

## Premise

This is a fully fictional basketball simulation and management game.

- There are no real NBA teams, players, leagues, cities, or copyrighted assets.
- There are no traditional basketball graphics (no 2D/3D on-court simulation). The one exception is the Watch Game court replay: a hand-built SVG view that replays the recorded play-by-play with players in fixed formation spots. It is presentation only: it never reruns the simulation, and its shot spots and formations are derived deterministically from the game id and play index, never stored.
- Front-office player portraits are presentation identity only: a procedural SVG headshot whose traits are persisted per save when a player or prospect is created, kept for the whole career, and unique among active players. An optional original raster overlay can sit on top, and an initials plate is the fallback. They are not licensed photography, not NBA 2K assets, and not simulation graphics, and they never affect gameplay.
- Games are simulated through data, statistics, events, and text.

Product title: **BallSim**.

## Modes

| Mode         | Status            | Description                               |
| ------------ | ----------------- | ----------------------------------------- |
| Owner Mode   | Active foundation | Control a franchise as owner/front office |
| Career Mode  | Future            | Player or staff career progression        |
| Dynasty Mode | Future            | Long-horizon franchise legacy play        |

## Owner Mode (current focus)

The player controls one team inside a larger simulated basketball world.

Canonical simulation state remains `GameState`. Owner-specific persisted data lives on `user.objectives` (plus team finances in `business.finances`). `toOwnerGameState` builds a derived, non-persisted management-layer view with live references into that state — it is not a second global game state or save schema.

New Owner games open **Game Setup** first. The Standard preset is **30 teams / 82 games / 16 playoff teams / best-of-7**. The CBL preset remains available as **12 / 22 / 8**. League rules live on top-level `GameState.settings` (configuration only — not runtime). `settings.league.teamCount` is the size at career creation; live size is always `Object.keys(world.teams).length`. Team selection sets `user.controlledTeamId` before the first time advance.

Owner Mode surfaces (minimal vertical-slice UI exists for dashboard/roster/standings/trade/FA/draft):

- Dashboard
- Roster
- Player Profile
- Schedule
- Watch Game (owner games with a recorded play-by-play log: a full-court SVG replay with player tokens, a progressive text feed with play/pause/speed/skip, a score ticker, a live box score, a shot-type summary with a per-team shot chart, and a key-moments recap. Shot spots on the court and chart are presentation only, derived from the game id and play index, never stored.)
- Media Hub (league timeline of posts and stories built from domain events through the event registry, plus notifications)
- Standings
- Finances
- Team
- League
- Front Office

## World simulation (design intent)

The player's team is not isolated. "Advance day" processing updates the entire
world via `advanceSimulation` (`src/systems/simulation/`), wrapped by
`runWorldPipeline` / `advanceOwnerTime`:

- Evaluate season/offseason lifecycle (phase transitions, schedule generation)
- Process due scheduled events
- Simulate games for the current world date (regular or playoffs)
- Rebuild standings
- Run Owner Mode gameplay: AI team decisions → financial consequences → owner objectives → owner notifications
- Advance the calendar by one day
- Run weekly extension points when crossing an ISO week boundary (no AI/gameplay re-run)

`competition.season.phase` is authoritative (`preseason` → `regular` →
`playoffs` → `postseason` → `offseason` → `preseason`). Free agency is a
persistent offseason stage exited via `advanceOffseasonStage` (`finishFreeAgency`).
Contracts whose `endYear` equals the completed season year release during
offseason contract expiration. Draft auto-completes when all order slots are used.

Owner Mode gameplay (Phase B):

- Season objectives on `user.objectives` (`status`, `seasonYear`, progress from standings/playoffs/payroll/net income)
- Financial consequences via `business.finances` (`applyCashAndBooksImpact` + `user.appliedGameplayConsequenceKeys`)
- Owner notifications on `user.notifications`
- Basic AI free agency, draft, and trades for non-user teams only

Still future work within that pipeline:

- Deeper AI (lineups, staff)
- Offseason calendar deadlines

## AI / decision layer (design intent)

Computer-controlled teams use an algorithmic decision layer. v1 covers:

- Free agency signings when roster size or a required position (`PG`/`SG`/`SF`/`PF`/`C`) is missing
- Draft selections ranked by missing position, fewest at position, overall, then id
- Simple AI–AI trades via existing trade-block / evaluation helpers

Constraints:

- Do **not** use an LLM for core basketball simulation or basic team decision logic unless a specific future feature clearly benefits from generative AI.
- Core simulation must remain deterministic, algorithmic, testable, and performant.
- The user-controlled team (`user.controlledTeamId`) is never modified by AI decisions.

## Domain concepts (planned)

Entities expected in the long-term model:

- Player, Team, League, Conference, Division
- Contract, Coach, Staff
- Game, Season, Schedule
- Finances

`Team.playStyle` (six 1–99 tendencies) was removed in schema v70: it was generated and stored but never read. Team style comes from `Team.coachingPhilosophy`.

`Team.coachingPhilosophy` holds three discrete strategic dimensions (`pace`, `offensiveEmphasis`, `defensiveApproach`). Defaults are all `"balanced"`. Simulation applies modest modifiers from coaching philosophy on top of existing attribute-driven probabilities (tempo seconds, shot-selection weights, foul action weight, pass defensive pressure). Coaching does not change player ability ratings or shot/pass/rebound outcome formulas.

Systems expected later (do not treat as present until implemented):

- Game simulation — **implemented** (`src/systems/game-simulation.ts` possession orchestration → `GameResult`)
- Season simulation — regular season + playoffs via `simulateSeason`; Owner Mode day loop uses `advanceSimulation`
- Calendar / advance day — **implemented** (`src/systems/simulation/advance-simulation.ts` + `world-pipeline` wrapper)
- Player development — **implemented** building block (`developPlayer`) and offseason season tick (`processSeasonPlayerDevelopment` ages + develops; facilities/trainers scale positive deltas only)
- Injuries — **implemented** (`src/systems/injury/`: exposure-based occurrence, catalog severities, daily recovery, availability and workload effects, injury history; development opportunity drops while injured)
- Finances — period-keyed revenue/expense books on `business.finances` (`booksByYear`); financial statements derive totals and player salaries from contracts (`getTeamPayroll`); home game-day posts tickets, merchandise, and concessions (`other`); `HomeGameDaySettled` is the historical attendance record; weekly player payroll is cash-only (`PlayerPayrollPaid`, not posted to books); marketing/awareness and media/climate sponsorship modifiers are live
- Standings — **implemented** (`src/systems/standings.ts` — `calculateStandings` / `updateStandings`). Standings page views (Overall / Conference / Division) are presentation-only; playoff qualification is league-wide (`settings.playoffs.playoffTeams` / `qualifyAndSeed`).
- Schedule generation — **implemented** as building block `generateSeasonSchedule` + world adapter `generateSchedule` (`src/systems/schedule-generation.ts`); validates via `validateSeasonSchedule`
- Save/load (foundation persistence exists)
- Roster generation — **implemented** (`src/systems/roster-generation.ts`)
- Roster rules validation — **implemented** as a building block (`src/systems/roster-rules.ts`)
- Contracts — **implemented** foundation (`startYear`/`endYear`/`salaryByYear`, team/player options, derived status, salary-cap helpers); negotiations / free agency TBD

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

- Full CBA trade exceptions (aprons, sign-and-trade, two-way contracts)
- Career Mode
- Dynasty Mode
- Fan facility → sentiment (deferred)

Implemented from the GM loops plan ([docs/plans/gm-loops-plan.md](docs/plans/gm-loops-plan.md)):

- Release: waive (dead money on the original schedule) or buy out (a share of the remaining salary now, cap hit spread); dead money counts in `getTeamPayroll`
- Contract extensions with a negotiation (ask, counter, refusal cooldown, testing the market), shared by owners and CPU teams. When roster decisions begin, CPU teams extend their 80+ players with a season or less left and re-sign the expiring players among their best nine (65+, 33 or younger), at the player's ask for a CPU-length deal, if their budget covers each added season at last season's payroll level. An owner who delegated contracts gets the star extensions only
- Restricted free agency: qualifying offers, offer sheets, match / decline, qualifying offers taken when no sheet comes
- Player morale (0–100, weekly in season from role vs expectation, winning, underpaid stars and contract talks; composure and leadership slow swings): trade requests after four miserable weeks (CPU teams list the player), minutes complaints, less loyalty pull in free agency and higher extension asks; no in-game effect
- Team chemistry (0–100, derived, never stored: continuity of the core eight, their morale, the best leader, recent trades). Small, bounded game effect: up to ±6% turnover weight in the possession engine and ±1 expected point in the box-score engine (perfect vs neutral chemistry: under +6 points of win%). The Sim Lab runs at neutral chemistry, so lab baselines are unchanged
- Development plans: players 25 and younger work on one focus (shooting, playmaking, defense, rebounding, athleticism or balanced). The focus moves half of each positive non-focus gain into the focus attributes after the usual draws, so total growth is unchanged and balanced is today's output; owners choose on the Development page, CPU teams use a default by position
- Legacy page: record book (single-game, per-game season and career leaders, league and franchise, from the game archive and player history), Hall of Fame (retired players with 6+ seasons, inducted 3 seasons after their last when career value plus awards and titles reaches the bar, when a new season starts) and retired numbers (an owner may retire the number of a retired player with 3+ seasons on the team; the franchise never issues it again)
- Draft lottery and Lottery night (in CBL leagues the worst team picks first ~35% of the time instead of always)
- Free agents weigh winning (by competitiveness), projected minutes, market, loyalty to their last team and the head coach on top of money; money stays the biggest factor. The Free Agency page shows what each player cares about, your team's score per factor and roughly what he would sign for
- Luxury tax (tiered, shared by non-tax teams), salary floor and Veteran rights (over the cap to re-sign your own player after 3 straight seasons), assessed at the end of the regular season

The free-agent market (`src/systems/free-agent-market.ts`):

- Offers are judged on their first-season salary against the player's ask. His ask is his market salary when free agency opens and falls evenly to half of it on the last day of the window (`durationDays`), and stays there through the season. CPU teams finishing free agency at the close sign at the closing ask
- CPU teams sign for a length by level and age: 4 seasons for 80+, 3 for 72+, 2 for 66+, otherwise 1, never past age 33. Automatic owner assists and roster fills stay at one season
- An owner's standing offer (Offer on the Free Agency page) is answered each free-agency day before CPU teams sign: he accepts once it meets his falling ask, with a last answer at the closing ask
- Free agents can be signed (Sign) in preseason and the regular season too, at the closing ask; not in the playoffs
- After free agency, short rosters fill one spot per round in waiver order (worst last-season record first); each spot goes to the best free agent left at the position, at market when the team can afford it and otherwise for a one-year minimum
- A free agent who goes a whole season unsigned retires at the season transition with at least a 50% chance, at any age

## Owner Mode Phase 2 — multi-season trajectory intent

Phase 2 measures whether the existing economy produces believable franchise paths. Baseline is the **unmodified** CBL starting franchise. Other scenarios are deltas from that baseline.

| Scenario     | 1 season                                                        | 3–5 seasons                             | 10 seasons                                  |
| ------------ | --------------------------------------------------------------- | --------------------------------------- | ------------------------------------------- |
| Baseline     | Modest cash drift                                               | Survivable; no insolvency               | No forced fire sale                         |
| Win-now      | Payroll pressure; gate helps if they win                        | Playoff cash only if contention lasts   | Thin cash or a crash                        |
| Conservative | Cash preservation                                               | Growing cash, lagging brand             | High cash, lower value if they never invest |
| Development  | Weaker near-term wins/cash                                      | Overall up vs baseline without collapse | Slow build                                  |
| Distress     | Negative operating cash                                         | Warning/critical possible               | Constrained, not a second economy           |
| Recovery     | Starts distressed with cuts                                     | Cash/health improve without debt        | Return toward stable                        |
| Aggressive   | Cash pressure from real upgrade attempts; restrictions possible | Constraint without requiring insolvency | Overspend slows; not unbounded collapse     |
| High market  | Market-size-only boost to demand                                | Higher gate vs baseline                 | Market advantage without roster change      |
| Low market   | Market-size-only demand drag                                    | Lower gate vs baseline                  | Market disadvantage without roster change   |

Direct per-win cash bonuses are not used; winning already pays through attendance, demand, reputation, sponsorship, and playoffs.

### League economy — intended causal relationships

Validated by `npm run sanity:league` (`src/simulation/league-sanity/`) across many simulated seasons. These are directional/strength intents, not hard game rules:

| Relationship                                   | Intent                                                                           | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payroll → win%                                 | Weak-to-moderate positive (not near-deterministic)                               | Moderate. Measured r≈0.50 (CBL 4×10, seed 42) before the GM loops work and r≈0.49 after it. The cap binds for most teams (mean payroll ~65% of the cap), so the luxury tax (10% over the cap, tiered from 1.5×, proceeds shared by non-tax teams) mainly bites on teams using Veteran rights to re-sign their own players over the cap. A salary floor (40% of the cap) charges the shortfall at the end of the regular season. `salaryForPlayer` still prices players as a step function of overall, so payroll tracks talent; the earlier r≈0.74 figure predates AI payroll budgets (#93). Tried and reverted earlier: per-signing salary noise and a per-team overpay factor                                                                                                                                                                                                             |
| Win% → franchise value                         | Positive                                                                         | `calculatePerformanceValue` (win%, playoff rate, playoff depth) weighted up relative to the market term; `MARKET_REALIZATION_FLOOR` lowered so market value leans more on realized (winning-correlated) demand                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Market size → attendance                       | Positive                                                                         | New leagues and expansion teams start with an arena sized to market (`startingArenaLevelForMarket`: level 1 below market 50, 2 below 65, else 3), so big markets have more seats to fill. Raising the demand weight alone did nothing because every team was selling out the same 12k-seat building. 40 sims × 5 seasons: r 0.12 → 0.38                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Facilities → roster development (2-season lag) | Positive, with a real delay                                                      | `laggedFacilityDevelopmentMultiplier` uses the facility levels from `FACILITY_DEVELOPMENT_LAG_SEASONS` (2) seasons ago via franchise history, with a 1.0–1.7 multiplier. The league-wide signal was negative (r≈−0.19) because of #82, not because facilities and payroll compete for cash: uncapped roster fills funnelled the best free agents to a few teams, so roster strength tracked hoarding instead of development. With AI free agency and payroll budgets fixed (#82, #93), r≈0.31–0.41 (CBL, seed 42, 10×5 and 4×10), and AI teams run one facility project at a time. The direct effect is small, though: level 5 vs 1 development facilities add ~+0.1 overall per player per season (+0.26 at age ≤23, nothing at 30+), so the age-adjusted `facilities_player_development` chain only reaches r≈0.04. A stronger facility lever would need a league-wide development retune |
| Dynasty lock-in / franchise-value mobility     | No single franchise should dominate titles; value ranks should shuffle over time | Value is driven by recent performance: inertia α 0.3 → 0.45 → 0.7, performance dollars 1.5× (win% 165M, playoff rate 105M, depth 75M), current-season win% weight 0.5, 2-season trails; title boosts fade on a 5-season half-life. League sanity ranks value within each league (it pooled all simulations before). Per-league rank persistence 0.843 (CBL, 4×10, seed 42); one-season bottom→top quartile jumps stay rare (~1%), as with real franchise values. After the free-agent market and development retune it is 0.854–0.864 (seeds 42, 101, 202; was 0.807–0.827), just over the 0.85 sanity warning: rosters now carry over (win-rank persistence ~0.1 → ~0.3) and insolvency and distress fell (seed 42: 4.0% → 2.5% and 8.3% → 5.0%), so fewer franchises collapse and swap ranks. Left as is                                                                                  |
| Talent ceiling / superstars                    | A handful of 90+ overall players league-wide; top scorers in the 25-32 PPG range | Shooting ability has diminishing returns above 75 (`effectiveShootingAbility` in `shot-resolution.ts`, half weight per point) in both engines, so a 97 behaves like an 86 and elite scorers shoot ~50% instead of ~59%. Generation adds an 86-90 quality band (starter slots up to 90): ~3 players at 90+ per 30-team league, top scorers ~26-28 PPG in both engines (engine v8, seed 42). The box-score knee workaround is gone; its points model is refit on real-pipeline possession games (`simulateScheduledGame`).                                                                                                                                                                                                                                                                                                                                                                    |

Implemented trade foundation:

- Two-team `TradeProposal` (`sideA` / `sideB`) with shared `validateTrade` / `executeTrade`
- Trade Block and Trade Finder. The owner puts up 1–3 players/picks; each interested CPU team answers with its best acceptable package (max 3 assets, weighted so quantity cannot buy quality) and a 0–100 interest score. Finder acquire can package owned picks for off-block targets; CPU `assembleAcquirePackage` buys OVR ≥ 78
- Live accept uses `getBaseAssetValue` (slot curve + star premiums) then `evaluateTrade` / `makeTradeDecision`. `calculateDraftPickValue` is the leftover round-only 80/50 helper
- Draft pick ownership (`world.draftPicks`) with a rolling three-season horizon; picks trade at most two drafts ahead

Implemented draft foundation (v1):

- Draft class under `world.drafts` with prospect snapshots (not in `world.players` until selected)
- Deterministic draft order from pick assets (total order via `draftPickId`): a seeded lottery decides the top first-round picks among non-playoff teams (flattened odds for the three worst, top 4 drawn, own `draft-lottery:<year>` stream; on for new leagues, off for leagues created before v75), then reverse standings. The draw is stored on the draft class and shown on Lottery night; trade valuation projects lottery picks with the same odds
- Team-specific scouting noise that never mutates prospect truth
- Selection inserts the reserved prospect `playerId` into `world.players` with a 2-year rookie contract
- Combine / undrafted FA / pick-trade-during-draft remain out of scope

## Player ability model

Players store current ability as category attributes on a **1–99** integer scale:

- Physical: speed, strength, athleticism, stamina
- Offensive: finishing, mid range, three point, free throw, ball handling, passing
- Defensive: perimeter defense, interior defense, steal, block, rebounding
- Mental: basketball IQ, offensive IQ, defensive IQ, consistency

**Potential** is stored separately as a developmental ceiling (`potential.overall`, same 1–99 scale). It is not derived from current attributes at runtime. During player generation:

1. Derive current overall from position + attributes (`calculatePlayerOverall`).
2. Roll an age-banded gap with mass toward the minimum: young (`age <= 24`) 4–16; prime (`25–30`) 1–8; veteran (`age >= 31`) 0–3.
3. `potential.overall = clamp(currentOverall + gap, 1, 99)`.

Draft prospects use pick-banded quality and gaps (`DRAFT_QUALITY_BY_PICK_BAND`; overall is about quality + 5): picks 1–3 start around 69–81 with 15–25 to grow, picks 4–14 around 59–71 with 10–20, later rounds lower with narrower ceilings. Lottery picks arrive as rotation players and peak in their mid-20s.

**Quality** is a generation-time latent attribute-center (40–85). Default generation rolls a **pyramid** (most mass 50–68, rare 81–85), not uniform. When quality is not forced, generation then applies an age offset (developing −5, declining −4) so opening-day rookies are worse than primes. Forced quality (draft pick bands, tests) skips the offset. Opening-day rosters and short-roster fills further clip quality by slot (starters 0–4, rotation 5–9, bench 10+). Short-roster fills take the best unsigned free agent at the position before minting. It is not stored on `Player` and is not current overall or potential.

**Age** at generation is prime-heavy (not uniform 20–34). 33–34 year olds are scarce.

Retirement during `season_transition` uses `calculatePlayerOverall` (not attribute-mean). Chance is 0 before age 32; 80+ overall linger, sub-60 leave sooner. A free agent who spent the whole season unsigned retires with at least a 50% chance at any age.

**Position** (`PG` | `SG` | `SF` | `PF` | `C`) and **archetype** (machine-readable style tag such as `floor_general`) are stored on the player. Archetype influences how attributes are _generated_ (position baseline + archetype modifiers + RNG). It is not the source of truth for ability and does not assign a stored overall rating. Attributes remain the ability model. Uncommon position/archetype pairs are allowed on stored players; compatibility is a generation constraint only.

**Nationality** is a typed catalog field on the player (same ownership pattern as archetype). It is selected during name generation and stored for identity/flavor. It does **not** yet affect attributes, tendencies, or simulation. Pre-nationality saves (schema versions before 6) migrate every player to `"USA"` deterministically — a fixed legacy compatibility default, not RNG-based generation.

**Work ethic** is a personality trait (`personality.workEthic`); it is not a current-ability attribute. It modestly scales **positive** development deltas only.

Personality, injury status, and development stage are stored on the player. Development stage is derived from age (`< 25` developing, `25–30` prime, `> 30` declining) during generation and again on each `developPlayer` call. Injury status does not affect v1 development. Other personality traits besides work ethic are reserved.

## Player development

`developPlayer(player, rng, trainerMultiplier?)` applies **one year** of development at the player's current age. It does not increment age. Positive attribute deltas are scaled by the multiplier; negative deltas are not boosted — facilities cannot guarantee improvement.

`processSeasonPlayerDevelopment` runs during offseason `season_finalization` **after** franchise history snapshots: age every active player +1 (retired players keep the age and ratings they retired with), then call `developPlayer` with facility × trainer × optional youth (developing-stage only) multipliers, divided by the league-average facility × trainer multiplier (`leagueDevelopmentReference`). Better facilities and staff develop players faster than rivals; league-wide upgrades over the years do not inflate ratings. `developPlayer` changes attributes and stage only; every other player field carries over.

Current ability develops toward `potential.overall`, which is a ceiling (not raised by normal development). After a development step, derived overall must remain `<= potential.overall`. Overall is never stored or edited directly; attributes change, then `calculatePlayerOverall` is recomputed.

Behavior by age band (`DEVELOPMENT_AGE_BANDS`, age after the birthday; roughly the yearly overall change with room to grow):

- **To 22**: fast growth, about +2.4 a year
- **23–24**: about +1.6
- **25–26**: about +0.6
- **27–29**: a plateau (around 0)
- **30–31**: about −0.7; **32–33**: about −1.2; **34+**: about −2.2. Physical attributes fall first, mental ones last

Growth bands (to 26) scale positive deltas by work ethic and the development multiplier and taper them by remaining potential (`potential.overall - currentOverall`, full growth until 6 from the ceiling); later bands are age-driven (no work-ethic or facility scaling, missed time still costs) and not tapered, but the ceiling still applies, so a prime player at his potential holds instead of drifting down. Each of the 19 attributes in `PLAYER_ATTRIBUTE_KEYS` receives one seeded integer roll. Positive deltas are scaled by the taper and work ethic, then clamped. High work ethic does not guarantee improvement; low work ethic does not forbid it. The stored development stage (`developing` / `prime` / `declining`) is unchanged and still derived from age.

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
- Role multipliers concentrate touches on the primary (`primary_creator` 1.75, `low_usage` 0.52). Attributes still dominate: a 90-rated role player out-weights a 50-rated primary.
- Box-score scoring weights are `(usageScore × scoringAbility) ^ boxScoreScoringExponent × minutes`. Possession sim does not use the exponent (shot weight is already usage × role × scoring).
- **Receiver** selection uses shot weight (passes toward scoring threats) and does **not** change pass completion probability.
- Team depth is the normalize step: adding another high-usage teammate reduces existing shares. No fixed superstar percentages.

**Touches** are box-score instrumentation only (`GamePlayerStats.touches`). A touch is meaningful on-ball offensive involvement. A player gets **at most one touch per possession** (overlapping events dedup). Touches do not influence selection or resolution. Shooting fouls credit the fouled shooter once whether or not an FGA is recorded; completed-pass receivers are the only success-dependent credit.

## Game simulation fidelity

Owner Mode calendar jumps use `fidelity: "box_score"` for CPU vs CPU games. That path is [`simulateGameBoxScore`](src/systems/game-simulation-box-score.ts): a statistical projection of the **same attributes** as possession sim (shot/FT make rates from `SHOT_RESOLUTION_CONFIG` / `FREE_THROW_RESOLUTION_CONFIG`, usage with a star exponent for scoring, passing for assists, rebound/steal/block ratings plus position modifiers). Free-throw make chance is `freeThrow / 99 + baselineProbability` (currently +0.035), then clamped. It does not run a possession loop and writes no play-by-play. Players who are `out` / `suspended` sit; `limited` / `questionable` / `minor` / `recovery` play reduced minutes. Injury creation still runs after the game via `processPostGameInjuryExposures` from those minutes.

Games involving the owner team still use possession [`simulateGame`](src/systems/game-simulation.ts) even when fidelity is `box_score`. Only those games record a watchable play-by-play log (`competition.playByPlay`, current season only). CPU possession games keep box scores but no per-play data. A **headless** owner (`skipOwnerGameplay`, used by league-sanity and Lab season runs) is nobody's team to watch, so its games use the league fidelity like every other CPU team; otherwise the one possession-engine team stands out against a box-score league (a 9-73 owner at 73.7 PPG next to a ~95 PPG league).

**Box-score is not a second sport.** It is calibrated to, and tested against, the possession sim on the canonical Lab scenario (`normal`, seed 42, rotation on):

- The Lab runs either engine (`npm run sim -- --fidelity=box_score`). `tests/simulation/lab/fidelity-parity.test.ts` runs both with `--calibrate` semantics and fails if team PPG differs by more than 3, or FG% / 3P% / FT% by more than 2 / 2.5 / 2.5 points. `CALIBRATION_BANDS` apply to both.
- Points are rolled around `BASE_TEAM_POINTS` with possession-like spread (SD about 13 per team). Each player's points then split into 3PM / 2PM / FTM using calibrated shares, and attempts are back-computed from makes at make rates that are pulled toward league anchors (`rateSpread`), because possession outcomes move less with raw ratings than the bare rating formulas do. This keeps stars from shooting 55% and keeps free throws near 15 FTA per team (an odd leftover point is no longer always booked as a free throw).
- Counting stats (AST, REB, STL, BLK, TO) scale from a possession count with rates matched to the possession sim. Minutes always sum to 240 per team and no player exceeds 48.
- Stored possession minutes are also conserved per team (seconds are rounded with largest remainder, not floored per player).
- Known limit: possession scoring depends strongly on the drawn roster's shooters (about 79-97 PPG across Lab seeds, 3PA 16-35), while box-score is nearly constant, so parity is anchored on the canonical seed, not on every roster. Lab season runs enforce `season-invariants` as hard failures: team PPG within 15 of the league and inside 70-135; no scorer above 1.35x the #2-#6 scorers' mean or above 40 PPG; every game's team minutes equal 240 + 25 per OT.

## Design rules

- Prefer real, tested foundation pieces over fake "working" placeholders.
- Keep mechanics documented here when introduced; keep technical structure in `ARCHITECTURE.md`.
- All content remains fictional and original.
