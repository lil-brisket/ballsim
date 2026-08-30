import { createDomainEvent, type DomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { createEmptyPlayoffTournament } from "@/domain/entities/playoffs";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import { draftClassIdFor } from "@/domain/entities/draft";
import { mergeDraftPicksForSeason } from "@/domain/draft-picks/generate-draft-picks";
import { asSeasonId, type TeamId } from "@/domain/ids";
import {
  activateDraft,
  completeDraft,
  createDraft,
  draftYearForSeason,
} from "@/systems/draft";
import { advanceScoutAssignments } from "@/systems/scouting/scouting-progression";
import { releaseExpiredContracts } from "@/systems/free-agency";
import { appendAllFranchiseSeasonRecords } from "@/systems/franchise-history";
import {
  appendAllPlayerSeasonRecords,
  archiveCompletedSeasonGames,
} from "@/systems/player-history";
import { generateAndCacheAnnualReports } from "@/systems/franchise-report";
import { processSeasonalLeagueEconomy } from "@/systems/league-economy";
import { appendOwnershipSeasonNote } from "@/systems/ownership-confidence-engine";
import { tickRelocationCooldowns } from "@/systems/relocation";
import { processSeasonPlayerDevelopment } from "@/systems/season-player-development";
import { processSeasonStaffDevelopment } from "@/systems/staff-development";
import { releaseExpiredStaffContracts } from "@/systems/staff-contract-lifecycle";
import { refreshStaffFreeAgentPool } from "@/systems/staff-generation";
import { processStaffRetirement } from "@/systems/staff-retirement";
import { runLeagueStaffAiManagement } from "@/systems/staff-ai-management";
import { expireSponsorshipsAtSeason } from "@/systems/sponsorships";
import { transitionPhase } from "@/systems/simulation/phase-machine";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import {
  advancePhase,
  canAdvancePhase,
  enterPhase,
  getActivePhaseId,
  previewAdvance,
  setActivePhase,
} from "@/systems/phase-engine";
import type { LeaguePhaseId } from "@/systems/phase-engine";

/**
 * @deprecated Prefer advanceLeaguePhase / previewAdvance from phase-engine.
 * Kept for legacy callers that finish free agency → next phase.
 */
export function advanceOffseasonStage(state: GameState): SystemResult {
  return advanceLeaguePhase(state);
}

/**
 * User-controlled advance to the next league phase.
 * Runs exit hooks for the departing phase, then moves the phase pointer.
 */
export function advanceLeaguePhase(
  state: GameState,
  rng?: Rng,
): SystemResult {
  if (!canAdvancePhase(state)) {
    const preview = previewAdvance(state);
    throw new Error(
      preview.blockReason ?? "Cannot advance while required tasks remain.",
    );
  }

  const fromPhaseId = getActivePhaseId(state);
  const events: DomainEvent[] = [];
  let current = state;

  // Staff & Development exit initializes the new season into preseason.
  if (fromPhaseId === "offseason.staff_development") {
    const exitResult = processPhaseExit(current, fromPhaseId, rng);
    current = exitResult.state;
    events.push(...exitResult.events);
    events.push(
      createDomainEvent({
        type: "LeaguePhaseAdvanced",
        occurredOn: current.world.calendar.currentDate,
        payload: {
          from: fromPhaseId,
          to: getActivePhaseId(current),
          reason: "user_advance",
        },
      }),
    );
    return systemResult(current, events);
  }

  // Preseason → regular season
  if (fromPhaseId === "preseason.preparation") {
    const begun = beginRegularSeasonFromPreseason(current);
    current = begun.state;
    events.push(...begun.events);
    events.push(
      createDomainEvent({
        type: "LeaguePhaseAdvanced",
        occurredOn: current.world.calendar.currentDate,
        payload: {
          from: fromPhaseId,
          to: "regular",
          reason: "user_advance",
        },
      }),
    );
    return systemResult(current, events);
  }

  const exitResult = processPhaseExit(current, fromPhaseId, rng);
  current = exitResult.state;
  events.push(...exitResult.events);

  const advanced = advancePhase(current, rng);
  current = advanced.state;
  events.push(...advanced.events);

  const enterResult = processPhaseEnter(
    current,
    advanced.preview.toPhaseId,
    rng,
  );
  current = enterResult.state;
  events.push(...enterResult.events);

  return systemResult(current, events);
}

function withEnsuredDraftPicks(state: GameState): GameState {
  const teams = Object.values(state.world.teams);
  const draftPicks = mergeDraftPicksForSeason(
    state.world.draftPicks,
    teams,
    state.competition.season.year,
  );
  if (draftPicks === state.world.draftPicks) {
    return state;
  }
  return {
    ...state,
    world: {
      ...state.world,
      draftPicks,
    },
  };
}

/**
 * Atomic new-season initialization after staff_development exit /
 * when entering preseason.preparation from offseason.
 */
export function initializeNewSeason(state: GameState): SystemResult {
  const phaseId = getActivePhaseId(state);
  if (
    phaseId !== "offseason.staff_development" &&
    phaseId !== "preseason.preparation" &&
    state.competition.season.offseasonStage !== "league_initialization"
  ) {
    // Allow when already mid-initialization from legacy path
  }

  if (state.competition.season.phase !== "offseason") {
    // May already be transitioning
  }

  const nextYear = state.competition.season.year + 1;
  const nextSeasonId = asSeasonId(`season_${nextYear}`);

  const standingsByTeamId: Record<
    string,
    ReturnType<typeof createEmptyTeamStanding>
  > = {};
  for (const teamId of Object.keys(state.world.teams).sort() as TeamId[]) {
    standingsByTeamId[teamId] = createEmptyTeamStanding(teamId);
  }

  let next: GameState = {
    ...state,
    competition: {
      season: {
        id: nextSeasonId,
        year: nextYear,
        phase: "offseason",
        offseasonStage: "none",
        regularSeasonStartDate: null,
        offseasonStageEnteredDate: null,
        freeAgencyExtendedUntil: null,
      },
      phase: {
        activePhaseId: "preseason.preparation",
        enteredDate: state.world.calendar.currentDate,
      },
      schedule: {
        seasonId: nextSeasonId,
        gameIds: [],
        gameIdsByDate: {},
      },
      games: {},
      standings: { byTeamId: standingsByTeamId },
      playoffs: createEmptyPlayoffTournament(),
      seasonEventLog: [],
    },
  };

  next = withEnsuredDraftPicks(next);

  const phaseResult = transitionPhase(next, "preseason");
  next = {
    ...phaseResult.state,
    competition: {
      ...phaseResult.state.competition,
      phase: {
        activePhaseId: "preseason.preparation",
        enteredDate: phaseResult.state.world.calendar.currentDate,
      },
      season: {
        ...phaseResult.state.competition.season,
        offseasonStage: "none",
        offseasonStageEnteredDate: null,
      },
    },
  };
  return systemResult(next, phaseResult.events);
}

function isDraftOrderFullyUsed(state: GameState, draftClassId: string): boolean {
  const draft = state.world.drafts[draftClassId];
  if (draft === undefined || draft.order.length === 0) {
    return false;
  }
  return draft.order.every((slot) => slot.status === "used");
}

/**
 * Exit hooks when leaving a user-controlled phase.
 */
function processPhaseExit(
  state: GameState,
  fromPhaseId: LeaguePhaseId,
  rng?: Rng,
): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;

  if (fromPhaseId === "offseason.roster_decisions") {
    const released = releaseExpiredContracts(current);
    current = released.state;
    events.push(...released.events);
    const staffReleased = releaseExpiredStaffContracts(current);
    current = staffReleased.state;
    events.push(...staffReleased.events);
  }

  if (fromPhaseId === "offseason.draft") {
    const draftYear = draftYearForSeason(current.competition.season.year);
    const draftClassId = draftClassIdFor(draftYear);
    let draft = current.world.drafts[draftClassId];
    if (draft !== undefined && draft.status === "active" && rng) {
      // Remaining AI picks should already have been processed daily;
      // complete if fully used.
      if (isDraftOrderFullyUsed(current, draftClassId)) {
        const completed = completeDraft(current, draftClassId);
        current = completed.state;
        events.push(...completed.events);
      }
    }
  }

  if (fromPhaseId === "offseason.staff_development") {
    const initialized = initializeNewSeason(current);
    current = initialized.state;
    events.push(...initialized.events);
    // initializeNewSeason already enters preseason — skip normal advance target
  }

  return systemResult(current, events);
}

