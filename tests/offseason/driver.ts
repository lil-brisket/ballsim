/**
 * Offseason test driver: runs the real engine one phase at a time and builds
 * fixture saves parked at the start of a named phase.
 *
 * No vitest imports, so soak scripts (tsx) can reuse it.
 */

import { applyPreset } from "@/domain/ai-management-presets";
import { draftClassIdFor } from "@/domain/entities/draft";
import type { DomainEvent } from "@/domain/events";
import {
  CBL_GAME_SETTINGS,
  cloneGameSettings,
  type GameSettings,
} from "@/domain/game-settings";
import type { TeamId } from "@/domain/ids";
import { createSeededRng, type Rng } from "@/domain/rng";
import type { SystemResult } from "@/domain/system-result";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { getOwnedFranchiseAssistance } from "@/state/owner-context";
import { selectProspectForTeam } from "@/systems/ai-team-decisions";
import {
  autoResolveGeneratedDraftClass,
  draftYearForSeason,
  getActiveDraftOnClockSlot,
  isUserOnDraftClock,
  makeDraftSelection,
} from "@/systems/draft";
import type { GameSimulationFidelity } from "@/systems/game-simulation";
import { resolvePendingOwnerDecision } from "@/systems/owner-decisions";
import { getActivePhaseId, type LeaguePhaseId } from "@/systems/phase-engine";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { canAiExecute } from "@/systems/simulation/management-policy";
import { enterOffseasonFromPostseason } from "@/systems/simulation/season-lifecycle";
import { bootstrapWorld } from "@/systems/world-pipeline";

/**
 * Phases a fixture can be parked at, in the order one season reaches them.
 * `preseason.preparation` and `regular` are the next season's (after rollover).
 */
export const OFFSEASON_FIXTURE_PHASES = [
  "postseason.season_review",
  "offseason.season_transition",
  "offseason.roster_decisions",
  "offseason.draft_preparation",
  "offseason.draft",
  "offseason.free_agency",
  "offseason.staff_development",
  "preseason.preparation",
  "regular",
] as const satisfies readonly LeaguePhaseId[];

export type OffseasonFixturePhase = (typeof OFFSEASON_FIXTURE_PHASES)[number];

/**
 * `delegated`: the user team runs on the Full Management preset.
 * `manual`: the league's default assistance (offseason decisions off), so
 * the default user policy or scripted actions make the user's decisions.
 */
export type UserManagement = "delegated" | "manual";

/** One scripted user action, run before the given day of the phase. */
export type OffseasonUserAction = {
  label: string;
  /** Days already simulated in this phase when the action runs. Default 0. */
  onDay?: number;
  /** Throw to have the action recorded as rejected; state stays unchanged. */
  run: (state: GameState, rng: Rng) => GameState | SystemResult;
};

export type UserActionOutcome = {
  label: string;
  day: number;
  status: "applied" | "rejected" | "not_run";
  error?: string;
};

export type AdvanceThroughPhaseOptions = {
  userActions?: readonly OffseasonUserAction[];
  /**
   * Make the user's routine decisions the way a player clicking through
   * would: begin the offseason from Season Review, confirm the generated
   * draft class, pick on the clock and decline blocking owner decisions.
   * Default true. With false, a phase that waits for the user is stuck.
   */
  autoUser?: boolean;
  /** Days before the phase counts as stuck. Default 400. */
  maxDays?: number;
  gameFidelity?: GameSimulationFidelity;
};

export type PhaseAdvanceResult = {
  state: GameState;
  events: DomainEvent[];
  fromPhaseId: LeaguePhaseId;
  toPhaseId: LeaguePhaseId;
  /** Calendar days simulated in the phase. */
  days: number;
  actions: UserActionOutcome[];
};

export class OffseasonPhaseStuckError extends Error {
  constructor(
    readonly phaseId: LeaguePhaseId,
    readonly date: string,
    readonly seasonYear: number,
    readonly days: number,
  ) {
    super(
      `Phase "${phaseId}" did not advance within ${days} days ` +
        `(season ${seasonYear}, date ${date}).`,
    );
    this.name = "OffseasonPhaseStuckError";
  }
}

const DEFAULT_MAX_DAYS = 400;
const DEFAULT_FIDELITY: GameSimulationFidelity = "box_score";

function withRng(state: GameState, rng: Rng): GameState {
  return { ...state, meta: { ...state.meta, rngState: rng.getState() } };
}

