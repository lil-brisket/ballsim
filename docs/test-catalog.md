# Test and simulation catalog

Lookup for **what exists** and **which command to run**. Conventions, factories, and CI details live in [`testing.md`](./testing.md).

Every Vitest run writes `test-results.txt` at the repo root (gitignored). Coverage HTML/LCOV: `npm run test:coverage` → `coverage/`.

## Pick a command

| I want to…                                                   | Run                                                                                       |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Fast default suite (unit + integration + React)              | `npm test`                                                                                |
| Domain / systems / persistence units only                    | `npm run test:unit`                                                                       |
| Season / playoffs / week-scale integration                   | `npm run test:integration`                                                                |
| Lab hard-invariants, 1000-game PBT, season RNG, long horizon | `npm run test:simulation`                                                                 |
| Multi-year, economy, league-sanity                           | `npm run test:regression`                                                                 |
| Every Vitest project                                         | `npm run test:all`                                                                        |
| Watch mode                                                   | `npm run test:watch`                                                                      |
| One file                                                     | `npx vitest run path/to/file.test.ts`                                                     |
| 25-season soak                                               | `STRESS=1 npx vitest run tests/application/multi-year-simulation-stress.test.ts`          |
| Simulation Lab UI                                            | `npm run lab` then [http://localhost:3000/dev/sim-lab](http://localhost:3000/dev/sim-lab) |
| Lab CLI (games / career / schedule)                          | `npm run sim -- --seed=42 --games=100`                                                    |
| Statistical validation (1000 games)                          | `npx tsx scripts/validate-simulation-stats.ts --games 1000 --seed 12345`                  |
| League sanity report                                         | `npm run sanity:league`                                                                   |
| Game / season timing                                         | `npm run bench:sim`                                                                       |
| Typecheck / lint / format (CI)                               | `npx tsc --noEmit` · `npm run lint` · `npm run format:check`                              |

`npm test` does **not** run simulation or regression. PR CI runs `npm run test:coverage` then `npm run test:simulation`.

## Vitest projects

Defined in [`vitest.config.mts`](../vitest.config.mts).

| Project       | npm script               | What it covers                                                        | Typical length       |
| ------------- | ------------------------ | --------------------------------------------------------------------- | -------------------- |
| `unit`        | `test:unit`              | All `tests/**/*.test.ts` except the files listed below                | milliseconds–seconds |
| `integration` | `test:integration`       | Season, playoffs, lifecycle, performance budget, owner vertical slice | seconds              |
| `react`       | (included in `npm test`) | `tests/**/*.test.tsx` (jsdom)                                         | seconds              |
| `simulation`  | `test:simulation`        | Four Lab batches (PR CI)                                              | seconds–minutes      |
| `regression`  | `test:regression`        | Multi-year, economy, league-sanity, `tests/regression/`               | minutes              |

### Integration (explicit include)

- [`tests/systems/season-simulation.test.ts`](../tests/systems/season-simulation.test.ts)
- [`tests/systems/playoffs-integration.test.ts`](../tests/systems/playoffs-integration.test.ts)
- [`tests/systems/simulation/season-lifecycle.test.ts`](../tests/systems/simulation/season-lifecycle.test.ts)
- [`tests/systems/simulation/performance-budget.test.ts`](../tests/systems/simulation/performance-budget.test.ts)
- [`tests/application/owner-vertical-slice.test.ts`](../tests/application/owner-vertical-slice.test.ts)

### Simulation (explicit include)

| File                                                                                                  | What it asserts                                                               |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`tests/simulation/lab/invariants-hard.test.ts`](../tests/simulation/lab/invariants-hard.test.ts)     | 100 rotation-on Lab games, seed 42, zero hard failures                        |
| [`tests/simulation/lab/simulate-game-pbt.test.ts`](../tests/simulation/lab/simulate-game-pbt.test.ts) | 1000 fast-check seeds → `simulateGame` → Lab `checkInvariants` (rotation off) |
| [`tests/simulation/lab/season-rng-desync.test.ts`](../tests/simulation/lab/season-rng-desync.test.ts) | Injected RNG stays aligned with `meta.rngState` at playoff start              |
| [`tests/simulation/lab/long-horizon.test.ts`](../tests/simulation/lab/long-horizon.test.ts)           | One in-memory owner-career season                                             |

Other Lab tests under `tests/simulation/lab/` stay in **unit** (`npm test`).

### Regression (explicit include)

- [`tests/application/multi-year-simulation.test.ts`](../tests/application/multi-year-simulation.test.ts) (and `multi-year-simulation*.test.ts`)
- [`tests/persistence/migration-multi-year.test.ts`](../tests/persistence/migration-multi-year.test.ts)
- [`tests/systems/economic-scenarios.test.ts`](../tests/systems/economic-scenarios.test.ts)
- [`tests/simulation/league-sanity/**`](../tests/simulation/league-sanity/)
- [`tests/regression/**`](../tests/regression/)

## Simulation Lab

Production `simulateGame` / `advanceSimulation` wrapped by [`src/simulation/lab/`](../src/simulation/lab/). You do not need to play Owner Mode first.

### UI

```bash
npm run lab
```

### CLI

