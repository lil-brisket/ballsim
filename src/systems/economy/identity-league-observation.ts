/**
 * Observational multi-season run for franchise identity differentiation.
 * Uses advanceSimulation only — no alternate gameplay pipeline.
 */

import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng, type Rng } from "@/domain/rng";
import type { TeamId } from "@/domain/ids";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import {
  getActiveDraftOnClockSlot,
  isUserOnDraftClock,
  makeDraftSelection,
} from "@/systems/draft";
import { draftClassIdFor } from "@/domain/entities/draft";
import { draftYearForSeason } from "@/systems/draft";
import { runAiTeamDecisions } from "@/systems/ai-team-decisions";
import { advanceOffseasonStage } from "@/systems/simulation/offseason-lifecycle";
import {
  assertIdentityAxesUnchanged,
  captureIdentityAxes,
  meanFingerprintsByProfile,
  snapshotAllFranchiseIdentities,
  type FranchiseIdentitySnapshotRow,
  type IdentityFingerprintMeans,
} from "@/systems/economy/franchise-identity-metrics";
import {
  formatPreferenceDecisionReason,
  resolveFranchisePreferences,
} from "@/systems/franchise-ai-preferences";

export type IdentityLeagueObservation = {
  seed: number;
  seasonsSimulated: number;
  initialAxes: ReturnType<typeof captureIdentityAxes>;
  finalAxes: ReturnType<typeof captureIdentityAxes>;
  finalRows: FranchiseIdentitySnapshotRow[];
  fingerprints: IdentityFingerprintMeans[];
  sampleDecisionReasons: string[];
  finalState: GameState;
};

const MAX_DAYS_PER_SEASON = 500;

function persistRng(state: GameState, rng: Rng): GameState {
  return {
    ...state,
    meta: {
      ...state.meta,
      rngState: rng.getState(),
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
    (p) => p.status === "eligible",
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

/** Mirror economy harness: day-advance through offseason to preseason. */
function resolveOffseason(state: GameState, rng: Rng): GameState {
  let current = persistRng(state, rng);
  if (
    current.competition.season.phase === "offseason" &&
    current.competition.season.offseasonStage === "free_agency"
  ) {
    current = persistRng(advanceOffseasonStage(current).state, rng);
  }
  let guard = 0;
  while (guard < 80) {
    guard += 1;
    if (current.competition.season.phase === "preseason") {
      return current;
    }
    if (isUserOnDraftClock(current)) {
      current = persistRng(autoPickUserDraft(current), rng);
      current = persistRng(runAiTeamDecisions(current, rng).state, rng);
      continue;
    }
    current = persistRng(advanceSimulation(current, rng, { days: 1 }).state, rng);
    if (current.competition.season.phase === "preseason") {
      return current;
    }
  }
  throw new Error("Identity observation: offseason did not reach preseason.");
}

function simulateOneSeason(state: GameState, rng: Rng): GameState {
  let current = persistRng(state, rng);
  const startYear = current.competition.season.year;
  let days = 0;
  while (days < MAX_DAYS_PER_SEASON) {
    days += 1;
    if (isUserOnDraftClock(current)) {
      current = persistRng(autoPickUserDraft(current), rng);
      current = persistRng(runAiTeamDecisions(current, rng).state, rng);
      continue;
    }
    const advanced = advanceSimulation(current, rng, { days: 1 });
    current = persistRng(advanced.state, rng);
    const season = current.competition.season;
    if (
      season.year === startYear &&
      season.phase === "offseason" &&
      (season.offseasonStage === "free_agency" ||
        season.offseasonStage === "draft")
    ) {
      break;
    }
    if (season.year !== startYear) {
      break;
    }
  }
  return resolveOffseason(current, rng);
}

/**
 * Advance through `seasonCount` seasons via the real simulation.
 * Asserts identity axes do not drift.
 */
export function runIdentityLeagueObservation(
  seasonCount: number,
  options: { seed?: number } = {},
): IdentityLeagueObservation {
  if (!Number.isInteger(seasonCount) || seasonCount < 1) {
    throw new Error("seasonCount must be an integer >= 1.");
  }
  const seed = options.seed ?? 42;
  let state = createInitialGameState({
    saveId: `identity_obs_${seed}`,
    rngSeed: seed,
    nowIso: "2026-01-01T00:00:00.000Z",
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = persistRng(bootstrapWorld(state, rng).state, rng);

  const initialAxes = captureIdentityAxes(state);
  const sampleDecisionReasons: string[] = [];
  const sampleTeams = (Object.keys(state.world.teams) as TeamId[])
    .sort()
    .slice(0, 6);
  for (const teamId of sampleTeams) {
    const resolved = resolveFranchisePreferences(state, teamId);
    if (resolved) {
      sampleDecisionReasons.push(
        formatPreferenceDecisionReason(resolved.debug, `observe:${teamId}`),
      );
    }
  }

  for (let i = 0; i < seasonCount; i += 1) {
    state = simulateOneSeason(state, rng);
  }

  assertIdentityAxesUnchanged(initialAxes, state);
  const finalRows = snapshotAllFranchiseIdentities(state);
  return {
    seed,
    seasonsSimulated: seasonCount,
    initialAxes,
    finalAxes: captureIdentityAxes(state),
    finalRows,
    fingerprints: meanFingerprintsByProfile(finalRows),
    sampleDecisionReasons,
    finalState: state,
  };
}