function isGameState(value: GameState | SystemResult): value is GameState {
  return "meta" in value;
}

function declineBlockingDecisions(state: GameState): GameState {
  let current = state;
  for (const decision of state.user.pendingOwnerDecisions) {
    if (decision.blockingLevel !== "blocking") continue;
    current = resolvePendingOwnerDecision(current, {
      decisionId: decision.id,
      status: "declined",
      decisionSource: "system",
    }).state;
  }
  return current;
}

/** The user's pick: this team's own board, else the best-ranked prospect. */
export function autoPickForUser(state: GameState): SystemResult {
  const slot = getActiveDraftOnClockSlot(state);
  if (!slot || !isUserOnDraftClock(state)) {
    return { state, events: [] };
  }
  const draftClassId = draftClassIdFor(
    draftYearForSeason(state.competition.season.year),
  );
  const draft = state.world.drafts[draftClassId];
  if (!draft) {
    return { state, events: [] };
  }
  const best = Object.values(draft.prospects)
    .filter((prospect) => prospect.status === "eligible")
    .sort((a, b) => a.ranking - b.ranking)[0];
  const playerId =
    selectProspectForTeam(state, draft, slot.ownerTeamId) ?? best?.playerId;
  if (playerId === undefined) {
    return { state, events: [] };
  }
  const result = makeDraftSelection(state, {
    draftClassId,
    draftPickId: slot.draftPickId,
    prospectPlayerId: playerId,
    teamId: slot.ownerTeamId,
  });
  if (!result.success) {
    throw new Error(
      `Auto pick failed: ${JSON.stringify(result.validation.errors)}`,
    );
  }
  return { state: result.state, events: result.events };
}

/**
 * The user's routine clicks for the current state. Returns null when nothing
 * was waiting on the user.
 */
function runAutoUser(state: GameState, rng: Rng): SystemResult | null {
  const declined = declineBlockingDecisions(state);
  if (declined !== state) {
    return { state: declined, events: [] };
  }
  const phaseId = getActivePhaseId(state);
  if (phaseId === "postseason.season_review") {
    return enterOffseasonFromPostseason(state);
  }
  if (phaseId === "offseason.draft_preparation") {
    const draftYear = draftYearForSeason(state.competition.season.year);
    const decision = state.user.pendingDraftClassDecisions[String(draftYear)];
    if (decision === undefined || decision.resolved !== true) {
      const resolved = autoResolveGeneratedDraftClass(state, rng);
      return { ...resolved, state: withRng(resolved.state, rng) };
    }
  }
  // With draft assist the engine picks for the user during the day.
  if (
    isUserOnDraftClock(state) &&
    !canAiExecute(
      state.settings,
      "DRAFT_PICK",
      getOwnedFranchiseAssistance(state),
    )
  ) {
    return autoPickForUser(state);
  }
  return null;
}

/**
 * Runs the active phase with the real engine until the league moves to the
 * next phase. Scripted actions run before the day they name; one that throws
 * is recorded as rejected and leaves the state as it was.
 */