```bash
npm run sim -- --help
npm run sim -- --list-scenarios
npm run sim -- --seed=42 --games=100
npm run sim -- --seed=42 --scenario=superteam --rotation=off --channel=pr
npm run sim -- --seed=42 --rotation=off --jobs=4 --games=1000
npm run sim -- --resume --run-id <runId> --seed=42 --rotation=off --games=1000
npm run sim -- --seed=42 --mode owner-career --seasons 10 --channel nightly
npm run sim -- --seed=42 --games=2 --sweep --sampler lhs --samples 8 --rotation=off
npm run sim -- --seed=42 --games=20 --write-baseline results/golden.json --rotation=off
npm run sim -- --seed=42 --games=20 --baseline results/golden.json --rotation=off
npm run sim -- --seed=42 --games=20 --calibrate --rotation=off
npm run sim -- --config lab.json --dry-run
npm run sim:compare -- results/<runA>/manifest.json results/<runB>/manifest.json
npm run sim:replay -- --run <runId> --game 0
```

`--channel pr` (default) fails on hard invariants only. `--channel nightly` also fails on statistical FAIL. `--jobs N` requires `--rotation=off`.

Persisted output: `results/<runId>/` (`manifest.json`, `games.ndjson`, `checkpoint.json`, hard-failure repros).

### Game-mode `--scenario` ids

From [`LAB_SCENARIO_IDS`](../src/simulation/lab/scenarios/index.ts). Confirm live list with `npm run sim -- --list-scenarios`.

| Id              | Kind                                     |
| --------------- | ---------------------------------------- |
| `normal`        | game (default)                           |
| `superteam`     | game                                     |
| `weak`          | game                                     |
| `shooting`      | game                                     |
| `rebounding`    | game                                     |
| `min-roster`    | game                                     |
| `matchup-90-40` | game                                     |
| `injury-heavy`  | game                                     |
| `overtime`      | game                                     |
| `owner-career`  | `--mode owner-career`                    |
| `schedule`      | schedule run (Lab UI / `runLabSchedule`) |

## Other simulation CLIs

| Command                                                                  | Purpose                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `npx tsx scripts/validate-simulation-stats.ts --games 1000 --seed 12345` | Box-score / snapshot invariants + plausibility (default 1000 games) |
| `npm run bench:sim`                                                      | Game cost model + season profiler                                   |
| `npm run bench:sim:game`                                                 | Game-only benchmark                                                 |
| `npm run bench:sim:season`                                               | Season profiler                                                     |
| `npm run sanity:league`                                                  | Default 10 sims × 5 seasons                                         |
| `npm run sanity:compare -- baseline.json current.json`                   | Compare two league-sanity JSON reports                              |
| `npm run playtest:metrics`                                               | Snapshot playtest metrics for a bootstrapped world                  |
| `npx tsx scripts/injury-simulation-analysis.ts`                          | Injury analysis                                                     |
| `npx tsx scripts/behavioral-harness.ts`                                  | Franchise behavioral harness                                        |
| `npx tsx scripts/inspect-owner-economy.ts baseline 1`                    | Owner economy inspect                                               |
| `npx tsx scripts/analyze-player-population.ts`                           | Generated population stats                                          |
| `npx tsx scripts/analyze-player-development.ts`                          | Development analysis                                                |

## File index

Run any file with `npx vitest run <path>` (Vitest still applies project include/exclude). Files in the simulation and regression lists above must use `npm run test:simulation` / `npm run test:regression` (or `test:all`) unless you pass `--project`.

### application

[`calendar-opener-progression`](../tests/application/calendar-opener-progression.test.ts) · [`calendar-page-view`](../tests/application/calendar-page-view.test.ts) · [`custom-roster-save-creation`](../tests/application/custom-roster-save-creation.test.ts) · [`event-log`](../tests/application/event-log.test.ts) · [`game-mode-catalog`](../tests/application/game-mode-catalog.test.ts) · [`game-service`](../tests/application/game-service.test.ts) · [`lineup-rotation-save`](../tests/application/lineup-rotation-save.test.ts) · [`list-trade-candidates`](../tests/application/list-trade-candidates.test.ts) · [`mid-career-takeover`](../tests/application/mid-career-takeover.test.ts) · [`multi-year-simulation`](../tests/application/multi-year-simulation.test.ts) _(regression)_ · [`multi-year-simulation-stress`](../tests/application/multi-year-simulation-stress.test.ts) _(skipped unless `STRESS=1`; regression glob)_ · [`new-season-custom-class-decision`](../tests/application/new-season-custom-class-decision.test.ts) · [`onboarding-routing`](../tests/application/onboarding-routing.test.ts) · [`owner-player-scope`](../tests/application/owner-player-scope.test.ts) · [`ownership-alignment-scenarios`](../tests/application/ownership-alignment-scenarios.test.ts) · [`owner-vertical-slice`](../tests/application/owner-vertical-slice.test.ts) _(integration)_ · [`save-preview-helpers`](../tests/application/save-preview-helpers.test.ts) · [`sim-lab`](../tests/application/sim-lab.test.ts) · [`simulate-blocking-decision`](../tests/application/simulate-blocking-decision.test.ts) · [`simulate-to-date`](../tests/application/simulate-to-date.test.ts) · [`time-advance-commit-guard`](../tests/application/time-advance-commit-guard.test.ts) · [`wrong-active-team`](../tests/application/wrong-active-team.test.ts)

