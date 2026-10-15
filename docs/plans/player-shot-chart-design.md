# Player Shot Chart — Design Proposal

Status: proposal only. No code has been written. Needs approval before any simulation or save-format work starts.

Context: the player card redesign (Overview / Attributes / Statistics / Development) shipped without a shot chart because BallSim does not record where shots are taken. This note describes what would have to change to support one, and the trade-offs.

---

## 1. What exists today

| Layer                                                           | What it knows about shots                                                                                                                                                                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Possession sim (`src/systems/possession-decision-selection.ts`) | `getShotSelectionWeights` picks one of **three locations: `three`, `mid`, `finish`** (weighted by `threePoint`, `midRange`, `finishing`). `chooseShotType` then collapses `mid` and `finish` into `"two_point"`. The location is discarded. |
| Shot resolution (`src/systems/shot-resolution.ts`)              | Two shot types only. **Every two-point attempt uses the mean of `finishing` and `midRange`** for its make chance, so a rim attempt and a mid-range attempt by the same player are equally likely to go in.                                  |
| Fast box-score sim (`src/systems/game-simulation-box-score.ts`) | No possessions. It allocates points and derives FGM/FGA and 3PM/3PA from rates. It does not model individual shots at all.                                                                                                                  |
| Box score (`GamePlayerStats`)                                   | FGM/FGA, 3PM/3PA, FTM/FTA. No location.                                                                                                                                                                                                     |
| Play-by-play                                                    | Kept only for the owner's games, and dropped when games are archived.                                                                                                                                                                       |

**Which mode simulates which game** (`src/systems/game-simulation.ts`, `src/application/game-service/owner-time-advance.ts`):

- The owner's games: always the possession sim.
- Single-day advances: every game uses the possession sim.
- Multi-day or "sim to date" advances: **CPU-vs-CPU games use the fast box-score sim.**

So even if the possession sim recorded locations, most games for most non-owner players would have none.

## 2. Recommended data model: zone totals, not coordinates

Record **made and attempted per zone, per player, per game**, not individual shot coordinates.

- Zones (v1): `rim` (from the `finish` location), `mid` (from `mid`), `three` (from `three`). A later version could split corner threes and the paint, but only if the sim starts choosing them.
- Coordinates would require inventing x/y positions the sim never decides. That is the "inferring locations" the original brief ruled out.
- Size: 6 integers per player row. Rough archive growth is about 6 × 26 players × 1,300 games ≈ 200k numbers per season, a modest increase over today's 22 fields per row.

Proposed shape, an optional field so older rows and fast-sim rows simply lack it:

```ts
// src/domain/entities/game.ts
export type ShotZoneLine = { made: number; attempted: number };
export type GamePlayerShotZones = {
  rim: ShotZoneLine;
  mid: ShotZoneLine;
  three: ShotZoneLine;
};

export type GamePlayerStats = {
  // ...existing fields
  /** Possession-sim games only. Absent for legacy rows and fast box-score games. */
  shotZones?: GamePlayerShotZones;
};
```

**Invariant** (added to `validateCompletedGameBoxScore`): when `shotZones` is present, `rim + mid + three` must equal FGM/FGA, and `three` must equal 3PM/3PA.

## 3. Simulation changes (possession sim)

1. Carry the chosen location through the decision. Add `shotZone: "rim" | "mid" | "three"` next to `shotType` on the shot and shooting-foul decisions in `possession-decision.ts`. `chooseShotType` already has the location, so it would return both. **No new RNG draws**, so the random-number stream and existing game outcomes stay identical.
2. Accumulate attempts and makes per zone in `possession-stats.ts`, alongside the existing FGM/FGA updates. Follow the existing FGA rules exactly: a shooting foul with a miss is not a field-goal attempt, and an and-one counts the make.
3. Write `shotZones` into the final `GamePlayerStats` rows.

Determinism risk is low, because the RNG call order is unchanged. Golden-save snapshots and any test that deep-compares box-score rows will change, since rows gain a field. Update those expectations; outcomes should not move.

### 3a. Separate decision: rim and mid-range make rates (balance change)

