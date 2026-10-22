# BallSim: GM loops plan ("run a front office, not a spreadsheet")

Plan for issue #167 ("gen fix"): the gaps a GM-mode player hits first, the
depth that makes it feel like a real front office, and two doc/data cleanups.

This is systems work. It changes contract, economy, draft and free-agency
rules and the shape of saved data, so per `CLAUDE.md` the rules stay in the
main session and `implementer` only gets UI slices.

Each phase ships a system function, a guarded user action, CPU behaviour where
relevant, and a minimal UI using existing primitives. CPU teams follow the
same rules. Every new rule is a setting with a sensible default.

Constraints: new randomness uses seeded RNG streams with a new salt; every new
saved field gets a migration, a default for old saves, validation and a
migration test; new events go through the event registry; UI follows
`src/components/ui/styles.ts`; fully fictional naming.

## Phases

0. Confirm and decide (this document's findings section).
1. Truth first: refresh `GAME_DESIGN.md`, drop `Team.playStyle`, mark the luxury
   tax setting "Coming soon" until Phase 5.
2. Release, waive and buyout with dead money.
3. User contract extensions (shared with the CPU path).
4. Restricted free agency, finished.
5. Luxury tax and salary floor (5a), Veteran rights (5b), mid-season exception
   (5c, optional).
6. Draft lottery and lottery night.
7. Free agents want more than money.
8. Player morale.
9. Team chemistry.
10. Development plans.
11. Legacy screens: record book, Hall of Fame, retired numbers.

Non-goals: no full CBA (aprons, sign-and-trade, two-way contracts, trade
kickers), no change to trade salary matching (125% stays), no in-game effects
from morale beyond chemistry, no real league terms, teams or players.

## Phase 0 findings (schema v69, 2026-10-22)

1. **Money.** Every payroll number comes from `getTeamPayroll`
   (`src/systems/salary-cap.ts`): cap space, trade matching, AI payroll room,
   the weekly cash drain (`processWeeklyPlayerPayroll`), the cash projection
   and the financial statement's `playerSalaries`. Dead money and tax hook in
   there (plus `getTeamContractualSalaryObligation`) and the memo key must
   include the dead-money store.
2. **Roster limits.** `TRADE_ROSTER_RULES` min 8 / max 15
   (`src/systems/trades-config.ts`). Max is enforced on signing, trades, DL
   recall and the draft; nothing checks the minimum on a release because no
   release of a contracted player exists.
3. **RFA.** `finalizeRfaQualification` runs at the roster-decisions exit,
   _after_ `releaseExpiredContracts` has already cleared every expiring
   player's `contractId`, so nobody is ever classified: RFA is fully dormant.
   `issueQualifyingOffer` has no caller; offer sheets live inline on
   `RfaStatus.activeOfferSheet` in `business.rfaStatuses`;
   `expireRfaOfferSheets` is reached daily in free agency through
   `processWindowExpirations`. Match window 3 days, eligible under 4 years of
   service, QO = 110% of last salary.
4. **Pick projection.** `pick-projection.ts` assumes pure reverse standings
   (worst record = pick 1), with tier labels "strong/likely lottery" only.
5. **Personality.** `workEthic`, `loyalty`, `competitiveness`, `leadership`,
   `composure`, 40–90 at generation (validated 1–99). `workEthic` drives
   development; `leadership` adds a little to fan votes; the rest only feed
   draft interviews and scouting noise.
6. **Head coach.** A `Staff` member with `role === "head_coach"`
   (`findTeamStaffByRole`) and `HeadCoachAttributes` (offense, defense, game
   management, player development, leadership, adaptability, ...). FA can use
   leadership + player development.
7. **History.** Per season: franchise records (W/L, playoffs, payroll, value),
   player season snapshots and stat lines (`playerHistory`), awards, and the
   full game archive with box scores (`gameArchive` + index). Players keep
   `jerseyNumber` and `jerseyTeamId`. No Hall of Fame or record book exists;
   the History page has a team records panel.
8. **Balance baseline** (CBL, 4 sims × 10 seasons, seed 42): see the numbers
   recorded under Phase 5.
9. **playStyle.** Generated, migrated and validated, but nothing reads it.
   `coachingPhilosophy` (read in `game-simulation.ts`) already covers style.

## Decisions (taken on the recommendations, user unavailable)

1. Dead money on the original schedule, no stretch.
2. Buyouts: yes, as a second option in the release dialog.
3. RFA: finish it (and fix the classification order).
4. Tax: tiered rate above a threshold, proceeds split among non-tax teams.
5. Lottery: top 4 picks drawn, flattened odds for the three worst teams; on for
   new saves, off for existing saves.
6. playStyle: drop it.
7. Holdouts: none; trade requests only.
8. Naming: in-game names: "Veteran rights" for the prior-team re-sign
   exception.
9. Order as written.