### domain

[`ai-management-delegation`](../tests/domain/ai-management-delegation.test.ts) · [`calendar-date`](../tests/domain/calendar-date.test.ts) · [`coaching-philosophy`](../tests/domain/coaching-philosophy.test.ts) · [`conference`](../tests/domain/conference.test.ts) · [`contract`](../tests/domain/contract.test.ts) · [`custom-roster-setup`](../tests/domain/custom-roster-setup.test.ts) · [`division`](../tests/domain/division.test.ts) · [`foul`](../tests/domain/foul.test.ts) · [`game`](../tests/domain/game.test.ts) · [`game-box-score`](../tests/domain/game-box-score.test.ts) · [`game-settings`](../tests/domain/game-settings.test.ts) · [`game-settings-integration`](../tests/domain/game-settings-integration.test.ts) · [`league`](../tests/domain/league.test.ts) · [`league-hierarchy`](../tests/domain/league-hierarchy.test.ts) · [`owner-decision-participants`](../tests/domain/owner-decision-participants.test.ts) · [`owner-objective`](../tests/domain/owner-objective.test.ts) · [`player`](../tests/domain/player.test.ts) · [`player-archetype`](../tests/domain/player-archetype.test.ts) · [`player-evaluation`](../tests/domain/player-evaluation.test.ts) · [`player-nationality`](../tests/domain/player-nationality.test.ts) · [`player-overall-rating`](../tests/domain/player-overall-rating.test.ts) · [`possession`](../tests/domain/possession.test.ts) · [`rng`](../tests/domain/rng.test.ts) · [`system-result`](../tests/domain/system-result.test.ts) · [`team`](../tests/domain/team.test.ts) · [`team-branding`](../tests/domain/team-branding.test.ts) · [`team-identity`](../tests/domain/team-identity.test.ts) · [`team-nickname`](../tests/domain/team-nickname.test.ts)

### systems (game engine)

[`game-simulation`](../tests/systems/game-simulation.test.ts) · [`game-simulation-box-score`](../tests/systems/game-simulation-box-score.test.ts) · [`game-sim-state`](../tests/systems/game-sim-state.test.ts) · [`game-box-score-immutability`](../tests/systems/game-box-score-immutability.test.ts) · [`shot-resolution`](../tests/systems/shot-resolution.test.ts) · [`rebound-resolution`](../tests/systems/rebound-resolution.test.ts) · [`pass-resolution`](../tests/systems/pass-resolution.test.ts) · [`foul-resolution`](../tests/systems/foul-resolution.test.ts) · [`free-throw-resolution`](../tests/systems/free-throw-resolution.test.ts) · [`possession-resolution`](../tests/systems/possession-resolution.test.ts) · [`possession-decision-selection`](../tests/systems/possession-decision-selection.test.ts) · [`lineup-simulation`](../tests/systems/lineup-simulation.test.ts) · [`coaching-philosophy-sim`](../tests/systems/coaching-philosophy-sim.test.ts) · [`player-usage`](../tests/systems/player-usage.test.ts) · [`player-availability`](../tests/systems/player-availability.test.ts)

### systems (rotation / injury)

[`rotation/substitution-engine`](../tests/systems/rotation/substitution-engine.test.ts) · [`rotation/rotation-feasibility`](../tests/systems/rotation/rotation-feasibility.test.ts) · [`rotation/rotation-integration`](../tests/systems/rotation/rotation-integration.test.ts) · [`rotation/derive-rotation-constraints`](../tests/systems/rotation/derive-rotation-constraints.test.ts) · [`injury/injury-effects`](../tests/systems/injury/injury-effects.test.ts) · [`injury/injury-lifecycle`](../tests/systems/injury/injury-lifecycle.test.ts) · [`injury/staff-isolation`](../tests/systems/injury/staff-isolation.test.ts)

### systems (calendar / season / simulation)

[`season-simulation`](../tests/systems/season-simulation.test.ts) _(integration)_ · [`playoffs`](../tests/systems/playoffs.test.ts) · [`playoffs-integration`](../tests/systems/playoffs-integration.test.ts) _(integration)_ · [`schedule-generation`](../tests/systems/schedule-generation.test.ts) · [`schedule-validation`](../tests/systems/schedule-validation.test.ts) · [`schedule-regeneration`](../tests/systems/schedule-regeneration.test.ts) · [`schedule-calendar-dates`](../tests/systems/schedule-calendar-dates.test.ts) · [`preseason-schedule-generation`](../tests/systems/preseason-schedule-generation.test.ts) · [`standings`](../tests/systems/standings.test.ts) · [`standings-incremental`](../tests/systems/standings-incremental.test.ts) · [`phase-engine/phase-engine`](../tests/systems/phase-engine/phase-engine.test.ts) · [`league-rules/league-calendar`](../tests/systems/league-rules/league-calendar.test.ts) · [`league-rules/hard-locks`](../tests/systems/league-rules/hard-locks.test.ts) · [`advance-blocking-decisions`](../tests/systems/advance-blocking-decisions.test.ts)

