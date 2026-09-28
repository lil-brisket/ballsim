# Issue #61 — Awards and History Audit

Issue: [lil-brisket/ballsim#61](https://github.com/lil-brisket/ballsim/issues/61)

This audit is the implementation gate for the League History / Awards Hub. Each row cites the type or function in the current branch. `GameState` stays canonical; no parallel `state.history` store is introduced.

## Feature map

| Requested feature | Existing data source | Existing selector | Missing? | Plan |
|---|---|---|---|---|
| Current-season awards | `business.awards.results` (`AwardHistoryState`) | `toAwardsHubView` (`src/state/awards-hub-selectors.ts`) | No | Extend with per-slot `AwardAvailability` |
| Historical award winners | `business.awards.results` | `toLeagueAwardsView`, `listAwardResults` (`src/state/award-selectors.ts`) | No | Add layout-agnostic `toAwardHistoryView` |
| League champion by season | `business.franchiseHistory[*].seasons[].championship` | none (league-wide) | Partial | New `toLeagueHistoryView` (`src/state/league-history-selectors.ts`) |
| Runner-up | `FranchiseSeasonRecord.playoffResult === "finals"` (power-of-2 brackets only) | none | Derivable (defensive) | Show only when exactly one non-champion `"finals"` team exists; otherwise omit. No schema change |
| Conference champions | not stored | none | Yes | Omit |
| Team all-time records | `business.franchiseHistory` | `toFranchiseHistoryView` (owner team only), `computeFranchiseHistoryMilestones` | Partial | Add `toTeamHistoryView(state, teamId)`; owner view wraps it |
| Player career history | `business.playerHistory`, `business.awards` | profile selectors only | Yes (hub) | New `src/state/player-history-selectors.ts` |

Schema decision: no `GAME_STATE_SCHEMA_VERSION` bump (currently `61`). Legacy saves already migrate empty `awards` (v56→v57) and `gameArchive` / `playerHistory` (v35→v36).

## Verified types

`src/domain/entities/awards.ts`

- `AwardResult { id, awardId, cadence, leagueId, seasonId, seasonYear, period, winner: AwardSubjectRef, candidates, context }`
- `period`: `YYYY-MM` for monthly, `"midseason"` for midseason awards, `null` for yearly
- `AwardHistoryState { results: Record<string, AwardResult> }`
- `AwardDefinition { id, cadence, displayName, shortLabel, subjectType, tier }`, `AwardTier = "major" | "monthly" | "midseason"`

`src/systems/awards/award-definitions.ts`

- `AWARD_DEFINITIONS` has 3 monthly, 6 major yearly (`YEARLY_AWARD_IDS`: mvp, dpoy, roy, sixth_man, most_improved, coach_of_year), 5 midseason
- There is **no** Finals MVP or postseason award. None will be invented

`src/domain/entities/franchise-history.ts`

- `FranchiseSeasonRecord { seasonId, seasonYear, wins, losses, playoffResult, championship, ..., city, name, relocated }`
- `PlayoffResultSnapshot = "missed" | "first_round" | "second_round" | "conference_finals" | "finals" | "champion"`
- `PLAYOFF_RESULT_DEPTH` ordinal map (`finals` = 4, `champion` = 5), `isPlayoffAppearance(result)` = `result !== "missed"`, `playoffResultDepth(result)`

`src/domain/entities/player-history.ts`

- `PlayerHistory { playerId, seasons: PlayerSeasonRecord[], trackingStartedSeasonYear }`
- `PlayerSeasonRecord.contractSnapshot { contractId, salary, teamId }`
- No name snapshot fields on `PlayerHistory` or `PlayerSeasonRecord`

## Meaning of `playoffResult === "finals"`

`src/systems/franchise-history.ts`:

- `eliminationSnapshotForRound(round, fieldSize)` returns `"finals"` only when `playoffRoundLabel(round, fieldSize) === "final"` — i.e. the team **lost the championship series**
- `derivePlayoffResults` overwrites `championTeamId` to `"champion"`, so the winner never keeps `"finals"`
- Non-power-of-2 field sizes (6, 12) short-circuit to `"first_round"` / `"second_round"`; those seasons never emit `"finals"`

Conclusion: `"finals"` means championship-series loser. Runner-up is shown only when exactly one champion and exactly one non-champion `"finals"` team exist for that season; otherwise it is omitted. `gameArchive` ID parsing is not used.

## Player identity and retirement

`src/systems/player-retirement.ts` (`processPlayerRetirements`) keeps the player in `world.players` and sets `retired: true`, `teamId: null`, `contractId: null`. `firstName` / `lastName` are preserved. Player History names come from `world.players`; if a history key has no world entity, the selector falls back to `playerId` and does not invent a name.

## Lifecycle (write timing)

- Monthly awards: `runMonthlyPipeline` → `runMonthlyAwards(state, completedMonthId)`; only in `regular` phase; months with zero primary games are skipped (`src/systems/simulation/monthly-pipeline.ts`, `src/systems/awards/award-pipeline.ts`)
- Midseason awards: `processMidseasonAwards` when `simulatedDate >= announceDate`; state in `competition.seasonEvents.midseasonAwards { seasonId, cutoffDate, announceDate, status: "scheduled" | "announced" | "cancelled", resultIds }`
- Yearly awards: `processSeasonLifecycle` calls `runYearlyAwards` once the regular season completes, before `startPlayoffs` (`src/systems/simulation/season-lifecycle.ts`)
- Franchise and player history: `runSeasonTransition` (`src/systems/simulation/offseason-lifecycle.ts`) runs `archiveCompletedSeasonGames` → `appendAllPlayerSeasonRecords` → `appendAllFranchiseSeasonRecords` → … → `processPlayerRetirements`. History is appended before retirement, so a retiring player's final season keeps their team-of-record
- `contractSnapshot.teamId` = `player.teamId` at season transition (team-of-record at season end)
- `initializeNewSeason` resets `competition.playoffs`; live `championTeamId` is not historical. The hub reads champions only from `FranchiseSeasonRecord`

## Chosen behaviors

- **Championship credit**: a player's championship history uses the team-of-record at season end (`contractSnapshot.teamId`), not every team they appeared for. Traded away from the eventual champion → 0; traded onto the champion before season end → 1
- **Award availability** (current season), derived in the selector: `won` / `pending` / `not_started` / `not_applicable`
- **Team records**: titles = `championship === true`; playoff apps = `isPlayoffAppearance`; finals apps = `playoffResultDepth(result) >= playoffResultDepth("finals")`; best/worst record by win% → wins → earliest season

## Will not show

- Conference / division champions
- Live playoff champion before season finalization
- Records inferred from current standings or rosters
- Championship credit from partial-season stints
- Runner-up when there is not exactly one championship-series loser
- Awards not in `AWARD_DEFINITIONS` (including Finals MVP)
- Invented player names