/**
 * Enter hooks when arriving at a phase.
 */
function processPhaseEnter(
  state: GameState,
  toPhaseId: LeaguePhaseId,
  rng?: Rng,
): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;

  // staff_development exit already moved to preseason via initializeNewSeason
  if (
    getActivePhaseId(current) === "preseason.preparation" &&
    toPhaseId === "preseason.preparation"
  ) {
    return systemResult(current, events);
  }

  if (toPhaseId === "offseason.draft_preparation" && rng) {
    const draftYear = draftYearForSeason(current.competition.season.year);
    const draftClassId = draftClassIdFor(draftYear);
    if (current.world.drafts[draftClassId] === undefined) {
      const created = createDraft(current, rng);
      current = created.state;
      events.push(...created.events);
    }
  }

  if (toPhaseId === "offseason.draft" && rng) {
    const draftYear = draftYearForSeason(current.competition.season.year);
    const draftClassId = draftClassIdFor(draftYear);
    let draft = current.world.drafts[draftClassId];
    if (draft === undefined) {
      const created = createDraft(current, rng);
      current = created.state;
      events.push(...created.events);
      draft = current.world.drafts[draftClassId];
    }
    if (draft !== undefined && draft.status === "not_started") {
      const activated = activateDraft(current, draftClassId);
      current = activated.state;
      events.push(...activated.events);
    }
  }

  return systemResult(current, events);
}