Calendar: [`calendar-events`](../tests/systems/calendar/calendar-events.test.ts) · [`league-milestone-markers`](../tests/systems/calendar/league-milestone-markers.test.ts) · [`owner-calendar-redesign`](../tests/systems/calendar/owner-calendar-redesign.test.ts) · [`season-events-calendar`](../tests/systems/calendar/season-events-calendar.test.ts) · [`season-transitions`](../tests/systems/calendar/season-transitions.test.ts) · [`simulation-summary`](../tests/systems/calendar/simulation-summary.test.ts) · [`team-calendar`](../tests/systems/calendar/team-calendar.test.ts)

Season events: [`season-events-foundation`](../tests/systems/season-events/season-events-foundation.test.ts) · [`season-events-cycle`](../tests/systems/season-events/season-events-cycle.test.ts) · [`season-events-e2e`](../tests/systems/season-events/season-events-e2e.test.ts)

`tests/systems/simulation/`: [`advance-simulation`](../tests/systems/simulation/advance-simulation.test.ts) · [`behavioral-harness`](../tests/systems/simulation/behavioral-harness.test.ts) · [`calendar-context`](../tests/systems/simulation/calendar-context.test.ts) · [`deterministic-equivalence`](../tests/systems/simulation/deterministic-equivalence.test.ts) · [`management-policy`](../tests/systems/simulation/management-policy.test.ts) · [`multi-year-calendar-driven`](../tests/systems/simulation/multi-year-calendar-driven.test.ts) · [`offseason-lifecycle`](../tests/systems/simulation/offseason-lifecycle.test.ts) · [`owner-gameplay`](../tests/systems/simulation/owner-gameplay.test.ts) · [`performance-budget`](../tests/systems/simulation/performance-budget.test.ts) _(integration)_ · [`persistence-determinism`](../tests/systems/simulation/persistence-determinism.test.ts) · [`phase-lifecycle`](../tests/systems/simulation/phase-lifecycle.test.ts) · [`phase-machine`](../tests/systems/simulation/phase-machine.test.ts) · [`planned-season-dates`](../tests/systems/simulation/planned-season-dates.test.ts) · [`preseason-regular-boundary`](../tests/systems/simulation/preseason-regular-boundary.test.ts) · [`scheduled-events`](../tests/systems/simulation/scheduled-events.test.ts) · [`season-lifecycle`](../tests/systems/simulation/season-lifecycle.test.ts) _(integration)_ · [`season-rng-desync`](../tests/systems/simulation/season-rng-desync.test.ts) · [`user-franchise-assist`](../tests/systems/simulation/user-franchise-assist.test.ts) · [`validate-simulation-state`](../tests/systems/simulation/validate-simulation-state.test.ts)

### systems (world / players / staff / roster)

[`world-pipeline`](../tests/systems/world-pipeline.test.ts) · [`league-generation`](../tests/systems/league-generation.test.ts) · [`league-branding-integrity`](../tests/systems/league-branding-integrity.test.ts) · [`player-generation`](../tests/systems/player-generation.test.ts) · [`player-attribute-generation`](../tests/systems/player-attribute-generation.test.ts) · [`player-name-generation`](../tests/systems/player-name-generation.test.ts) · [`player-development`](../tests/systems/player-development.test.ts) · [`season-player-development`](../tests/systems/season-player-development.test.ts) · [`player-history`](../tests/systems/player-history.test.ts) · [`player-payroll`](../tests/systems/player-payroll.test.ts) · [`roster-management`](../tests/systems/roster-management.test.ts) · [`roster-management-rotation-size`](../tests/systems/roster-management-rotation-size.test.ts) · [`roster-rules`](../tests/systems/roster-rules.test.ts) · [`team-management-lineup-rotation`](../tests/systems/team-management-lineup-rotation.test.ts) · [`team-management-season-log`](../tests/systems/team-management-season-log.test.ts) · [`staff-generation`](../tests/systems/staff-generation.test.ts) · [`staff-development`](../tests/systems/staff-development.test.ts) · [`staff-effects`](../tests/systems/staff-effects.test.ts) · [`staff-payroll`](../tests/systems/staff-payroll.test.ts) · [`staff-persistence`](../tests/systems/staff-persistence.test.ts) · [`staff-multi-team`](../tests/systems/staff-multi-team.test.ts) · [`staff-free-agency`](../tests/systems/staff-free-agency.test.ts) · [`staff-ai-management`](../tests/systems/staff-ai-management.test.ts)

### systems (transactions / draft / awards / DL)

