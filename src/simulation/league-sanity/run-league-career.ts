/**
 * Independent league career runner for sanity analytics.
 * Uses advanceSimulation only — no franchise-intelligence imports.
 */

import type { GameSettings } from "@/domain/game-settings";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { draftClassIdFor } from "@/domain/entities/draft";
import { createSeededRng, type Rng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import {
  draftYearForSeason,
  getActiveDraftOnClockSlot,
  isUserOnDraftClock,
  makeDraftSelection,
} from "@/systems/draft";
import { runAiTeamDecisions } from "@/systems/ai-team-decisions";
import { advanceOffseasonStage } from "@/systems/simulation/offseason-lifecycle";
import { enterOffseasonFromPostseason } from "@/systems/simulation/season-lifecycle";
import { collectLeagueSanitySnapshots } from "@/simulation/league-sanity/collect";
import type { LeagueSanityTeamSeasonSnapshot } from "@/simulation/league-sanity/types";

const MAX_DAYS_PER_SEASON = 500;

export type RunLeagueCareerOptions = {
  seed: number;
  seasons: number;
  simulationIndex?: number;
  gameSettings?: GameSettings;
  saveId?: string;
};

export type LeagueCareerResult = {
  simulationIndex: number;
  seed: number;
  seasonsSimulated: number;
  teamCount: number;
  snapshots: LeagueSanityTeamSeasonSnapshot[];
};

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

function resolveOffseason(state: GameState, rng: Rng): GameState {
  let current = persistRng(state, rng);
  if (current.competition.season.phase === "postseason") {
    current = persistRng(enterOffseasonFromPostseason(current).state, rng);
  }
  let guard = 0;
  while (guard < 80) {
    guard += 1;
    if (current.competition.season.phase === "preseason") {
      return current;
    }
    if (current.competition.season.phase === "postseason") {
      current = persistRng(enterOffseasonFromPostseason(current).state, rng);
      continue;
    }
    if (
      current.competition.season.phase === "offseason" &&
      current.competition.season.offseasonStage === "free_agency"
    ) {
      current = persistRng(advanceOffseasonStage(current).state, rng);
      continue;
    }
    if (isUserOnDraftClock(current)) {
      current = persistRng(autoPickUserDraft(current), rng);
      current = persistRng(runAiTeamDecisions(current, rng).state, rng);
      continue;
    }
    current = persistRng(
      advanceSimulation(current, rng, { days: 1 }).state,
      rng,
    );
    if (current.competition.season.phase === "preseason") {
      return current;
    }
  }
  throw new Error("League sanity: offseason did not reach preseason.");
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
    if (season.year === startYear && season.phase === "postseason") {
      break;
    }
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
  return current;
}

/**
 * Run one fictional career and collect season-end observations.
 */
export function runLeagueCareer(
  options: RunLeagueCareerOptions,
): LeagueCareerResult {
  const {
    seed,
    seasons,
    simulationIndex = 0,
    gameSettings = CBL_GAME_SETTINGS,
    saveId = `league_sanity_${seed}_${simulationIndex}`,
  } = options;
  if (!Number.isInteger(seasons) || seasons < 1) {
    throw new Error("runLeagueCareer: seasons must be an integer >= 1.");
  }

  let state = createInitialGameState({
    saveId,
    rngSeed: seed,
    nowIso: "2026-01-01T00:00:00.000Z",
    settings: gameSettings,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = persistRng(bootstrapWorld(state, rng).state, rng);

  const snapshots: LeagueSanityTeamSeasonSnapshot[] = [];
  const teamCount = Object.keys(state.world.teams).length;

  for (let seasonIndex = 0; seasonIndex < seasons; seasonIndex += 1) {
    state = simulateOneSeason(state, rng);
    // Collect at season end (postseason / offseason entry) before advancing offseason.
    const seasonSnaps = collectLeagueSanitySnapshots(
      state,
      simulationIndex,
      seasonIndex,
    );
    snapshots.push(...seasonSnaps);
    state = resolveOffseason(state, rng);
  }

  return {
    simulationIndex,
    seed,
    seasonsSimulated: seasons,
    teamCount,
    snapshots,
  };
}

export type RunLeagueSanityBatchOptions = {
  simulations: number;
  seasonsPerSimulation: number;
  seed: number;
  gameSettings?: GameSettings;
  onCareerComplete?: (result: LeagueCareerResult, index: number) => void;
};

/**
 * Run N careers. Per-career seed = baseSeed + simulationIndex.
 */
export function runLeagueSanityBatch(
  options: RunLeagueSanityBatchOptions,
): LeagueCareerResult[] {
  const {
    simulations,
    seasonsPerSimulation,
    seed,
    gameSettings,
    onCareerComplete,
  } = options;
  if (!Number.isInteger(simulations) || simulations < 1) {
    throw new Error("runLeagueSanityBatch: simulations must be >= 1.");
  }
  const results: LeagueCareerResult[] = [];
  for (let i = 0; i < simulations; i += 1) {
    const result = runLeagueCareer({
      seed: seed + i,
      seasons: seasonsPerSimulation,
      simulationIndex: i,
      gameSettings,
    });
    results.push(result);
    onCareerComplete?.(result, i);
  }
  return results;
}