function runSeasonTransition(state: GameState, rng: Rng): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;

  const gameArchive = archiveCompletedSeasonGames(current);
  current = gameArchive.state;
  events.push(...gameArchive.events);

  const playerHistory = appendAllPlayerSeasonRecords(current);
  current = playerHistory.state;
  events.push(...playerHistory.events);

  const history = appendAllFranchiseSeasonRecords(current);
  current = history.state;
  events.push(...history.events);

  const reports = generateAndCacheAnnualReports(current);
  current = reports.state;
  events.push(...reports.events);

  current = appendOwnershipSeasonNote(current);

  const development = processSeasonPlayerDevelopment(current, rng);
  current = development.state;
  events.push(...development.events);

  const staffDev = processSeasonStaffDevelopment(current, rng);
  current = staffDev.state;
  events.push(...staffDev.events);

  const staffRetired = processStaffRetirement(current, rng);
  current = staffRetired.state;
  events.push(...staffRetired.events);

  const staffReleased = releaseExpiredStaffContracts(current);
  current = staffReleased.state;
  events.push(...staffReleased.events);

  current = refreshStaffFreeAgentPool(current, rng, 1);

  const staffAi = runLeagueStaffAiManagement(current, rng);
  current = staffAi.state;
  events.push(...staffAi.events);

  const sponsorships = expireSponsorshipsAtSeason(current);
  current = sponsorships.state;
  events.push(...sponsorships.events);

  const economy = processSeasonalLeagueEconomy(current);
  current = economy.state;
  events.push(...economy.events);

  const relocation = tickRelocationCooldowns(current);
  current = relocation.state;
  events.push(...relocation.events);

  const entered = enterPhase(
    current,
    "offseason.roster_decisions",
    "season_transition_complete",
  );
  current = entered.state;
  events.push(...entered.events);

  return systemResult(current, events);
}

/**
 * Daily offseason lifecycle.
 * Automatic phases (season_transition) process and advance.
 * User-controlled phases do NOT auto-advance — only maintain draft integrity.
 */
export function processOffseasonLifecycle(
  state: GameState,
  rng: Rng,
): SystemResult {
  if (state.competition.season.phase !== "offseason") {
    return systemResult(state);
  }

  const events: DomainEvent[] = [];
  let current = ensureCompetitionPhase(state);
  const phaseId = getActivePhaseId(current);

  if (phaseId === "offseason.season_transition") {
    const transitioned = runSeasonTransition(current, rng);
    current = transitioned.state;
    events.push(...transitioned.events);
    return systemResult(current, events);
  }

  // Maintain draft class while in draft / draft prep (create if missing).
  if (
    phaseId === "offseason.draft" ||
    phaseId === "offseason.draft_preparation"
  ) {
    const draftYear = draftYearForSeason(current.competition.season.year);
    const draftClassId = draftClassIdFor(draftYear);
    let draft = current.world.drafts[draftClassId];

    if (draft === undefined && phaseId === "offseason.draft") {
      const created = createDraft(current, rng);
      current = created.state;
      events.push(...created.events);
      draft = current.world.drafts[draftClassId];
    }

    if (draft !== undefined && draft.status !== "complete") {
      current = advanceScoutAssignments(current, rng);
      draft = current.world.drafts[draftClassId];
    }

    if (
      phaseId === "offseason.draft" &&
      draft !== undefined &&
      draft.status === "not_started"
    ) {
      const activated = activateDraft(current, draftClassId);
      current = activated.state;
      events.push(...activated.events);
      draft = current.world.drafts[draftClassId];
    }

    if (
      phaseId === "offseason.draft" &&
      draft !== undefined &&
      draft.status === "active" &&
      isDraftOrderFullyUsed(current, draftClassId)
    ) {
      const completed = completeDraft(current, draftClassId);
      current = completed.state;
      events.push(...completed.events);
      // Do NOT auto-advance to free agency — user must click Advance.
    }
  }

  // Legacy league_initialization: finish new season if somehow still here
  if (
    phaseId === "offseason.staff_development" &&
    current.competition.season.offseasonStage === "league_initialization" &&
    current.competition.phase?.activePhaseId === undefined
  ) {
    const initialized = initializeNewSeason(current);
    current = initialized.state;
    events.push(...initialized.events);
  }

  return systemResult(current, events);
}

/**
 * Ensure competition.phase exists (defensive for in-memory test fixtures).
 */
function ensureCompetitionPhase(state: GameState): GameState {
  if (state.competition.phase?.activePhaseId) {
    return state;
  }
  return setActivePhase(state, getActivePhaseId(state));
}

export { previewAdvance, canAdvancePhase };