[`trades/trade-engine`](../tests/systems/trades/trade-engine.test.ts) · [`trades/trade-block-finder`](../tests/systems/trades/trade-block-finder.test.ts) · [`trades/asset-valuation/valuation`](../tests/systems/trades/asset-valuation/valuation.test.ts) · [`trades/star-premium`](../tests/systems/trades/star-premium.test.ts) · [`trades/draft-picks`](../tests/systems/trades/draft-picks.test.ts) · [`trades/characterization-legacy`](../tests/systems/trades/characterization-legacy.test.ts) · [`trade-ownership-safeguards`](../tests/systems/trade-ownership-safeguards.test.ts) · [`owned-team-trade-offer`](../tests/systems/owned-team-trade-offer.test.ts) · [`free-agency`](../tests/systems/free-agency.test.ts) · [`free-agency-multi-season`](../tests/systems/free-agency-multi-season.test.ts) · [`draft/draft-engine`](../tests/systems/draft/draft-engine.test.ts) · [`draft/draft-scouting-overhaul`](../tests/systems/draft/draft-scouting-overhaul.test.ts) · [`fantasy-draft/fantasy-draft`](../tests/systems/fantasy-draft/fantasy-draft.test.ts) · [`fantasy-draft/fantasy-draft-analysis`](../tests/systems/fantasy-draft/fantasy-draft-analysis.test.ts) · [`scouting/no-omniscience`](../tests/systems/scouting/no-omniscience.test.ts) · [`awards/yearly-awards`](../tests/systems/awards/yearly-awards.test.ts) · [`awards/monthly-awards`](../tests/systems/awards/monthly-awards.test.ts) · [`awards/award-selectors`](../tests/systems/awards/award-selectors.test.ts) · [`awards/award-reputation`](../tests/systems/awards/award-reputation.test.ts) · [`awards/development-league-exclusion`](../tests/systems/awards/development-league-exclusion.test.ts) · [`award-stat-sources`](../tests/systems/award-stat-sources.test.ts) · [`development-league/core`](../tests/systems/development-league/core.test.ts) · [`development-league/enforce-roster-cap`](../tests/systems/development-league/enforce-roster-cap.test.ts) · [`development-league/trades-migration`](../tests/systems/development-league/trades-migration.test.ts)

### systems (owner / franchise / economy)

[`owner-decisions/owner-decisions`](../tests/systems/owner-decisions/owner-decisions.test.ts) · [`owner-city-selection`](../tests/systems/owner-city-selection.test.ts) · [`owner-franchise-branding`](../tests/systems/owner-franchise-branding.test.ts) · [`owner-notifications`](../tests/systems/owner-notifications.test.ts) · [`owner-objectives`](../tests/systems/owner-objectives.test.ts) · [`ownership-expectations`](../tests/systems/ownership-expectations.test.ts) · [`ownership-alignment-signals`](../tests/systems/ownership-alignment-signals.test.ts) · [`ownership-confidence-engine`](../tests/systems/ownership-confidence-engine.test.ts) · [`ownership-confidence-notifications`](../tests/systems/ownership-confidence-notifications.test.ts) · [`confirm-controlled-franchises`](../tests/systems/confirm-controlled-franchises.test.ts) · [`city-selection-areas`](../tests/systems/city-selection-areas.test.ts) · [`ai-team-decisions`](../tests/systems/ai-team-decisions.test.ts) · [`ai-franchise-decisions`](../tests/systems/ai-franchise-decisions.test.ts) · [`ai-game-day-promotions`](../tests/systems/ai-game-day-promotions.test.ts) · [`team-ai-identity`](../tests/systems/team-ai-identity.test.ts) · [`franchise-ai-preferences`](../tests/systems/franchise-ai-preferences.test.ts) · [`franchise-behavioral-pairs`](../tests/systems/franchise-behavioral-pairs.test.ts) · [`franchise-economy`](../tests/systems/franchise-economy.test.ts) · [`franchise-eras/eras`](../tests/systems/franchise-eras/eras.test.ts) · [`franchise-history`](../tests/systems/franchise-history.test.ts) · [`franchise-identity-generation`](../tests/systems/franchise-identity-generation.test.ts) · [`franchise-identity-persistence`](../tests/systems/franchise-identity-persistence.test.ts) · [`franchise-organizational-traits`](../tests/systems/franchise-organizational-traits.test.ts) · [`franchise-pressure-signals`](../tests/systems/franchise-pressure-signals.test.ts) · [`franchise-report/annual-report`](../tests/systems/franchise-report/annual-report.test.ts) · [`franchise-strategic-posture`](../tests/systems/franchise-strategic-posture.test.ts) · [`franchise-trajectory-context`](../tests/systems/franchise-trajectory-context.test.ts) · [`franchise-value-arc`](../tests/systems/franchise-value-arc.test.ts) · [`relocation`](../tests/systems/relocation.test.ts) · [`relocation-branding`](../tests/systems/relocation-branding.test.ts) · [`expansion`](../tests/systems/expansion.test.ts) · [`historical-milestones`](../tests/systems/historical-milestones.test.ts)