export function advanceThroughPhase(
  state: GameState,
  phaseId: LeaguePhaseId,
  options: AdvanceThroughPhaseOptions = {},
): PhaseAdvanceResult {
  const fromPhaseId = getActivePhaseId(state);
  if (fromPhaseId !== phaseId) {
    throw new Error(
      `advanceThroughPhase: expected phase "${phaseId}", state is in "${fromPhaseId}".`,
    );
  }
  const autoUser = options.autoUser !== false;
  const maxDays = options.maxDays ?? DEFAULT_MAX_DAYS;
  const gameFidelity = options.gameFidelity ?? DEFAULT_FIDELITY;
  const pending = [...(options.userActions ?? [])];
  const actions: UserActionOutcome[] = [];
  const events: DomainEvent[] = [];
  const rng = createSeededRng(state.meta.rngState);
  let current = state;
  let days = 0;

  while (getActivePhaseId(current) === fromPhaseId) {
    for (const action of pending.filter((a) => (a.onDay ?? 0) === days)) {
      pending.splice(pending.indexOf(action), 1);
      try {
        const result = action.run(current, rng);
        if (isGameState(result)) {
          current = withRng(result, rng);
        } else {
          current = withRng(result.state, rng);
          events.push(...result.events);
        }
        actions.push({ label: action.label, day: days, status: "applied" });
      } catch (error) {
        actions.push({
          label: action.label,
          day: days,
          status: "rejected",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (getActivePhaseId(current) !== fromPhaseId) break;

    if (autoUser) {
      const clicked = runAutoUser(current, rng);
      if (clicked !== null) {
        current = withRng(clicked.state, rng);
        events.push(...clicked.events);
        continue;
      }
    }

    if (days >= maxDays) {
      throw new OffseasonPhaseStuckError(
        fromPhaseId,
        current.world.calendar.currentDate,
        current.competition.season.year,
        days,
      );
    }
    const result = advanceSimulation(current, rng, { days: 1, gameFidelity });
    current = withRng(result.state, rng);
    events.push(...result.events);
    days += 1;
  }

  for (const action of pending) {
    actions.push({
      label: action.label,
      day: action.onDay ?? 0,
      status: "not_run",
    });
  }

  return {
    state: current,
    events,
    fromPhaseId,
    toPhaseId: getActivePhaseId(current),
    days,
    actions,
  };
}

export type OffseasonFixtureOptions = {
  seed: number;
  phase: OffseasonFixturePhase;
  management?: UserManagement;
};

export type OffseasonFixture = {
  state: GameState;
  seed: number;
  phase: OffseasonFixturePhase;
  userTeamId: TeamId;
};

/** CBL league (12 teams, 22 games) so a full season stays a few seconds. */
export function offseasonFixtureSettings(
  management: UserManagement,
): GameSettings {
  const settings = cloneGameSettings(CBL_GAME_SETTINGS);
  if (management === "delegated") {
    settings.ai = {
      ...settings.ai,
      managementPreset: "full_management",
      assistance: applyPreset("full_management"),
    };
  }
  return settings;
}

/** A new league in its first preseason, before any day is simulated. */
export function createOffseasonLeague(
  seed: number,
  management: UserManagement = "delegated",
): GameState {
  const initial = createInitialGameState({
    saveId: `offseason_${management}_${seed}`,
    rngSeed: seed,
    nowIso: "2026-01-01T00:00:00.000Z",
    settings: offseasonFixtureSettings(management),
  });
  const rng = createSeededRng(initial.meta.rngState);
  return withRng(bootstrapWorld(initial, rng).state, rng);
}

type FixtureChain = {
  /** Latest state reached; always at the start of a phase. */
  frontier: GameState;
  byPhase: Map<OffseasonFixturePhase, GameState>;
};

const fixtureCache = new Map<string, FixtureChain>();

function isFixturePhase(
  phaseId: LeaguePhaseId,
): phaseId is OffseasonFixturePhase {
  return (OFFSEASON_FIXTURE_PHASES as readonly string[]).includes(phaseId);
}

/**
 * A save parked at the start of `phase` in the league's first offseason,
 * built by running the real pipeline from `seed`. Every phase passed on the
 * way is cached per seed for this process, so asking for a later phase
 * reuses the earlier work. Each call returns its own copy.
 */
export function buildOffseasonFixture(
  options: OffseasonFixtureOptions,
): OffseasonFixture {
  const management = options.management ?? "delegated";
  const key = `${options.seed}|${management}`;
  let chain = fixtureCache.get(key);
  if (chain === undefined) {
    chain = {
      frontier: createOffseasonLeague(options.seed, management),
      byPhase: new Map(),
    };
    fixtureCache.set(key, chain);
  }

  while (!chain.byPhase.has(options.phase)) {
    const from = chain.frontier;
    const fromPhase = getActivePhaseId(from);
    if (
      fromPhase === "regular" &&
      chain.byPhase.has("postseason.season_review")
    ) {
      throw new Error(
        `buildOffseasonFixture: phase "${options.phase}" was not reached.`,
      );
    }
    const next = advanceThroughPhase(from, fromPhase).state;
    chain.frontier = next;
    const reached = getActivePhaseId(next);
    const inFirstOffseason =
      reached === "postseason.season_review" ||
      chain.byPhase.has("postseason.season_review");
    if (inFirstOffseason && isFixturePhase(reached)) {
      chain.byPhase.set(reached, next);
    }
  }

  const state = structuredClone(chain.byPhase.get(options.phase)!);
  return {
    state,
    seed: options.seed,
    phase: options.phase,
    userTeamId: state.user.activeOwnerTeamId,
  };
}
