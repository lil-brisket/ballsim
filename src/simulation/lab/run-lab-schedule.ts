import { draftClassIdFor } from "@/domain/entities/draft";
import { hasBlockingOwnerDecision } from "@/domain/entities/owner-decision";
import { createSeededRng, type Rng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { summarizeMetric } from "@/simulation/analytics/summarize";
import { hashPayload } from "@/simulation/analytics/hash";
import { settingsForLabPreset } from "@/simulation/lab/lab-league-preset";
import type { LabLeaguePreset } from "@/simulation/lab/lab-league-preset";
import { readEngineIdentity } from "@/simulation/lab/engine-identity";
import { buildMasterSeedList } from "@/simulation/lab/lab-seeds";
import { persistLabRun } from "@/simulation/lab/persist-run";
import type { LabPersistOptions } from "@/simulation/lab/manifest";
import {
  SCHEDULE_SCENARIO_ID,
  scenarioVersionFor,
} from "@/simulation/lab/scenario-version";
import { runAiTeamDecisions } from "@/systems/ai-team-decisions";
import {
  draftYearForSeason,
  getActiveDraftOnClockSlot,
  isUserOnDraftClock,
  makeDraftSelection,
} from "@/systems/draft";
import { resolvePendingOwnerDecision } from "@/systems/owner-decisions";
import {
  getActivePhaseId,
  tryAdvanceUserManagedPhase,
} from "@/systems/phase-engine";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { isRegularSeasonComplete } from "@/systems/simulation/season-lifecycle";
import {
  averageGameCost,
  createSimulationProfiler,
  type GameSimCostModel,
  type SeasonProfilerBuckets,
} from "@/systems/simulation/simulation-profiler";
import { bootstrapWorld } from "@/systems/world-pipeline";

export const LAB_DEFAULT_SCHEDULE_MAX_DAYS = 500;

export type LabScheduleUntil = "regular" | "playoffs";

export type RunLabScheduleOptions = {
  seed: number;
  preset: LabLeaguePreset;
  until: LabScheduleUntil;
  maxDays?: number;
} & LabPersistOptions;

export type LabScheduleGameCounts = {
  regularScheduled: number;
  regularFinal: number;
  playoffScheduled: number;
  playoffFinal: number;
};

export type LabScheduleStandingsSummary = {
  teamCount: number;
  meanWins: number;
  minWins: number;
  maxWins: number;
  meanWinPct: number;
};

export type LabScheduleResult = {
  seed: number;
  preset: LabLeaguePreset;
  until: LabScheduleUntil;
  status: "completed" | "hit_max_days";
  daysAdvanced: number;
  gamesSimulated: number;
  decisionsDeclined: number;
  startDate: string;
  endDate: string;
  startPhase: string;
  endPhase: string;
  regularSeasonComplete: boolean;
  wallMs: number;
  gameCounts: LabScheduleGameCounts;
  standings: LabScheduleStandingsSummary;
  seasonCost: SeasonProfilerBuckets;
  averageGameCost: GameSimCostModel | null;
  checksum: string;
  reproCommand: string;
  engineIdentity: ReturnType<typeof readEngineIdentity>;
  runId?: string;
  manifestPath?: string;
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

function tryAdvanceUserPhase(state: GameState, rng: Rng): GameState | null {
  const next = tryAdvanceUserManagedPhase(state, rng);
  return next ? persistRng(next, rng) : null;
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

function declineBlockingDecisions(state: GameState): {
  state: GameState;
  declined: number;
} {
  let current = state;
  let declined = 0;
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
    if (resolved.resolved) {
      declined += 1;
    }
  }
  return { state: current, declined };
}

function countGames(state: GameState): LabScheduleGameCounts {
  let regularScheduled = 0;
  let regularFinal = 0;
  let playoffScheduled = 0;
  let playoffFinal = 0;
  for (const game of Object.values(state.competition.games)) {
    if (game.competitionType === "regular_season") {
      regularScheduled += 1;
      if (game.status === "final") {
        regularFinal += 1;
      }
    } else if (game.competitionType === "playoffs") {
      playoffScheduled += 1;
      if (game.status === "final") {
        playoffFinal += 1;
      }
    }
  }
  return {
    regularScheduled,
    regularFinal,
    playoffScheduled,
    playoffFinal,
  };
}

function summarizeStandings(state: GameState): LabScheduleStandingsSummary {
  const rows = Object.values(state.competition.standings.byTeamId);
  const wins = rows.map((row) => row.wins);
  const winPct = rows.map((row) => row.winPercentage);
  const winSummary = summarizeMetric(wins);
  const pctSummary = summarizeMetric(winPct);
  return {
    teamCount: rows.length,
    meanWins: winSummary.mean,
    minWins: winSummary.min,
    maxWins: winSummary.max,
    meanWinPct: pctSummary.mean,
  };
}

function shouldStop(
  state: GameState,
  until: LabScheduleUntil,
  sawRegular: boolean,
): boolean {
  if (until === "regular") {
    return isRegularSeasonComplete(state);
  }
  if (!sawRegular) {
    return false;
  }
  const phase = state.competition.season.phase;
  return phase === "postseason" || phase === "offseason";
}

/**
 * Unattended full-schedule run: bootstrap a league, play the regular season
 * (and optionally playoffs), and collect timing + standings diagnostics.
 */
export function runLabSchedule(
  options: RunLabScheduleOptions,
): LabScheduleResult {
  const maxDays = options.maxDays ?? LAB_DEFAULT_SCHEDULE_MAX_DAYS;
  if (!Number.isInteger(maxDays) || maxDays < 1) {
    throw new Error("runLabSchedule: maxDays must be a positive integer.");
  }
  if (options.until !== "regular" && options.until !== "playoffs") {
    throw new Error("runLabSchedule: until must be regular or playoffs.");
  }

  const seedList = buildMasterSeedList(options.seed, SCHEDULE_SCENARIO_ID);
    const persisted = persistLabRun(options, {
    scenarioName: SCHEDULE_SCENARIO_ID,
    scenarioVersion: scenarioVersionFor(SCHEDULE_SCENARIO_ID),
    config: {
      mode: "schedule",
      seed: options.seed,
      scenarioId: SCHEDULE_SCENARIO_ID,
      preset: options.preset,
      until: options.until,
      maxDays,
    },
    seedList,
  });

  const settings = settingsForLabPreset(options.preset);
  let state = createInitialGameState({
    saveId: `lab_schedule_${options.preset}_${options.seed}`,
    rngSeed: options.seed,
    nowIso: "2026-01-01T00:00:00.000Z",
    settings,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = persistRng(bootstrapWorld(state, rng).state, rng);

  if (getActivePhaseId(state) === "preseason.preparation") {
    const advanced = tryAdvanceUserPhase(state, rng);
    if (advanced) {
      state = advanced;
    }
  }

  const engineIdentity = readEngineIdentity();
  const reproCommand = [
    `lab-schedule`,
    `--seed=${options.seed}`,
    `--preset=${options.preset}`,
    `--until=${options.until}`,
  ].join(" ");
  const profiler = createSimulationProfiler();
  const wallStart = performance.now();
  const startDate = state.world.calendar.currentDate;
  const startPhase = getActivePhaseId(state);

  let daysAdvanced = 0;
  let gamesSimulated = 0;
  let decisionsDeclined = 0;
  let idleSteps = 0;
  let sawRegular = state.competition.season.phase === "regular";
  let status: LabScheduleResult["status"] = "hit_max_days";

  while (daysAdvanced < maxDays) {
    const declined = declineBlockingDecisions(state);
    state = declined.state;
    decisionsDeclined += declined.declined;

    if (isUserOnDraftClock(state)) {
      idleSteps += 1;
      if (idleSteps > 200) {
        throw new Error("runLabSchedule: draft clock did not clear.");
      }
      state = persistRng(autoPickUserDraft(state), rng);
      state = persistRng(runAiTeamDecisions(state, rng).state, rng);
      continue;
    }

    const phaseAdvanced = tryAdvanceUserPhase(state, rng);
    if (phaseAdvanced) {
      const from = getActivePhaseId(state);
      if (from.startsWith("offseason.") || from === "preseason.preparation") {
        idleSteps += 1;
        if (idleSteps > 200) {
          throw new Error("runLabSchedule: user phase did not progress.");
        }
        state = phaseAdvanced;
        continue;
      }
    }

    const result = advanceSimulation(state, rng, { days: 1, profiler });
    state = persistRng(result.state, rng);
    daysAdvanced += result.daysAdvanced;
    gamesSimulated += result.gamesSimulated;
    idleSteps = 0;

    if (result.stopReason === "pending_owner_decision") {
      const resolved = declineBlockingDecisions(state);
      state = resolved.state;
      decisionsDeclined += resolved.declined;
      if (hasBlockingOwnerDecision(state.user)) {
        throw new Error(
          "runLabSchedule: blocking owner decision remained after auto-decline.",
        );
      }
    }

    if (state.competition.season.phase === "regular") {
      sawRegular = true;
    }

    if (shouldStop(state, options.until, sawRegular)) {
      status = "completed";
      break;
    }
  }

  const wallMs = performance.now() - wallStart;
  const seasonCost = profiler.snapshotSeason();
  const gameCounts = countGames(state);
  const standings = summarizeStandings(state);
  const checksum = hashPayload({
    seed: options.seed,
    preset: options.preset,
    until: options.until,
    daysAdvanced,
    gamesSimulated,
    endPhase: getActivePhaseId(state),
    gameCounts,
    standings,
  });

  return {
    seed: options.seed,
    preset: options.preset,
    until: options.until,
    status,
    daysAdvanced,
    gamesSimulated,
    decisionsDeclined,
    startDate,
    endDate: state.world.calendar.currentDate,
    startPhase,
    endPhase: getActivePhaseId(state),
    regularSeasonComplete: isRegularSeasonComplete(state),
    wallMs,
    gameCounts,
    standings,
    seasonCost: { ...seasonCost, totalMs: wallMs },
    averageGameCost: averageGameCost(profiler.snapshotGames()),
    checksum,
    reproCommand,
    engineIdentity,
    ...(persisted.runId != null ? { runId: persisted.runId } : {}),
    ...(persisted.manifestPath != null
      ? { manifestPath: persisted.manifestPath }
      : {}),
  };
}