Finance / ops: [`salary-cap`](../tests/systems/salary-cap.test.ts) · [`salary-scale`](../tests/systems/salary-scale.test.ts) · [`team-finances`](../tests/systems/team-finances.test.ts) · [`ticket-revenue`](../tests/systems/ticket-revenue.test.ts) · [`cash-projection`](../tests/systems/cash-projection.test.ts) · [`demand`](../tests/systems/demand.test.ts) · [`facilities`](../tests/systems/facilities.test.ts) · [`sponsorships`](../tests/systems/sponsorships.test.ts) · [`marketing`](../tests/systems/marketing.test.ts) · [`fan-sentiment`](../tests/systems/fan-sentiment.test.ts) · [`financial-health`](../tests/systems/financial-health.test.ts) · [`financial-spending`](../tests/systems/financial-spending.test.ts) · [`gameplay-financial-consequences`](../tests/systems/gameplay-financial-consequences.test.ts) · [`triple-pool-finance`](../tests/systems/triple-pool-finance.test.ts) · [`economic-scenarios`](../tests/systems/economic-scenarios.test.ts) _(regression)_ · [`game-day-promotions`](../tests/systems/game-day-promotions.test.ts) · [`game-day-promotions-effects`](../tests/systems/game-day-promotions-effects.test.ts) · [`game-day-promotions-settlement`](../tests/systems/game-day-promotions-settlement.test.ts) · [`media-hub/deterministic-media`](../tests/systems/media-hub/deterministic-media.test.ts) · [`narrative/narrative`](../tests/systems/narrative/narrative.test.ts) · [`narrative/attendance-chain`](../tests/systems/narrative/attendance-chain.test.ts)

### systems (custom content / misc)

[`custom-content-validation`](../tests/systems/custom-content/custom-content-validation.test.ts) · [`custom-content-state-invariants`](../tests/systems/custom-content/custom-content-state-invariants.test.ts) · [`custom-content-id-collision`](../tests/systems/custom-content/custom-content-id-collision.test.ts) · [`custom-roster-import`](../tests/systems/custom-content/custom-roster-import.test.ts) · [`custom-roster-editing`](../tests/systems/custom-content/custom-roster-editing.test.ts) · [`custom-draft-class-import`](../tests/systems/custom-content/custom-draft-class-import.test.ts) · [`custom-draft-class-validation`](../tests/systems/custom-content/custom-draft-class-validation.test.ts) · [`custom-draft-class-lifecycle`](../tests/systems/custom-content/custom-draft-class-lifecycle.test.ts) · [`team-abbreviation`](../tests/systems/team-abbreviation.test.ts) · [`game-archive-size`](../tests/systems/game-archive-size.test.ts) · [`playtest-helpers`](../tests/systems/playtest-helpers.test.ts)

### simulation (Lab harness — unit unless noted)

[`analytics/stats`](../tests/simulation/analytics/stats.test.ts) · [`validation/validation`](../tests/simulation/validation/validation.test.ts) · [`playtest-metrics`](../tests/simulation/playtest-metrics.test.ts) · [`league-sanity/league-sanity`](../tests/simulation/league-sanity/league-sanity.test.ts) _(regression)_ · [`league-sanity/regression`](../tests/simulation/league-sanity/regression.test.ts) _(regression)_

Lab: [`calibration`](../tests/simulation/lab/calibration.test.ts) · [`check-invariants`](../tests/simulation/lab/check-invariants.test.ts) · [`chunk-indexes`](../tests/simulation/lab/chunk-indexes.test.ts) · [`clamp`](../tests/simulation/lab/clamp.test.ts) · [`confidence`](../tests/simulation/lab/confidence.test.ts) · [`dry-run`](../tests/simulation/lab/dry-run.test.ts) · [`engine-version`](../tests/simulation/lab/engine-version.test.ts) · [`engine-version-compare`](../tests/simulation/lab/engine-version-compare.test.ts) · [`event-log-diff`](../tests/simulation/lab/event-log-diff.test.ts) · [`games-ndjson`](../tests/simulation/lab/games-ndjson.test.ts) · [`golden-baseline`](../tests/simulation/lab/golden-baseline.test.ts) · [`graduation`](../tests/simulation/lab/graduation.test.ts) · [`harness-negative`](../tests/simulation/lab/harness-negative.test.ts) · [`injury-heavy`](../tests/simulation/lab/injury-heavy.test.ts) · [`invariants-hard`](../tests/simulation/lab/invariants-hard.test.ts) _(simulation)_ · [`ks`](../tests/simulation/lab/ks.test.ts) · [`lab-config`](../tests/simulation/lab/lab-config.test.ts) · [`lab-seeds`](../tests/simulation/lab/lab-seeds.test.ts) · [`list-scenarios`](../tests/simulation/lab/list-scenarios.test.ts) · [`long-horizon`](../tests/simulation/lab/long-horizon.test.ts) _(simulation)_ · [`manifest`](../tests/simulation/lab/manifest.test.ts) · [`ot-warning`](../tests/simulation/lab/ot-warning.test.ts) · [`regression`](../tests/simulation/lab/regression.test.ts) · [`replay`](../tests/simulation/lab/replay.test.ts) · [`run-index`](../tests/simulation/lab/run-index.test.ts) · [`run-lab-games`](../tests/simulation/lab/run-lab-games.test.ts) · [`run-lab-schedule`](../tests/simulation/lab/run-lab-schedule.test.ts) · [`scale`](../tests/simulation/lab/scale.test.ts) · [`scenarios`](../tests/simulation/lab/scenarios.test.ts) · [`season-rng-desync`](../tests/simulation/lab/season-rng-desync.test.ts) _(simulation)_ · [`simulate-game-pbt`](../tests/simulation/lab/simulate-game-pbt.test.ts) _(simulation)_ · [`sweep`](../tests/simulation/lab/sweep.test.ts)

