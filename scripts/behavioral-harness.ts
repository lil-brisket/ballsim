/**
 * Deterministic multi-season behavioral harness for organizational fingerprints.
 * Diagnostic — not a CI gate.
 *
 * Run: npx tsx scripts/behavioral-harness.ts [seasons] [seed]
 *
 * Success criterion: after N seasons, can you tell organizations apart from history alone?
 */
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { AiProfile } from "@/domain/entities/franchise-ops";
import { draftClassIdFor } from "@/domain/entities/draft";
import {
  declinePlayerOption,
  declineTeamOption,
  getContractStatus,
} from "@/domain/entities/contract";
import { createSeededRng, type Rng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { runAiTeamDecisions } from "@/systems/ai-team-decisions";
import { enforceMaxRosterViaDevelopmentLeague } from "@/systems/development-league/enforce-roster-cap";
import {
  draftYearForSeason,
  getActiveDraftOnClockSlot,
  isUserOnDraftClock,
  makeDraftSelection,
} from "@/systems/draft";
import { resolvePendingOwnerDecision } from "@/systems/owner-decisions";
import { getActivePhaseId } from "@/systems/phase-engine";
import { fillShortRosters } from "@/systems/roster-generation";
import {
  derivePlannedRegularSeasonStartDate,
  needsRegularSeasonInitialization,
} from "@/systems/simulation/season-lifecycle";
import {
  meanFingerprintsByProfile,
  snapshotFranchiseIdentityRow,
  type FranchiseIdentitySnapshotRow,
} from "@/systems/economy/franchise-identity-metrics";
import { resolveFranchisePreferences } from "@/systems/franchise-ai-preferences";
import type { TeamId } from "@/domain/ids";

const PROFILE_CYCLE: AiProfile[] = [
  "win_now",
  "conservative",
  "development",
  "rebuild",
  "market_growth",
  "aggressive",
];

const DAYS_PER_SEASON_APPROX = 200;

function persistRng(state: GameState, rng: Rng): GameState {
  return {
    ...state,
    meta: {
      ...state.meta,
      rngState: rng.getState(),
    },
  };
}

function assignDistinctProfiles(state: GameState): GameState {
  const teamIds = Object.keys(state.world.teams).sort() as TeamId[];
  const franchiseOps = { ...state.business.franchiseOps };
  for (let index = 0; index < teamIds.length; index += 1) {
    const teamId = teamIds[index]!;
    const ops = franchiseOps[teamId];
    if (!ops) {
      continue;
    }
    const profile = PROFILE_CYCLE[index % PROFILE_CYCLE.length]!;
    franchiseOps[teamId] = {
      ...ops,
      aiProfile: profile,
      spendingTolerance:
        profile === "conservative"
          ? 25
          : profile === "win_now" || profile === "aggressive"
            ? 75
            : 50,
      patience: profile === "development" || profile === "rebuild" ? 70 : 45,
      riskTolerance:
        profile === "conservative" ? 25 : profile === "aggressive" ? 75 : 50,
    };
  }
  return {
    ...state,
    business: {
      ...state.business,
      franchiseOps,
    },
  };
}

function declineBlockingDecisions(state: GameState): GameState {
  let current = state;
  const pending = [...current.user.pendingOwnerDecisions];
  for (const decision of pending) {
    if (decision.blockingLevel !== "blocking") {
      continue;
    }
    const resolved = resolvePendingOwnerDecision(current, {
      decisionId: decision.id,
      status: "declined",
      decisionSource: "system",
    });
    current = resolved.state;
  }
  return current;
}

function resolveOwnedContractOptions(state: GameState): GameState {
  const year = state.competition.season.year;
  const owned = new Set(state.user.ownedTeamIds as string[]);
  let contracts = state.business.contracts;
  let changed = false;
  for (const [contractId, contract] of Object.entries(contracts)) {
    if (!owned.has(contract.teamId)) {
      continue;
    }
    const status = getContractStatus(contract, year);
    let next = contract;
    if (status === "team_option") {
      next = declineTeamOption(next);
    } else if (status === "player_option") {
      next = declinePlayerOption(next);
    }
    if (next !== contract) {
      contracts = { ...contracts, [contractId]: next };
      changed = true;
    }
  }
  if (!changed) {
    return state;
  }
  return {
    ...state,
    business: {
      ...state.business,
      contracts,
    },
  };
}

function autoPickUserDraft(state: GameState): GameState {
  const slot = getActiveDraftOnClockSlot(state);
  if (!slot || !isUserOnDraftClock(state)) {
    return state;
  }
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  const draft = state.world.drafts[draftClassId];
  if (!draft) {
    return state;
  }
  const prospect = Object.values(draft.prospects).find(
    (candidate) => candidate.status === "eligible",
  );
  if (!prospect) {
    return state;
  }
  const result = makeDraftSelection(state, {
    draftClassId,
    draftPickId: slot.draftPickId,
    prospectPlayerId: prospect.playerId,
    teamId: slot.ownerTeamId,
  });
  return result.success ? result.state : state;
}

function prepareUnattendedAdvance(state: GameState, rng: Rng): GameState {
  let current = persistRng(declineBlockingDecisions(state), rng);
  current = persistRng(resolveOwnedContractOptions(current), rng);
  if (isUserOnDraftClock(current)) {
    current = persistRng(autoPickUserDraft(current), rng);
    current = persistRng(runAiTeamDecisions(current, rng).state, rng);
  }
  const plannedOpener = derivePlannedRegularSeasonStartDate(current);
  if (
    needsRegularSeasonInitialization(current) &&
    plannedOpener != null &&
    current.world.calendar.currentDate >= plannedOpener
  ) {
    current = persistRng(
      enforceMaxRosterViaDevelopmentLeague(current).state,
      rng,
    );
    current = persistRng(fillShortRosters(current, rng).state, rng);
  }
  return current;
}

function advanceDays(state: GameState, rng: Rng, days: number): GameState {
  let current = persistRng(state, rng);
  let idleSteps = 0;
  let day = 0;
  while (day < days) {
    current = prepareUnattendedAdvance(current, rng);
    if (isUserOnDraftClock(current)) {
      idleSteps += 1;
      if (idleSteps > 200) {
        throw new Error("Behavioral harness: draft clock did not clear.");
      }
      continue;
    }
    const result = advanceSimulation(current, rng, { days: 1 });
    current = persistRng(result.state, rng);
    idleSteps = 0;
    day += 1;
    if (result.stopReason === "pending_owner_decision") {
      current = persistRng(declineBlockingDecisions(current), rng);
    }
  }
  return current;
}

function summarizeHistory(state: GameState): void {
  const rows: FranchiseIdentitySnapshotRow[] = [];
  for (const teamId of Object.keys(state.world.teams) as TeamId[]) {
    const row = snapshotFranchiseIdentityRow(state, teamId);
    if (row) {
      rows.push(row);
    }
  }
  const means = meanFingerprintsByProfile(rows);
  console.log(
    "\n=== Organizational fingerprints (current season snapshot) ===\n",
  );
  for (const mean of means) {
    console.log(
      [
        mean.profile.padEnd(14),
        `n=${mean.teamCount}`,
        `cash=${Math.round(mean.meanCash / 1_000_000)}M`,
        `payroll=${Math.round(mean.meanPayroll / 1_000_000)}M`,
        `mkt=${Math.round(mean.meanMarketing / 1_000_000)}M`,
        `ticket=${mean.meanTicketPrice.toFixed(1)}`,
        `age=${mean.meanRosterAge.toFixed(1)}`,
        `young%=${mean.meanYoungShare.toFixed(0)}`,
        `picks=${mean.meanDraftPicks.toFixed(1)}`,
        `devFac=${mean.meanDevFacilities.toFixed(1)}`,
      ].join("  "),
    );
  }

  console.log("\n=== Sample posture / preference debug ===\n");
  const samples = Object.keys(state.world.teams).sort().slice(0, 6) as TeamId[];
  for (const teamId of samples) {
    const resolved = resolveFranchisePreferences(state, teamId);
    const ops = state.business.franchiseOps[teamId];
    if (!resolved || !ops) {
      continue;
    }
    console.log(
      `${teamId} profile=${ops.aiProfile} posture=${resolved.posture} ` +
        `spend=${resolved.preferences.spendWillingness.toFixed(2)} ` +
        `cash=${resolved.preferences.cashPreservation.toFixed(2)} ` +
        `youth=${resolved.preferences.youthValue.toFixed(2)} ` +
        `mkt=${resolved.preferences.marketingPriority.toFixed(2)} ` +
        `window=${resolved.trajectory.competitiveWindow.toFixed(2)} ` +
        `rebuild=${resolved.trajectory.rebuildPressure.toFixed(2)}`,
    );
  }

  console.log("\n=== Franchise history arcs (last 3 seasons if present) ===\n");
  for (const teamId of samples) {
    const seasons = state.business.franchiseHistory[teamId]?.seasons ?? [];
    const recent = seasons.slice(-3);
    const ops = state.business.franchiseOps[teamId];
    if (!ops || recent.length === 0) {
      console.log(`${teamId} (${ops?.aiProfile ?? "?"}): no history yet`);
      continue;
    }
    const arc = recent
      .map(
        (season) =>
          `${season.seasonYear}:${season.wins}-${season.losses}` +
          ` att=${season.attendance ?? "-"}` +
          ` cash=${Math.round(season.businessFunds / 1_000_000)}M` +
          ` val=${Math.round(season.franchiseValue / 1_000_000)}M`,
      )
      .join(" | ");
    console.log(`${teamId} (${ops.aiProfile}): ${arc}`);
  }
}

const seasonsArg = Number(process.argv[2] ?? "2");
const seed = Number(process.argv[3] ?? "42");
if (!Number.isInteger(seasonsArg) || seasonsArg < 1) {
  throw new Error("seasons must be an integer >= 1");
}
const days = Math.max(1, Math.round(seasonsArg * DAYS_PER_SEASON_APPROX));

console.log(
  `Behavioral harness: seed=${seed} seasons≈${seasonsArg} days=${days}`,
);

let state = createInitialGameState({
  saveId: "behavioral_harness",
  rngSeed: seed,
  settings: CBL_GAME_SETTINGS,
});
const rng = createSeededRng(state.meta.rngState);
state = persistRng(bootstrapWorld(state, rng).state, rng);
state = assignDistinctProfiles(state);
state = advanceDays(state, rng, days);

console.log(
  `Finished: year=${state.competition.season.year} phase=${getActivePhaseId(state)} date=${state.world.calendar.currentDate}`,
);
summarizeHistory(state);

console.log(
  "\nInterpretation: compare marketing/payroll/youth/picks by profile.",
);
console.log(
  "If fingerprints converge, identity inertia or trajectory wiring needs tuning.",
);
