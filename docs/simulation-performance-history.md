# Simulation performance history

Baselines measured on the developer machine after each major optimization phase.

## After Phase 1–4 (GameSimState + date index + incremental standings + lineup cache) — 2026-08-25

### Game cost model (period length scaling)

| Period seconds | Possessions | Events | Total ms | Validation ms |
|---|---|---|---|---|
| 24 | 10 | 9 | ~4 | ~0.2 |
| 120 | 41 | 43 | ~2–3 | ~0.1 |
| 720 (production) | 248 | 284 | **~5–6** | **~0.1** |

Interpretation: runtime scales with possessions; validation is no longer quadratic (was previously the dominant cost via per-possession `createGame`/`assertEvents`).

### Full CBL season (day-by-day `advanceSimulation`)

| Bucket | Time | Share |
|---|---|---|
| **Total** | **~0.9s** (58 days → postseason) | 100% |
| Game simulation | 0.38s | 42% |
| Owner gameplay | 0.24s | 26% |
| Narrative | 0.15s | 16% |
| Weekly pipeline | 0.09s | 10% |
| Standings | ~0s | ~0% |
| Games / playoff games | 167 / 35 | — |

### until_phase audit (`days: 400`, `stopOnPhaseChange`)

| Metric | Value |
|---|---|
| Requested days | 400 |
| Actual days | 1 (preseason → regular) |
| Games simulated | 6 |
| Elapsed | ~0.07s |
| Stopped early | yes |

### Targets (from plan)

| Scope | Tier 1 | Tier 2 | Tier 3 | Observed |
|---|---|---|---|---|
| 1 production game | sub-second | 100–200ms | <50ms | **~5–8ms** (Tier 3) |
| Full season | 30–45s | — | — | **~0.9s** |

Re-run:

```bash
npm run bench:sim:game
npm run bench:sim:season
```