### regression

[`active-owner-calendar-scope`](../tests/regression/active-owner-calendar-scope.test.ts) · [`cross-surface-parity`](../tests/regression/cross-surface-parity.test.ts) · [`franchise-identity-simulation`](../tests/regression/franchise-identity-simulation.test.ts) · [`multi-team-transaction-invariants`](../tests/regression/multi-team-transaction-invariants.test.ts) · [`phase5-cross-system-flows`](../tests/regression/phase5-cross-system-flows.test.ts) · [`post-trade-simulation`](../tests/regression/post-trade-simulation.test.ts) · [`season-rollover-integrity`](../tests/regression/season-rollover-integrity.test.ts)

### state / unit (selectors) / persistence / application UI data

State: [`award-history-view`](../tests/state/award-history-view.test.ts) · [`create-initial-state-league-area`](../tests/state/create-initial-state-league-area.test.ts) · [`franchise-health`](../tests/state/franchise-health.test.ts) · [`franchise-history-milestones`](../tests/state/franchise-history-milestones.test.ts) · [`franchise-history-view`](../tests/state/franchise-history-view.test.ts) · [`franchise-value`](../tests/state/franchise-value.test.ts) · [`game-box-score-selectors`](../tests/state/game-box-score-selectors.test.ts) · [`game-state`](../tests/state/game-state.test.ts) · [`history-hub-legacy-empty`](../tests/state/history-hub-legacy-empty.test.ts) · [`league-history-view`](../tests/state/league-history-view.test.ts) · [`league-leaders-selectors`](../tests/state/league-leaders-selectors.test.ts) · [`owner-context`](../tests/state/owner-context.test.ts) · [`owner-dashboard`](../tests/state/owner-dashboard.test.ts) · [`owner-game-state`](../tests/state/owner-game-state.test.ts) · [`owner-selectors`](../tests/state/owner-selectors.test.ts) · [`ownership-confidence-view`](../tests/state/ownership-confidence-view.test.ts) · [`player-history-view`](../tests/state/player-history-view.test.ts) · [`standings-page-params`](../tests/state/standings-page-params.test.ts) · [`standings-selectors`](../tests/state/standings-selectors.test.ts) · [`team-branding-selectors`](../tests/state/team-branding-selectors.test.ts) · [`team-history-view`](../tests/state/team-history-view.test.ts)

Unit selectors: [`action-center-selectors`](../tests/unit/action-center-selectors.test.ts) · [`calendar-resume-target`](../tests/unit/calendar-resume-target.test.ts) · [`contract-hub-selectors`](../tests/unit/contract-hub-selectors.test.ts) · [`development-hub-selectors`](../tests/unit/development-hub-selectors.test.ts) · [`development-league-hub-selectors`](../tests/unit/development-league-hub-selectors.test.ts) · [`draft-hub-selectors`](../tests/unit/draft-hub-selectors.test.ts) · [`entity-drawer-selectors`](../tests/unit/entity-drawer-selectors.test.ts) · [`event-attention-tiers`](../tests/unit/event-attention-tiers.test.ts) · [`finance-hub-selectors`](../tests/unit/finance-hub-selectors.test.ts) · [`franchise-hub-selectors`](../tests/unit/franchise-hub-selectors.test.ts) · [`league-hub-selectors`](../tests/unit/league-hub-selectors.test.ts) · [`league-schedule-selectors`](../tests/unit/league-schedule-selectors.test.ts) · [`lineup-rotation-editor`](../tests/unit/lineup-rotation-editor.test.ts) · [`media-hub-selectors`](../tests/unit/media-hub-selectors.test.ts) · [`offseason-hub-selectors`](../tests/unit/offseason-hub-selectors.test.ts) · [`owner-nav-upgrade`](../tests/unit/owner-nav-upgrade.test.ts) · [`phase4-simulation-refresh`](../tests/unit/phase4-simulation-refresh.test.ts) · [`phase5-entity-drawer-visibility`](../tests/unit/phase5-entity-drawer-visibility.test.ts) · [`phase5-hub-selectors`](../tests/unit/phase5-hub-selectors.test.ts) · [`phase5-offseason-lifecycle`](../tests/unit/phase5-offseason-lifecycle.test.ts) · [`phase5-simulation-refresh`](../tests/unit/phase5-simulation-refresh.test.ts) · [`phase5-state-invariants`](../tests/unit/phase5-state-invariants.test.ts) · [`player-overall-change`](../tests/unit/player-overall-change.test.ts) · [`recent-form-selectors`](../tests/unit/recent-form-selectors.test.ts) · [`roster-depth-chart`](../tests/unit/roster-depth-chart.test.ts) · [`roster-needs`](../tests/unit/roster-needs.test.ts) · [`roster-page-selectors`](../tests/unit/roster-page-selectors.test.ts) · [`staff-hub-selectors`](../tests/unit/staff-hub-selectors.test.ts) · [`standings-selectors`](../tests/unit/standings-selectors.test.ts) · [`team-hub-selectors`](../tests/unit/team-hub-selectors.test.ts) · [`team-recent-history-selectors`](../tests/unit/team-recent-history-selectors.test.ts) · [`transaction-hub-selectors`](../tests/unit/transaction-hub-selectors.test.ts) · [`vitest-txt-reporter`](../tests/unit/vitest-txt-reporter.test.ts)