With the sim as it is, a player's rim FG% and mid-range FG% come out roughly equal, because both use `(finishing + midRange) / 2`. That chart would be accurate, but it says little and looks unrealistic.

The fix is a **balance change**: rim attempts use `finishing` and mid-range attempts use `midRange`, each with its own zone adjustment in `SHOT_RESOLUTION_CONFIG`. This **changes game results**, so it needs:

- recalibration against the existing targets (`npm run test:simulation`, `npm run sanity:league`, the fidelity-parity tests);
- fast box-score calibration kept in line (`BOX_SCORE_SHOT_CALIBRATION`);
- its own review and approval, separate from the shot-chart work.

**Recommendation:** ship zone recording first, with no balance change. Decide on differentiated make rates as a separate, approved balance task.

## 4. Fast box-score games

The fast sim has no shots, so it has nothing to record. Options:

| Option                                                                                                       | Pros                                  | Cons                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. No zone data for fast-sim games (recommended for v1)**                                                  | Honest: only observed shots are shown | Thin coverage for non-owner players after multi-day sims                                                                                                                              |
| B. Split each 2PA/2PM into rim and mid with a deterministic formula from the same selection weights (no RNG) | Full coverage                         | It is a modelled estimate, not an observation, and must be labelled "estimated". It also adds work to the fast path (performance budget in `docs/simulation-performance-history.md`). |
| C. Use the possession sim for every game                                                                     | Real data everywhere                  | Large slowdown on multi-day sims; not acceptable                                                                                                                                      |

With option A, the chart shows its coverage, for example "Based on 41 of 82 games simulated possession-by-possession", and hides itself below a minimum number of attempts.

## 5. Persistence and migration

- Save format: bump the `GameState` schema version. The migration is a **no-op for data**: old rows keep no `shotZones` field, and **there is no backfill**, because past locations were never recorded.
- Persistence validation: accept an optional `shotZones` with non-negative integers.
- Archive: `compactGameForArchive` already copies whole rows, so the zones are kept automatically.
- Season-end snapshots (`PlayerSeasonRecord`): **unchanged**. Zone totals come from archived games through `aggregatePlayerGames`, like the other extra columns.
- Aggregation: `PlayerStatLine` gains `shotZones` totals plus `zoneTrackedGames`, the number of games that had zone data, so the UI can state its coverage. Totals are summed only over games that have the field.
- No Prisma changes. Stats live in `stateJson`.

## 6. UI

- A half-court SVG in the Statistics tab, below the grouped stats, with three shaded zones: restricted area, mid-range and the arc.
- Each zone shows made–attempted and FG%, coloured by efficiency against the player's own overall FG%. A league-average comparison can come later; it would need league zone aggregates.
- Uses the same season, split and scope controls as the rest of the tab.
- Coverage note, plus an empty state when no tracked games exist: "Shot locations are recorded for games simulated possession-by-possession."
- Accessibility: zones are labelled SVG groups with an `sr-only` table of zone, made, attempted and %.

## 7. Phased plan

1. **Domain and sim:** carry the zone through the possession decision and stats, add the optional field and the invariant. Tests: invariant, determinism (same seed gives the same outcomes as before), and zone sums matching FGM/FGA and 3PM/3PA.
2. **Persistence:** schema version bump, migration and validation. Tests: migration round-trip, legacy saves load without zones.
3. **Aggregation:** zone totals and coverage in `PlayerStatLine`. Tests: mixed tracked and untracked games, trades, season rollover.
4. **UI:** half-court component and coverage messaging.
5. (Separate, optional) **Balance change** from §3a, with recalibration.

Steps 1–3 touch simulation and saved-game shape, so under the project rules they are written in the main session, not delegated, and reviewed with the `reviewer` agent.

## 8. Risks and open questions

- **Coverage:** with option A, most CPU players' charts depend on how the user advances time. Is that acceptable for v1, or is option B's labelled estimate preferred?
- **Balance:** do we want differentiated rim and mid-range make rates (§3a)? Without them, zone FG% is less informative.
- **Zones:** are three zones enough, or should the sim learn corner versus above-the-break threes? That would be a new sim decision, so it is out of scope here.
- **Save size:** small, but measure with `npm run playtest:metrics` (`gameArchiveBytes`) before and after.
