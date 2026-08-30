# BallSim Hard Locks

Authoritative documentation for league hard locks, phase locks, and configurable settings.

## Phase authority

- **`competition.phase.activePhaseId`** is the sole authoritative league phase.
- **`competition.season.phase`** / **`offseasonStage`** are derived/legacy compatibility fields, written by `setActivePhase`.
- Transaction legality must use `getActivePhaseId` / `canPerformAction`, never `season.phase` alone.

## Rule tiers

| Tier | Meaning | Examples |
|------|---------|----------|
| **Hard lock** | Never configurable | 2 draft rounds; 60% calendar-span trade deadline; 3-year pick horizon; one RFA offer sheet; retirement irreversible |
| **Phase lock** | Depends on `LeaguePhaseId` | UFA signing only in `offseason.free_agency`; draft selection only in `offseason.draft` |
| **League setting** | `GameState.settings` | Salary cap amount; games per team; playoff format |

### Cosmetic (not availability)

`settings.offseason.freeAgency.durationDays` is a **UI estimate only**. League phase determines whether free agency is open.

## Trade deadline (hard lock)

> The trade deadline is based on **60% of the regular-season calendar span** (first scheduled game date → last scheduled game date). It is **not** based on percentage of games played.

```
spanDays = daysBetween(start, end)
deadlineDate = start + round(spanDays * 0.6)
tradesOpen = (phase === regular) AND (currentDate < deadlineDate)
```

- **Last legal trading date:** `deadlineDate - 1 day`
- **First illegal date:** `deadlineDate` (entire deadline day closed)
- Snapshotted on regular-season start as `competition.season.tradeDeadlineDate`
- Applies to **player and pick** trades
- Offseason / preseason trades reopen per the matrix below

### Concrete example

Season: 2026-10-01 → 2027-04-01 (182 days) → offset 109 → deadline **2027-01-18**

| Date | Legal? |
|------|--------|
| 2027-01-17 | Yes |
| 2027-01-18 | No |
| 2027-01-19 | No |

## Draft pick ownership vs consumption

| Field | Meaning |
|-------|---------|
| `ownerTeamId` | Current owner (tradable while available) |
| `originalTeamId` | Immutable original franchise |
| `status: available \| used` | Consumption — used picks retain ownership history but are untradeable |

Horizon: `pick.seasonYear <= competition.season.year + 3` (inclusive).

Drafts are exactly **2 rounds**.

## Restricted free agency

Lifecycle:

```
season_transition → roster_decisions (QO / classify)
  → draft → free_agency (UFA + RFA offer sheets + match)
```

- RFA status must be established **before** FA opens (`rfaQualificationComplete`).
- One active offer sheet at a time (`activeOfferSheet` with full `ContractInput` terms).
- Match window: 3 calendar days from sheet creation.
- RFA players cannot use the normal UFA `acceptOffer` path.

## Player retirement

During `season_transition` (before contract expiration):

- Active playing contract is **terminated**; future salary removed (no dead money).
- Player removed from roster; `retired: true`.
- Cannot return to FA, be traded, or be re-signed.
- Historical stats preserved.

## Transaction legality matrix

| Action | Offseason (non-FA) | Roster decisions | FA | Preseason | Regular (pre-deadline) | Regular (deadline+) | Playoffs/Post |
|--------|--------------------|------------------|----|-----------|------------------------|---------------------|---------------|
| Player/pick trade | Phase-defined | Allowed | Allowed | Allowed | Allowed | **Blocked** | **Blocked** |
| UFA signing | Blocked | Blocked | Allowed | Blocked | Blocked | Blocked | Blocked |
| RFA QO | Blocked | Allowed | Blocked | Blocked | Blocked | Blocked | Blocked |
| RFA offer sheet / match | Blocked | Blocked | Allowed | Blocked | Blocked | Blocked | Blocked |
| Draft selection | Blocked | Blocked | Blocked | Blocked | Blocked | Blocked | Blocked |
| Contract extension | Phase-defined | Allowed | Phase-defined | Phase-defined | Phase-defined | Phase-defined | Blocked |

Implementation: `src/systems/league-rules/`.

## Idempotency

Lifecycle processors (`processPlayerRetirements`, `releaseExpiredContracts`, `expireTransactionsForClosedWindow`, `finalizeRfaQualification`) must be safe to call twice.

## Deterministic offseason order

1. Archive / history  
2. Player development  
3. Player retirement  
4. Staff development / retirement  
5. Economy / staff AI  
6. Enter roster_decisions → (exit) contract expiration + RFA qualification  
7. Draft prep → draft → free agency → staff → new season  

## Deferred

- Full contract extension negotiation system (windows only)
- Luxury tax enforcement
- Mid-draft pick trades
- Multiple simultaneous RFA offer sheets