Persistence: [`game-state-mapper`](../tests/persistence/game-state-mapper.test.ts) · [`save-game-store`](../tests/persistence/save-game-store.test.ts) · [`prisma-save-game-store`](../tests/persistence/prisma-save-game-store.test.ts) · [`save-projection-mapper`](../tests/persistence/save-projection-mapper.test.ts) · [`save-if-updated-at`](../tests/persistence/save-if-updated-at.test.ts) · [`game-day-promotions-migration`](../tests/persistence/game-day-promotions-migration.test.ts) · [`migration-multi-year`](../tests/persistence/migration-multi-year.test.ts) _(regression)_ · [`migration-v31`](../tests/persistence/migration-v31.test.ts) · [`migration-v32`](../tests/persistence/migration-v32.test.ts) · [`migration-v33`](../tests/persistence/migration-v33.test.ts) · [`migration-v35`](../tests/persistence/migration-v35.test.ts) · [`migration-v36`](../tests/persistence/migration-v36.test.ts) · [`migration-v37`](../tests/persistence/migration-v37.test.ts) · [`migration-v39`](../tests/persistence/migration-v39.test.ts) · [`migration-v41-to-v42`](../tests/persistence/migration-v41-to-v42.test.ts) · [`migration-v57`](../tests/persistence/migration-v57.test.ts) · [`migration-v59-v60`](../tests/persistence/migration-v59-v60.test.ts) · [`migration-v61-v62`](../tests/persistence/migration-v61-v62.test.ts) · [`migration-v62-to-v64`](../tests/persistence/migration-v62-to-v64.test.ts)

### react / components / data / factories

React (`*.test.tsx`, jsdom): [`action-center`](../tests/react/action-center.test.tsx) · [`ai-team-management`](../tests/react/ai-team-management.test.tsx) · [`calendar-workspace`](../tests/react/calendar-workspace.test.tsx) · [`CityMapPicker`](../tests/react/CityMapPicker.test.tsx) · [`desktop-navigation`](../tests/react/desktop-navigation.test.tsx) · [`dl-pipeline-summary`](../tests/react/dl-pipeline-summary.test.tsx) · [`dl-prospect-card`](../tests/react/dl-prospect-card.test.tsx) · [`dl-team-performance-panel`](../tests/react/dl-team-performance-panel.test.tsx) · [`entity-drawer-provider`](../tests/react/entity-drawer-provider.test.tsx) · [`finance-hub-ui`](../tests/react/finance-hub-ui.test.tsx) · [`franchise-history-ui`](../tests/react/franchise-history-ui.test.tsx) · [`franchise-hub-ui`](../tests/react/franchise-hub-ui.test.tsx) · [`game-setup`](../tests/react/game-setup.test.tsx) · [`game-shell`](../tests/react/game-shell.test.tsx) · [`GeographicMap`](../tests/react/GeographicMap.test.tsx) · [`history-hub-ui`](../tests/react/history-hub-ui.test.tsx) · [`league-hub`](../tests/react/league-hub.test.tsx) · [`mobile-tap-targets`](../tests/react/mobile-tap-targets.test.tsx) · [`owner-decision-ui`](../tests/react/owner-decision-ui.test.tsx) · [`owner-entry`](../tests/react/owner-entry.test.tsx) · [`owner-team-switcher`](../tests/react/owner-team-switcher.test.tsx) · [`owner-ui`](../tests/react/owner-ui.test.tsx) · [`SmokeLabel`](../tests/react/SmokeLabel.test.tsx) · [`splash`](../tests/react/splash.test.tsx) · [`staff-coaching`](../tests/react/staff-coaching.test.tsx) · [`standings-hub`](../tests/react/standings-hub.test.tsx) · [`team-hub-nav`](../tests/react/team-hub-nav.test.tsx) · [`TeamIdentityBuilder`](../tests/react/TeamIdentityBuilder.test.tsx) · [`team-identity-inline`](../tests/react/team-identity-inline.test.tsx) · [`TeamLeaguePlacement`](../tests/react/TeamLeaguePlacement.test.tsx) · [`TeamNicknameField`](../tests/react/TeamNicknameField.test.tsx) · [`TransactionFilters`](../tests/react/TransactionFilters.test.tsx)

[`tests/react/stream-simulate-to-date.test.ts`](../tests/react/stream-simulate-to-date.test.ts) is a **`.ts` file**, so it runs in the **unit** Node project, not jsdom.

Components / data / factories: [`map-marker-layout`](../tests/components/map-marker-layout.test.ts) · [`region-map-projection`](../tests/components/region-map-projection.test.ts) · [`city-pools`](../tests/data/city-pools.test.ts) · [`team-logo-catalog`](../tests/data/team-logo-catalog.test.tsx) _(react)_ · [`factories`](../tests/factories/factories.test.ts) · [`factories/game`](../tests/factories/game.test.ts)
