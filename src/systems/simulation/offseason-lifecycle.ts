import { createDomainEvent, type DomainEvent } from "@/domain/events";
import { createSeededRng, type Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { createEmptyPlayoffTournament } from "@/domain/entities/playoffs";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import { createEmptySeasonEventsState } from "@/domain/entities/season-events";
import { createEmptyGameDayPromotionSeasonState } from "@/domain/entities/game-day-promotion";
import { draftClassIdFor } from "@/domain/entities/draft";
import { mergeDraftPicksForSeason } from "@/domain/draft-picks/generate-draft-picks";
import { asSeasonId, type TeamId } from "@/domain/ids";
import {
  activateDraft,
  completeDraft,
  maybeCreateDraftForDecision,
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
import { processDevelopmentLeagueSeasonTransition } from "@/systems/development-league/season-transition";
import { processSeasonStaffDevelopment } from "@/systems/staff-development";
import { releaseExpiredStaffContracts } from "@/systems/staff-contract-lifecycle";
import { refreshStaffFreeAgentPool } from "@/systems/staff-generation";
import { processStaffRetirement } from "@/systems/staff-retirement";
import { processPlayerRetirements } from "@/systems/player-retirement";
import { finalizeRfaQualification } from "@/systems/rfa";
import { withdrawOpenFreeAgencyOffers } from "@/systems/expire-transactions";
import { runLeagueStaffAiManagement } from "@/systems/staff-ai-management";
import { expireSponsorshipsAtSeason } from "@/systems/sponsorships";
import { transitionPhase } from "@/systems/simulation/phase-machine";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { fillShortRosters } from "@/systems/roster-generation";
import { enforceMaxRosterViaDevelopmentLeague } from "@/systems/development-league/enforce-roster-cap";
import {
  expireSituation,
} from "@/systems/narrative/lifecycle";
import { withOwnedFranchise } from "@/state/owner-context";
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
export function advanceLeaguePhase(state: GameState, rng?: Rng): SystemResult {
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

function persistRng(state: GameState, rng: Rng): GameState {
  return {
    ...state,
    meta: {
      ...state.meta,
      rngState: rng.getState(),
    },
  };
}

function fillShortRostersWithRng(state: GameState, rng?: Rng): SystemResult {
  const fillRng = rng ?? createSeededRng(state.meta.rngState);
  const filled = fillShortRosters(state, fillRng);
  const capped = enforceMaxRosterViaDevelopmentLeague(filled.state);
  return {
    ...systemResult(capped.state, [...filled.events, ...capped.events]),
    state: persistRng(capped.state, fillRng),
  };
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
export function initializeNewSeason(state: GameState, rng?: Rng): SystemResult {
  if (isNewSeasonAlreadyInitialized(state)) {
    return systemResult(state);
  }

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

  const events: DomainEvent[] = [];
  let current = state;
  const resolveRng = rng ?? createSeededRng(current.meta.rngState);
  if (!hasFranchiseHistoryForCurrentSeason(current)) {
    const finalized = finalizeCompletedSeason(current, resolveRng);
    current = finalized.state;
    events.push(...finalized.events);
  } else {
    const archived = archiveCompletedSeasonGames(current);
    current = archived.state;
    events.push(...archived.events);
  }

  const nextYear = current.competition.season.year + 1;
  const nextSeasonId = asSeasonId(`season_${nextYear}`);

  const standingsByTeamId: Record<
    string,
    ReturnType<typeof createEmptyTeamStanding>
  > = {};
  for (const teamId of Object.keys(current.world.teams).sort() as TeamId[]) {
    standingsByTeamId[teamId] = createEmptyTeamStanding(teamId);
  }

  let next: GameState = {
    ...current,
    competition: {
      season: {
        id: nextSeasonId,
        year: nextYear,
        phase: "offseason",
        offseasonStage: "none",
        regularSeasonStartDate: null,
        tradeDeadlineDate: null,
        rfaQualificationComplete: false,
        offseasonStageEnteredDate: null,
        freeAgencyExtendedUntil: null,
      },
      phase: {
        activePhaseId: "preseason.preparation",
        enteredDate: current.world.calendar.currentDate,
      },
      schedule: {
        seasonId: nextSeasonId,
        gameIds: [],
        gameIdsByDate: {},
      },
      games: {},
      standings: { byTeamId: standingsByTeamId },
      playoffs: createEmptyPlayoffTournament(),
      developmentLeague: {
        schedule: {
          seasonId: nextSeasonId,
          gameIds: [],
          gameIdsByDate: {},
        },
        games: {},
        standings: { byTeamId: standingsByTeamId },
      },
      seasonEventLog: [],
      seasonEvents: createEmptySeasonEventsState(),
    },
  };

  const clearedPromotions: GameState["business"]["gameDayPromotionsByTeamId"] =
    {};
  for (const teamId of Object.keys(current.world.teams).sort()) {
    clearedPromotions[teamId] =
      createEmptyGameDayPromotionSeasonState(nextSeasonId);
  }
  next = {
    ...next,
    business: {
      ...next.business,
      gameDayPromotionsByTeamId: clearedPromotions,
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
  next = expireSeasonalSituations(next);
  return systemResult(next, [...events, ...phaseResult.events]);
}

function isNewSeasonAlreadyInitialized(state: GameState): boolean {
  const year = state.competition.season.year;
  const anyFinal = Object.values(state.competition.games).some(
    (game) => game.status === "final",
  );
  if (anyFinal) {
    return false;
  }
  const historyThisYear = Object.values(state.business.franchiseHistory).some(
    (history) => history.seasons.some((season) => season.seasonYear === year),
  );
  if (historyThisYear) {
    return false;
  }
  const historyPrior = Object.values(state.business.franchiseHistory).some(
    (history) =>
      history.seasons.some((season) => season.seasonYear === year - 1),
  );
  return historyPrior && Object.keys(state.competition.games).length === 0;
}

function expireSeasonalSituations(state: GameState): GameState {
  const date = state.world.calendar.currentDate;
  const keys = new Set(["expectation_gap", "objective_progress"]);
  let current = state;
  for (const teamId of current.user.ownedTeamIds) {
    current = withOwnedFranchise(current, teamId, (franchise) => ({
      ...franchise,
      narrative: {
        ...franchise.narrative,
        situations: franchise.narrative.situations.map((situation) => {
          if (!keys.has(situation.detectorKey)) {
            return situation;
          }
          if (
            situation.status === "resolved" ||
            situation.status === "expired"
          ) {
            return situation;
          }
          return expireSituation(situation, date);
        }),
      },
    }));
  }
  return current;
}

function isDraftOrderFullyUsed(
  state: GameState,
  draftClassId: string,
): boolean {
  const draft = state.world.drafts[draftClassId];
  if (draft === undefined || draft.order.length === 0) {
    return false;
  }
  return draft.order.every((slot) => slot.status === "used");
}

/**
 * Exit hooks when leaving a user-controlled phase.
 * Exported for date-driven phase sync (calendar progression).
 */
export function processPhaseExit(
  state: GameState,
  fromPhaseId: LeaguePhaseId,
  rng?: Rng,
): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;

  if (fromPhaseId === "offseason.season_transition") {
    const finalized = finalizeCompletedSeason(
      current,
      rng ?? createSeededRng(current.meta.rngState),
    );
    current = finalized.state;
    events.push(...finalized.events);
  }

  if (fromPhaseId === "offseason.roster_decisions") {
    const released = releaseExpiredContracts(current);
    current = released.state;
    events.push(...released.events);
    const staffReleased = releaseExpiredStaffContracts(current);
    current = staffReleased.state;
    events.push(...staffReleased.events);
    const rfa = finalizeRfaQualification(current, {
      autoIssueQoForAiTeams: true,
    });
    current = rfa.state;
    events.push(...rfa.events);
  }

  if (fromPhaseId === "offseason.free_agency") {
    const withdrawn = withdrawOpenFreeAgencyOffers(current);
    current = withdrawn.state;
    events.push(...withdrawn.events);
  }

  if (fromPhaseId === "offseason.draft") {
    const draftYear = draftYearForSeason(current.competition.season.year);
    const draftClassId = draftClassIdFor(draftYear);
    const draft = current.world.drafts[draftClassId];
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
    const initialized = initializeNewSeason(current, rng);
    current = initialized.state;
    events.push(...initialized.events);
    const filled = fillShortRostersWithRng(current, rng);
    current = filled.state;
    events.push(...filled.events);
    // initializeNewSeason already enters preseason — skip normal advance target
  }

  return systemResult(current, events);
}

/**
 * Enter hooks when arriving at a phase.
 * Exported for date-driven phase sync (calendar progression).
 */
export function processPhaseEnter(
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
    const created = maybeCreateDraftForDecision(current, rng);
    current = created.state;
    events.push(...created.events);
  }

  if (toPhaseId === "offseason.draft" && rng) {
    const draftYear = draftYearForSeason(current.competition.season.year);
    const draftClassId = draftClassIdFor(draftYear);
    const created = maybeCreateDraftForDecision(current, rng);
    current = created.state;
    events.push(...created.events);
    const draft = current.world.drafts[draftClassId];
    if (draft !== undefined && draft.status === "not_started") {
      const activated = activateDraft(current, draftClassId);
      current = activated.state;
      events.push(...activated.events);
    }
  }

  if (toPhaseId === "offseason.free_agency") {
    if (current.competition.season.rfaQualificationComplete !== true) {
      const rfa = finalizeRfaQualification(current, {
        autoIssueQoForAiTeams: true,
      });
      current = rfa.state;
      events.push(...rfa.events);
    }
  }

  return systemResult(current, events);
}

function hasFranchiseHistoryForCurrentSeason(state: GameState): boolean {
  const seasonId = state.competition.season.id;
  return Object.values(state.business.franchiseHistory).some((history) =>
    history.seasons.some((season) => season.seasonId === seasonId),
  );
}

function finalizeCompletedSeason(state: GameState, rng: Rng): SystemResult {
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

  const dlTransition = processDevelopmentLeagueSeasonTransition(current);
  current = dlTransition.state;
  events.push(...dlTransition.events);

  const development = processSeasonPlayerDevelopment(current, rng);
  current = development.state;
  events.push(...development.events);

  const playerRetired = processPlayerRetirements(current, rng);
  current = playerRetired.state;
  events.push(...playerRetired.events);

  const staffDev = processSeasonStaffDevelopment(current, rng);
  current = staffDev.state;
  events.push(...staffDev.events);

  const staffRetired = processStaffRetirement(current, rng);
  current = staffRetired.state;
  events.push(...staffRetired.events);

  const staffReleased = releaseExpiredStaffContracts(current);
  current = staffReleased.state;
  events.push(...staffReleased.events);

  current = refreshStaffFreeAgentPool(current, rng);

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

  return systemResult(current, events);
}

function runSeasonTransition(state: GameState, rng: Rng): SystemResult {
  const finalized = finalizeCompletedSeason(state, rng);
  const entered = enterPhase(
    finalized.state,
    "offseason.roster_decisions",
    "season_transition_complete",
  );
  return systemResult(entered.state, [
    ...finalized.events,
    ...entered.events,
  ]);
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

    if (draft === undefined) {
      const created = maybeCreateDraftForDecision(current, rng);
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
      // Date-driven sync (syncPhaseForward) advances to free agency when ready.
    }
  }

  // Legacy league_initialization: finish new season if somehow still here
  if (
    phaseId === "offseason.staff_development" &&
    current.competition.season.offseasonStage === "league_initialization" &&
    current.competition.phase?.activePhaseId === undefined
  ) {
    const initialized = initializeNewSeason(current, rng);
    current = initialized.state;
    events.push(...initialized.events);
    const filled = fillShortRostersWithRng(current, rng);
    current = filled.state;
    events.push(...filled.events);
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
