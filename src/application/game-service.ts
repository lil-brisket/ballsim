import "server-only";
import {
  getActiveOwnedFranchise,
  withOwnedFranchise,
  withActiveOwnerTeam,
  getOwnedTeamIds,
  getBlockingDecisions,
  getPendingDecisionsForTeam,
  isOwnedFranchise,
  withAddedOwnedFranchise,
  getOwnedFranchiseAssistance,
} from "@/state/owner-context";
import { createDefaultOwnedFranchiseState } from "@/state/owned-franchise-state";
import {
  toTeamManagementOverview,
  toLineupView,
  toRotationView,
  toCoachingView,
  toInjuryReportView,
  toSeasonTransactionsView,
} from "@/state/team-management-selectors";
import {
  applyCoachingPresetCommand,
  applyLineupRecommendationCommand,
  previewLineupRecommendation,
  updateCoachingPhilosophyCommand,
  updateLineupCommand,
  updateRotationCommand,
  optimizeRotationCommand,
} from "@/systems/team-management-commands";

import type { ContractInput } from "@/domain/entities/contract";
import {
  declineTeamOption,
  exerciseTeamOption,
} from "@/domain/entities/contract";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { DomainEvent } from "@/domain/events";
import {
  asContractId,
  asGameId,
  asMediaItemId,
  asNarrativeSituationId,
  asOfferId,
  asOwnerDecisionId,
  asPlayerId,
  asSponsorshipId,
  asStaffId,
  asTeamId,
  type PlayerId,
  type TeamId,
} from "@/domain/ids";
import {
  isMediaUnread,
  type MediaHubTab,
  type MediaItem,
  type MediaLatestFilter,
  type MediaStoryType,
} from "@/domain/entities/media-item";
import type {
  SocialAuthorType,
  SocialPost,
} from "@/domain/entities/social-post";
import type { ImportanceLevel } from "@/domain/entities/event-source";
import { createSeededRng, type Rng } from "@/domain/rng";
import { validateGameState } from "@/persistence/validate-game-state";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";
import type {
  LoadedSaveGame,
  SaveGameStore,
  SaveGameSummary,
} from "@/persistence/save-game-store";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { appendEventLog } from "@/state/game-state";
import {
  cloneGameSettings,
  DEFAULT_GAME_SETTINGS,
  type GameSettings,
} from "@/domain/game-settings";
import { validateGameSettings } from "@/domain/game-settings-validation";
import { applyOwnerCitySelection } from "@/systems/owner-city-selection";
import { applyOwnerFranchiseBranding } from "@/systems/owner-franchise-branding";
import {
  applyConfirmControlledFranchises,
  type ControlledFranchiseIdentityInput,
} from "@/systems/confirm-controlled-franchises";
import {
  recordOwnershipEvidence,
} from "@/systems/ownership-confidence-engine";
import {
  scoreDraftSelection,
  scoreFacilityUpgrade,
  scoreFreeAgentSigning,
  scoreMarketingBudgetChange,
  scoreTradeDecision,
} from "@/systems/ownership-alignment-signals";
import {
  isPlayerInOwnerScope,
  listCitiesForTeamPick,
  listTeamsForSelection,
  toContractsView,
  toDashboardSnapshot,
  toDraftBoardView,
  toEventLogView,
  toFinancesView,
  toFreeAgentViews,
  toFreeAgencyOfferViews,
  toNotificationsView,
  toObjectivesView,
  toOpenFreeAgencyOfferViews,
  toPlayerDetailView,
  toRosterView,
  toScheduleView,
  toStandingsView,
  toGameBoxScoreView,
  canOpenGameBoxScore,
  type ContractRowView,
  type DashboardSnapshot,
  type DraftBoardView,
  type EventLogEntryView,
  type FinancesView,
  type FreeAgencyOfferView,
  type FreeAgentView,
  type GameBoxScoreView,
  type NotificationView,
  type ObjectiveView,
  type RosterPlayerView,
  type ScheduleGameView,
  type StandingRowView,
  type CityPickOption,
  type TeamListEntry,
} from "@/state/selectors";
import {
  toPlayerProfileView,
  type PlayerProfileView,
} from "@/state/player-profile-selectors";
import { toLeagueAwardsView } from "@/state/award-selectors";
import {
  toExpansionView,
  toFacilitiesView,
  toFranchiseBusinessView,
  toFranchiseHistoryView,
  toLeagueEconomyView,
  toRelocationView,
  toSponsorshipsView,
  toStaffView,
  type FacilityRowView,
  type FranchiseBusinessView,
  type FranchiseHistoryView,
  type SponsorshipView,
} from "@/state/franchise-selectors";
import {
  toFranchisePnLView,
  type FranchisePnLView,
} from "@/state/franchise-pnl";
import {
  toOwnerDashboardView,
  type OwnerDashboardView,
} from "@/state/owner-dashboard";
import {
  toPhaseDashboardView,
  type PhaseDashboardView,
} from "@/state/phase-dashboard";
import type { ExpansionState } from "@/domain/entities/expansion";
import type { LeagueEconomy } from "@/domain/entities/league-economy";
import type { RelocationProcess } from "@/domain/entities/relocation";
import { hireStaff } from "@/systems/staff";
import { fireStaffWithBuyout } from "@/systems/staff-contract-lifecycle";
import { startFacilityUpgrade } from "@/systems/facilities";
import type { FacilityCategory } from "@/domain/entities/franchise-ops";
import { setMarketingBudget } from "@/systems/marketing";
import {
  cancelGameDayPromotion,
  changeGameDayPromotion,
  refundFractionForCancel,
  scheduleGameDayPromotion,
} from "@/systems/game-day-promotions/schedule-game-day-promotion";
import {
  getGameDayPromotionDefinition,
  listGameDayPromotionDefinitions,
} from "@/systems/game-day-promotions/game-day-promotion-catalog";
import { projectGameDayPromotion } from "@/systems/game-day-promotions/project-game-day-promotion";
import { addCalendarDays, calendarDaysBetween, formatCalendarDate, parseCalendarDate } from "@/domain/calendar-date";
import { buildSimulationSummary } from "@/systems/calendar/simulation-summary";
import { setTicketPrice } from "@/systems/ticket-pricing";
import {
  advanceRelocationStage,
  cancelRelocation,
} from "@/systems/relocation";
import type { RelocationTarget } from "@/domain/entities/relocation";
import type { OwnerNavGroup } from "@/application/owner-nav-config";
import { ownerNavGroupsForState } from "@/application/owner-nav-config";
import {
  assessRelocation,
  type RelocationAssessment,
} from "@/state/relocation-assessment";
import {
  assessExpansion,
  type ExpansionAssessment,
} from "@/state/expansion-assessment";
import { EXPANSION_FEE_DEFAULT } from "@/systems/expansion-config";
import { signSponsorship } from "@/systems/sponsorships";
import {
  acknowledgeNarrativeSituationInState,
  applyNarrativeAction,
} from "@/application/narrative-action-adapter";
import {
  approveExpansion,
  completeExpansion,
  pickExpansionDivisionId,
  proposeExpansion,
  runExpansionDraft,
} from "@/systems/expansion";
import { runAiTeamDecisions } from "@/systems/ai-team-decisions";
import {
  draftYearForSeason,
  getActiveDraftOnClockSlot,
  isUserOnDraftClock,
  makeDraftSelection,
} from "@/systems/draft";
import { draftClassIdFor } from "@/domain/entities/draft";
import {
  assignPlayerToDevelopmentLeague,
  recallPlayerFromDevelopmentLeague,
} from "@/systems/development-league";
import {
  assignScoutToProspect,
  scoutRegionCoverage,
} from "@/systems/scouting";
import {
  addToDraftBoard,
  removeFromDraftBoard,
  toggleDraftBoardPriority,
} from "@/systems/draft/draft-board";
import { conductProspectInterview } from "@/systems/draft/prospect-interviews";
import {
  acceptOffer,
  listFreeAgents,
  makeOffer,
  withdrawOffer,
} from "@/systems/free-agency";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { buildSimulationHighlights } from "@/systems/simulation/simulation-highlights";
import {
  findNextSimulationTarget,
  getCalendarMonthGrid,
  getCalendarTodayBriefing,
  summarizeSimulationRange,
  type CalendarMonthGrid,
  type CalendarTodayBriefing,
  type SimulationRangePreview,
  type SimulationTarget,
} from "@/systems/calendar";

import { getTeamGameForDate } from "@/systems/calendar/schedule-projection";
import { resolvePhaseResolution, resolveSeasonAnchors } from "@/systems/league-rules/league-calendar";
import { getPhaseDefinition } from "@/systems/phase-engine";
import {
  CALENDAR_FILTERS,
  type CalendarFilter,
} from "@/domain/entities/calendar-event";
import { processDerivedProjections } from "@/systems/media-hub";
import { advanceLeaguePhase } from "@/systems/simulation/offseason-lifecycle";
import { isInLeaguePhase, previewAdvance, getActivePhaseId } from "@/systems/phase-engine";
import { getActionBlockReason } from "@/systems/league-rules";
import { enterOffseasonFromPostseason } from "@/systems/simulation/season-lifecycle";
import { runAiContinuity } from "@/systems/simulation/ai-continuity";
import { canAiExecute, isUserAssistCompletelyOff } from "@/systems/simulation/management-policy";
import { resolveSimulationPhaseKey } from "@/systems/simulation/simulation-phase";
import type { AdvanceSimulationResult } from "@/systems/simulation/types";
import {
  addToTradeBlock,
  evaluateTradeOffer,
  executeTrade,
  findTrades,
  getTradeBlock,
  validateTrade,
  type TradeFinderCandidate,
} from "@/systems/trades";
import {
  applyTradeCounterofferState,
  getActiveOwnerDecision,
  hasActiveOwnerDecision,
  resolvePendingOwnerDecision,
} from "@/systems/owner-decisions";
import { PLAYER_POSITIONS, type PlayerPosition } from "@/domain/entities/player";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  advanceFantasyDraftClock,
  advanceFantasyDraftUntilNextUserPick,
  addToFantasyDraftQueue,
  confirmFantasyDraftOrder,
  getCurrentPick,
  makeFantasyDraftSelection,
  moveTeamInOrder,
  moveTeamToIndex,
  pauseFantasyDraft,
  randomizeDraftOrder,
  removeFromFantasyDraftQueue,
  reorderFantasyDraftQueue,
  resumeFantasyDraft,
  setDefaultDraftOrder,
  setFantasyDraftAutoPick,
  setFantasyDraftAutoPickAll,
  setFantasyDraftAutoPickStrategy,
  swapTeamsInOrder,
  undoLastFantasyDraftPick,
  updateFantasyDraftSettings,
  withFantasyDraft,
} from "@/systems/fantasy-draft";
import type {
  FantasyDraftAutoPickStrategy,
  FantasyDraftType,
} from "@/domain/entities/fantasy-draft";
import {
  toFantasyDraftView,
  toFantasyDraftPlayerDetailView,
  toFantasyDraftSummaryView,
  type FantasyDraftView,
  type FantasyDraftPlayerDetailView,
} from "@/state/selectors";

/** Max Owner Mode SaveGame rows. Current-count cap, not a lifetime counter. */
export const MAX_OWNER_SAVE_SLOTS = 10;

export type CreateGameResult = {
  save: SaveGameSummary;
  dashboard: DashboardSnapshot;
  navGroups?: readonly OwnerNavGroup[];
};

export type OwnerCommandSuccess<T extends object = object> = {
  ok: true;
  save: SaveGameSummary;
  dashboard: DashboardSnapshot;
} & T;

export type OwnerCommandFailure = {
  ok: false;
  error: string;
};

export type OwnerCommandResult<T extends object = object> =
  | OwnerCommandSuccess<T>
  | OwnerCommandFailure;

export type AdvanceDayResult = CreateGameResult & {
  events: DomainEvent[];
  simulation: Omit<AdvanceSimulationResult, "state" | "events">;
};

export type OwnerSaveView = CreateGameResult & {
  teams: TeamListEntry[];
  cities: CityPickOption[];
  roster: RosterPlayerView[];
  standings: StandingRowView[];
  freeAgents: FreeAgentView[];
  freeAgencyOffers: FreeAgencyOfferView[];
  openFreeAgencyOffers: FreeAgencyOfferView[];
  draftBoard: DraftBoardView | null;
  tradeCandidates: TradeFinderCandidate[];
  objectives: ObjectiveView[];
  notifications: NotificationView[];
  eventLog: EventLogEntryView[];
  schedule: ScheduleGameView[];
  contracts: ContractRowView[];
  finances: FinancesView;
  staff: ReturnType<typeof toStaffView>;
  facilities: FacilityRowView[];
  franchiseBusiness: FranchiseBusinessView;
  franchisePnL: FranchisePnLView;
  sponsorships: SponsorshipView[];
  leagueEconomy: LeagueEconomy;
  relocation: RelocationProcess;
  expansion: ExpansionState;
  relocationAssessment: RelocationAssessment;
  expansionAssessment: ExpansionAssessment;
  franchiseHistory: FranchiseHistoryView;
  ownerDashboard: OwnerDashboardView;
  phaseDashboard: PhaseDashboardView;
  /** Persisted career settings from GameState.settings (read-only for UI). */
  settings: GameSettings;
  leagueAwards: ReturnType<typeof toLeagueAwardsView>;
};

function toSaveSummary(loaded: LoadedSaveGame): SaveGameSummary {
  return {
    id: loaded.id,
    name: loaded.name,
    schemaVersion: loaded.schemaVersion,
    createdAt: loaded.createdAt,
    updatedAt: loaded.updatedAt,
  };
}

function getStore(store?: SaveGameStore): SaveGameStore {
  return store ?? prismaSaveGameStore;
}

function fail(error: string): OwnerCommandFailure {
  return { ok: false, error };
}

function withDashboard(
  loaded: LoadedSaveGame,
  extra: object = {},
): OwnerCommandSuccess {
  return {
    ok: true,
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(loaded.state),
    ...extra,
  };
}

/**
 * Persist working state after successful command validation.
 * Writes RNG only on the working copy being saved.
 * Appends newlyEmittedEvents exactly once into user.eventLog (bounded).
 */
async function persistWorkingState(
  saveId: string,
  working: GameState,
  rngState: number,
  store: SaveGameStore,
  newlyEmittedEvents: readonly DomainEvent[] = [],
): Promise<LoadedSaveGame> {
  const withEvents = appendEventLog(working, newlyEmittedEvents);
  validateGameState(withEvents);
  const nowIso = new Date().toISOString();
  const nextState: GameState = {
    ...withEvents,
    meta: {
      ...withEvents.meta,
      rngState,
      updatedAt: nowIso,
    },
  };
  validateGameState(nextState);
  return store.save({ id: saveId, state: nextState });
}

export async function createNewOwnerSave(
  input: {
    name: string;
    rngSeed?: number;
    settings?: GameSettings;
  },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const existing = await saveStore.list();
  if (existing.length >= MAX_OWNER_SAVE_SLOTS) {
    return fail(
      `Owner Mode allows at most ${MAX_OWNER_SAVE_SLOTS} saves. Delete a save to create another.`,
    );
  }

  const settingsInput = cloneGameSettings(
    input.settings ?? DEFAULT_GAME_SETTINGS,
  );
  const validated = validateGameSettings(settingsInput);
  if (!validated.ok) {
    return fail(`Invalid game settings: ${validated.errors.join("; ")}`);
  }

  const saveId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  let state = createInitialGameState({
    saveId,
    rngSeed: input.rngSeed,
    nowIso,
    settings: validated.settings,
  });

  const rng = createSeededRng(state.meta.rngState);
  const bootstrapped = bootstrapWorld(state, rng);
  state = {
    ...bootstrapped.state,
    meta: {
      ...bootstrapped.state.meta,
      rngState: rng.getState(),
      updatedAt: nowIso,
    },
  };
  validateGameState(state);

  const loaded = await saveStore.create({
    id: saveId,
    name: input.name.trim() || "New Franchise",
    state,
  });

  return withDashboard(loaded);
}

export async function loadOwnerSave(
  saveId: string,
  store?: SaveGameStore,
): Promise<CreateGameResult | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }

  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(loaded.state),
    navGroups: ownerNavGroupsForState(loaded.state),
  };
}

export async function loadOwnerSaveView(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerSaveView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  const state = loaded.state;
  const teamId = state.user.activeOwnerTeamId;
  const roster = toRosterView(state);
  const outgoingPlayerId = roster[roster.length - 1]?.playerId;
  let tradeCandidates: TradeFinderCandidate[] = [];
  if (outgoingPlayerId) {
    tradeCandidates = findTrades(ensureAiTradeBlocks(state), {
      direction: "move",
      teamId,
      asset: { kind: "player", playerId: asPlayerId(outgoingPlayerId) },
    });
  }

  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(state),
    teams: listTeamsForSelection(state),
    cities: listCitiesForTeamPick(state),
    roster,
    standings: toStandingsView(state),
    freeAgents: toFreeAgentViews(state),
    freeAgencyOffers: toFreeAgencyOfferViews(state),
    openFreeAgencyOffers: toOpenFreeAgencyOfferViews(state),
    draftBoard: toDraftBoardView(state),
    tradeCandidates,
    objectives: toObjectivesView(state),
    notifications: toNotificationsView(state),
    eventLog: toEventLogView(state),
    schedule: toScheduleView(state),
    contracts: toContractsView(state),
    finances: toFinancesView(state),
    staff: toStaffView(state),
    facilities: toFacilitiesView(state),
    franchiseBusiness: toFranchiseBusinessView(state),
    franchisePnL: toFranchisePnLView(state),
    sponsorships: toSponsorshipsView(state),
    leagueEconomy: toLeagueEconomyView(state),
    relocation: toRelocationView(state),
    expansion: toExpansionView(state),
    relocationAssessment: assessRelocation(state),
    expansionAssessment: assessExpansion(state),
    franchiseHistory: toFranchiseHistoryView(state),
    ownerDashboard: toOwnerDashboardView(state),
    phaseDashboard: toPhaseDashboardView(state),
    settings: state.settings,
    leagueAwards: toLeagueAwardsView(state, saveId),
    navGroups: ownerNavGroupsForState(state),
  };
}

export type CalendarPageMediaHighlight = {
  date: string;
  headline: string;
  summary: string;
  storyType: string;
};

export type CalendarPageView = {
  save: SaveGameSummary;
  dashboard: DashboardSnapshot;
  currentDate: string;
  year: number;
  month: number;
  selectedDate: string;
  filter: CalendarFilter;
  monthGrid: CalendarMonthGrid;
  todayBriefing: CalendarTodayBriefing;
  simulationPreview: SimulationRangePreview | null;
  nextTargets: {
    nextGame: SimulationTarget | null;
    nextImportant: SimulationTarget | null;
    nextDecision: SimulationTarget | null;
    nextDeadline: SimulationTarget | null;
  };
  timeDisabled: boolean;
  timeDisabledFlags: {
    userOnDraftClock: boolean;
    seasonReviewPending: boolean;
    pendingOwnerDecision: boolean;
  };
  recentMediaHighlights: CalendarPageMediaHighlight[];
  userTeamId: TeamId;
  phaseLabel: string;
  phaseId: string;
  teamGameOnSelectedDate: {
    gameId: string;
    opponentLabel: string;
    home: boolean;
    status: string;
    scoreLabel: string | null;
  } | null;
  pauseBanner: {
    reason: "draft_clock" | "owner_decision" | null;
    message: string | null;
    resolveHref: string | null;
  };
  simulationSummary: import("@/systems/calendar/simulation-summary").SimulationSummary | null;
};

export type LoadCalendarPageViewOptions = {
  year?: number;
  month?: number;
  selectedDate?: string;
  filter?: CalendarFilter;
  /** When set with daysAdvanced, rebuilds a team-first simulation summary. */
  simulationFromDate?: string;
  daysAdvanced?: number;
};

/**
 * Calendar page data: month grid, today briefing, simulation targets/preview.
 * Loads GameState once; does not invent projected trades or injuries.
 */
export async function loadCalendarPageView(
  saveId: string,
  options: LoadCalendarPageViewOptions = {},
  store?: SaveGameStore,
): Promise<CalendarPageView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }

  const state = loaded.state;
  const currentDate = state.world.calendar.currentDate;
  const parsedCurrent = parseCalendarDate(currentDate);

  const year =
    options.year !== undefined && Number.isInteger(options.year)
      ? options.year
      : parsedCurrent.year;
  const month =
    options.month !== undefined &&
    Number.isInteger(options.month) &&
    options.month >= 1 &&
    options.month <= 12
      ? options.month
      : parsedCurrent.month;

  const selectedDate =
    options.selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(options.selectedDate)
      ? options.selectedDate
      : currentDate;

  const filter: CalendarFilter =
    options.filter &&
    (CALENDAR_FILTERS as readonly string[]).includes(options.filter)
      ? options.filter
      : "all";

  const monthGrid = getCalendarMonthGrid(state, year, month, { saveId });
  const todayBriefing = getCalendarTodayBriefing(state);

  let simulationPreview: SimulationRangePreview | null = null;
  if (selectedDate >= currentDate) {
    try {
      simulationPreview = summarizeSimulationRange(state, selectedDate);
    } catch {
      simulationPreview = null;
    }
  }

  const ownerDash = toOwnerDashboardView(state);
  const timeDisabledFlags = {
    userOnDraftClock: ownerDash.flags.userOnDraftClock,
    seasonReviewPending: ownerDash.flags.seasonReviewPending,
    pendingOwnerDecision: ownerDash.flags.pendingOwnerDecision,
  };

  const franchise = getActiveOwnedFranchise(state);
  const recentMediaHighlights: CalendarPageMediaHighlight[] = (
    franchise.mediaFeed?.items ?? []
  )
    .slice(0, 40)
    .map((item) => ({
      date: item.occurredOn,
      headline: item.headline,
      summary: item.summary,
      storyType: item.storyType,
    }));

  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(state),
    currentDate,
    year,
    month,
    selectedDate,
    filter,
    monthGrid,
    todayBriefing,
    simulationPreview,
    nextTargets: {
      nextGame: findNextSimulationTarget(state, "next_game"),
      nextImportant: findNextSimulationTarget(state, "next_important"),
      nextDecision: findNextSimulationTarget(state, "next_decision"),
      nextDeadline: findNextSimulationTarget(state, "next_deadline"),
    },
    timeDisabled:
      timeDisabledFlags.userOnDraftClock ||
      timeDisabledFlags.pendingOwnerDecision,
    timeDisabledFlags,
        recentMediaHighlights,
    userTeamId: state.user.activeOwnerTeamId,
    phaseId: getActivePhaseId(state),
    phaseLabel: getPhaseDefinition(getActivePhaseId(state)).name,
    teamGameOnSelectedDate: (() => {
      const teamId = state.user.activeOwnerTeamId;
      const game = getTeamGameForDate(state, teamId, selectedDate);
      if (!game) return null;
      const home = game.homeTeamId === teamId;
      const opponentId = home ? game.awayTeamId : game.homeTeamId;
      const opponent = state.world.teams[opponentId];
      const opponentLabel = opponent
        ? `${opponent.city} ${opponent.name}`
        : String(opponentId);
      let scoreLabel: string | null = null;
      if (game.status === "final") {
        const homeScore = game.score?.home;
        const awayScore = game.score?.away;
        if (typeof homeScore === "number" && typeof awayScore === "number") {
          scoreLabel = home
            ? `${homeScore}–${awayScore}`
            : `${awayScore}–${homeScore}`;
        }
      }
      return {
        gameId: game.id,
        opponentLabel,
        home,
        status: game.status,
        scoreLabel,
      };
    })(),
    pauseBanner: timeDisabledFlags.userOnDraftClock
      ? {
          reason: "draft_clock" as const,
          message: "Simulation paused — your team is on the draft clock.",
          resolveHref: `/dashboard/${saveId}/draft`,
        }
      : timeDisabledFlags.pendingOwnerDecision
        ? {
            reason: "owner_decision" as const,
            message:
              "Simulation paused — a required owner decision must be resolved.",
            resolveHref: `/dashboard/${saveId}`,
          }
        : { reason: null, message: null, resolveHref: null },
    simulationSummary: (() => {
      const daysAdvanced = options.daysAdvanced;
      if (
        daysAdvanced == null ||
        !Number.isInteger(daysAdvanced) ||
        daysAdvanced < 1
      ) {
        return null;
      }
      const fromDate =
        options.simulationFromDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(options.simulationFromDate)
          ? options.simulationFromDate
          : addCalendarDays(currentDate, -daysAdvanced);
      return buildSimulationSummary(state, [], {
        fromDate,
        toDate: currentDate,
      });
    })(),
  };
}

export async function loadOwnerPlayerView(
  saveId: string,
  playerId: string,
  store?: SaveGameStore,
): Promise<(CreateGameResult & { player: PlayerProfileView }) | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  const typedId = asPlayerId(playerId);
  if (!isPlayerInOwnerScope(loaded.state, typedId)) {
    return null;
  }
  const detail = toPlayerDetailView(loaded.state, typedId);
  if (!detail) {
    return null;
  }
  const player = toPlayerProfileView(loaded.state, typedId, detail);
  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(loaded.state),
    player,
  };
}

export async function loadOwnerGameBoxScoreView(
  saveId: string,
  gameId: string,
  store?: SaveGameStore,
): Promise<(CreateGameResult & { boxScore: GameBoxScoreView }) | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  if (!canOpenGameBoxScore(loaded.state, gameId)) {
    return null;
  }
  const boxScore = toGameBoxScoreView(loaded.state, gameId);
  if (!boxScore) {
    return null;
  }
  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(loaded.state),
    boxScore,
  };
}

export async function listOwnerSaves(
  store?: SaveGameStore,
): Promise<SaveGameSummary[]> {
  return getStore(store).list();
}

/**
 * Home / Load screen preview for one save.
 * Built from existing load + toDashboardSnapshot — not a second validation path.
 * Unloadable saves are represented as error entries; they are never deleted here.
 */
export type OwnerSavePreview =
  | {
      ok: true;
      id: string;
      name: string;
      updatedAt: Date;
      createdAt: Date;
      mode: DashboardSnapshot["mode"];
      controlledTeam: DashboardSnapshot["controlledTeam"];
      seasonYear: number;
      currentDate: string;
      seasonPhase: DashboardSnapshot["seasonPhase"];
      teamSelectionLocked: boolean;
    }
  | {
      ok: false;
      id: string;
      name: string;
      updatedAt: Date;
      createdAt: Date;
      error: string;
    };

/**
 * List save previews for Home / Load. Isolates per-save load failures so one
 * malformed save cannot break the rest. Does not migrate, repair, or delete.
 */
export async function listOwnerSavePreviews(
  store?: SaveGameStore,
): Promise<OwnerSavePreview[]> {
  const saveStore = getStore(store);
  const summaries = await saveStore.list();
  const previews: OwnerSavePreview[] = [];

  for (const summary of summaries) {
    try {
      const loaded = await saveStore.load(summary.id);
      if (!loaded) {
        previews.push({
          ok: false,
          id: summary.id,
          name: summary.name,
          updatedAt: summary.updatedAt,
          createdAt: summary.createdAt,
          error: "Save could not be loaded.",
        });
        continue;
      }
      const dashboard = toDashboardSnapshot(loaded.state);
      previews.push({
        ok: true,
        id: loaded.id,
        name: loaded.name,
        updatedAt: loaded.updatedAt,
        createdAt: loaded.createdAt,
        mode: dashboard.mode,
        controlledTeam: dashboard.controlledTeam,
        seasonYear: dashboard.seasonYear,
        currentDate: dashboard.currentDate,
        seasonPhase: dashboard.seasonPhase,
        teamSelectionLocked: dashboard.teamSelectionLocked,
      });
    } catch {
      previews.push({
        ok: false,
        id: summary.id,
        name: summary.name,
        updatedAt: summary.updatedAt,
        createdAt: summary.createdAt,
        error: "Save is incompatible or corrupted.",
      });
    }
  }

  return previews;
}

/**
 * Delete a save by SaveGame.id. No user/session ownership check — the
 * current save model is local/single-user. Do not introduce a parallel
 * authorization model here.
 */
export async function deleteOwnerSave(
  saveId: string,
  store?: SaveGameStore,
): Promise<boolean> {
  return getStore(store).delete(saveId);
}

/**
 * Persist GameState without running simulation. Does not mutate input state.
 */
export async function saveOwnerGame(
  saveId: string,
  state: GameState,
  store?: SaveGameStore,
): Promise<CreateGameResult> {
  validateGameState(state);
  const saved = await getStore(store).save({ id: saveId, state });
  return {
    save: toSaveSummary(saved),
    dashboard: toDashboardSnapshot(saved.state),
  };
}

export async function selectOwnerTeam(
  saveId: string,
  teamId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const typedTeamId = asTeamId(teamId);
  if (loaded.state.world.teams[typedTeamId] === undefined) {
    return fail(`Team "${teamId}" does not exist.`);
  }

  if (loaded.state.world.calendar.lastSimulatedDate !== null) {
    if (loaded.state.user.activeOwnerTeamId === typedTeamId) {
      return withDashboard(loaded);
    }
    return fail(
      "Team selection is locked after the first time advance for this save.",
    );
  }

  if (loaded.state.user.activeOwnerTeamId === typedTeamId) {
    return withDashboard(loaded);
  }

  const previous = getActiveOwnedFranchise(loaded.state);
  const working = withOwnedFranchise(
    {
      ...loaded.state,
      user: {
        ...loaded.state.user,
        ownedTeamIds: [typedTeamId],
        activeOwnerTeamId: typedTeamId,
        ownedFranchises:
          typedTeamId === loaded.state.user.activeOwnerTeamId
            ? loaded.state.user.ownedFranchises
            : {
                [typedTeamId]:
                  loaded.state.user.ownedFranchises[typedTeamId] ??
                  loaded.state.user.ownedFranchises[
                    loaded.state.user.activeOwnerTeamId
                  ]!,
              },
      },
    },
    typedTeamId,
    {
      ...(loaded.state.user.ownedFranchises[typedTeamId] ?? previous),
      citySelectionConfirmed: true,
      franchiseIdentityConfirmed: true,
    },
  );

  try {
    const saved = await persistWorkingState(
      saveId,
      working,
      loaded.state.meta.rngState,
      saveStore,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Switch the active Owner Mode franchise (UI context only).
 * Does not affect simulation — simulation keys off ownedTeamIds.
 */
export async function switchActiveOwnerTeam(
  saveId: string,
  teamId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const typedTeamId = asTeamId(teamId);
  if (!isOwnedFranchise(loaded.state, typedTeamId)) {
    return fail(`Team "${teamId}" is not one of your owned franchises.`);
  }
  if (loaded.state.user.activeOwnerTeamId === typedTeamId) {
    return withDashboard(loaded);
  }
  try {
    const working = withActiveOwnerTeam(loaded.state, typedTeamId);
    const saved = await persistWorkingState(
      saveId,
      working,
      loaded.state.meta.rngState,
      saveStore,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Mid-career takeover of an AI-controlled franchise.
 * Retains all team-level state; generates a new player owner mandate.
 */
export async function takeOverFranchise(
  saveId: string,
  teamId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const typedTeamId = asTeamId(teamId);
  if (loaded.state.world.teams[typedTeamId] === undefined) {
    return fail(`Team "${teamId}" does not exist.`);
  }
  if (isOwnedFranchise(loaded.state, typedTeamId)) {
    return fail(`Team "${teamId}" is already under your control.`);
  }

  const seasonYear = loaded.state.competition.season.year;
  const franchise = createDefaultOwnedFranchiseState({
    seasonYear,
    currentDate: loaded.state.world.calendar.currentDate,
    citySelectionConfirmed: true,
    franchiseIdentityConfirmed: true,
    aiAssistance: { ...loaded.state.settings.ai.assistance },
    managementPreset: loaded.state.settings.ai.managementPreset,
  });

  try {
    const working = withAddedOwnedFranchise(
      loaded.state,
      typedTeamId,
      franchise,
      { setActive: true },
    );
    const saved = await persistWorkingState(
      saveId,
      working,
      loaded.state.meta.rngState,
      saveStore,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Confirm additional owned franchises during onboarding (after primary city pick).
 */
export async function confirmControlledFranchises(
  saveId: string,
  franchises: readonly ControlledFranchiseIdentityInput[],
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const applied = applyConfirmControlledFranchises(loaded.state, franchises);
  if (!applied.ok) {
    return fail(applied.error);
  }

  try {
    const saved = await persistWorkingState(
      saveId,
      applied.state,
      loaded.state.meta.rngState,
      saveStore,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/** @deprecated Prefer {@link confirmControlledFranchises} for onboarding. */
export async function confirmOwnedFranchises(
  saveId: string,
  additionalTeamIds: readonly string[],
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const anchorId = loaded.state.user.activeOwnerTeamId;
  const anchorTeam = loaded.state.world.teams[anchorId];
  if (!anchorTeam) {
    return fail(`Anchor team "${anchorId}" is missing.`);
  }

  const franchises: ControlledFranchiseIdentityInput[] = [
    {
      teamId: anchorId,
      nickname: anchorTeam.name,
      primaryColor: anchorTeam.branding.primaryColor,
      secondaryColor: anchorTeam.branding.secondaryColor,
      accentColor: anchorTeam.branding.accentColor,
      logoId: anchorTeam.branding.logoId,
    },
  ];

  for (const rawId of additionalTeamIds) {
    const team = loaded.state.world.teams[asTeamId(rawId)];
    if (!team) {
      return fail(`Team "${rawId}" does not exist.`);
    }
    franchises.push({
      teamId: team.id,
      nickname: team.name,
      primaryColor: team.branding.primaryColor,
      secondaryColor: team.branding.secondaryColor,
      accentColor: team.branding.accentColor,
      logoId: team.branding.logoId,
    });
  }

  return confirmControlledFranchises(saveId, franchises, store);
}

export async function selectOwnerCity(
  saveId: string,
  city: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const applied = applyOwnerCitySelection(loaded.state, city);
  if (!applied.ok) {
    return fail(applied.error);
  }

  try {
    const saved = await persistWorkingState(
      saveId,
      applied.state,
      loaded.state.meta.rngState,
      saveStore,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function confirmOwnerTeamIdentity(
  saveId: string,
  input: {
    nickname: string;
    logoId: string;
    paletteId?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
  },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const applied = applyOwnerFranchiseBranding(loaded.state, input);
  if (!applied.ok) {
    return fail(applied.error);
  }

  try {
    const saved = await persistWorkingState(
      saveId,
      applied.state,
      loaded.state.meta.rngState,
      saveStore,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export type SimulationStopCondition =
  | "blocking_decision"
  | "user_team_game"
  | "important_event"
  | "phase_change";

export type AdvanceOwnerTimeOptions = {
  days?: number;
  stopOnPhaseChange?: boolean;
  /** Simulate forward until this calendar date is current (inclusive landing). */
  targetDate?: string;
  /** Explicit shortcut modes — resolve target date from calendar projection. */
  targetMode?:
    | "next_game"
    | "next_important"
    | "next_decision"
    | "next_deadline"
    | "next_month"
    | "end_of_season";
  /** Optional early-stop conditions for multi-day advances. */
  stopConditions?: SimulationStopCondition[];
};

export async function advanceOwnerTime(
  saveId: string,
  options: AdvanceOwnerTimeOptions = {},
  store?: SaveGameStore,
): Promise<
  OwnerCommandResult<{
    events: DomainEvent[];
    simulation: Omit<AdvanceSimulationResult, "state" | "events">;
    highlights: ReturnType<typeof buildSimulationHighlights>;
    summary?: import("@/systems/calendar/simulation-summary").SimulationSummary;
  }>
> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  let workingState = loaded.state;
  let rngState = loaded.state.meta.rngState;
  const preEvents: DomainEvent[] = [];

  if (hasActiveOwnerDecision(workingState.user)) {
    const blocking = workingState.user.pendingOwnerDecisions.find(
      (d) => d.blockingLevel === "blocking",
    );
    const teamId = blocking?.primaryTeamId;
    const team = teamId ? workingState.world.teams[teamId] : undefined;
    const teamLabel = team
      ? `${team.city} ${team.name}`
      : teamId ?? "a franchise";
    const switchHint =
      teamId && teamId !== workingState.user.activeOwnerTeamId
        ? ` Switch to ${teamLabel} on My Teams to resolve it.`
        : "";
    return fail(
      `${teamLabel} needs your attention before time can advance. Resolve the pending owner decision first.${switchHint}`,
    );
  }

  if (isUserOnDraftClock(workingState)) {
    const franchiseAssist = getOwnedFranchiseAssistance(workingState);
    if (!canAiExecute(workingState.settings, "DRAFT_PICK", franchiseAssist)) {
      return fail(
        "Cannot advance time while your team is on the draft clock. Make a draft selection first.",
      );
    }
    const rngDraft = createSeededRng(rngState);
    try {
      const continuity = runAiContinuity(workingState, rngDraft, {
        forcePhase: `draft_clock:${workingState.world.calendar.currentDate}`,
      });
      workingState = continuity.state;
      rngState = rngDraft.getState();
      preEvents.push(...continuity.events);
      if (isUserOnDraftClock(workingState)) {
        return fail(
          "Cannot advance time while your team is on the draft clock. Make a draft selection first.",
        );
      }
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  }

  // Preflight: reconcile phase pointer with date/state before simulating.
  {
    const { reconcilePhaseWithState } = await import(
      "@/systems/simulation/phase-lifecycle"
    );
    const preflight = reconcilePhaseWithState(workingState);
    workingState = preflight.state;
    preEvents.push(...preflight.events);
    if (preflight.stopReason === "owner_decision") {
      return fail(
        preflight.stopMessage ??
          "A required owner decision must be resolved before time can advance.",
      );
    }
    if (preflight.stopReason === "draft_clock") {
      return fail(
        preflight.stopMessage ??
          "Cannot advance time while your team is on the draft clock.",
      );
    }
  }

  const resolved = resolveAdvanceDays(workingState, options);
  if (!resolved.ok) {
    return fail(resolved.error);
  }

  const stopConditions = options.stopConditions ?? [];
  const stopOnPhaseChange =
    options.stopOnPhaseChange === true ||
    stopConditions.includes("phase_change");

  const rng = createSeededRng(rngState);

  try {
    const result = advanceSimulation(workingState, rng, {
      days: resolved.days,
      stopOnPhaseChange,
    });

    // Postflight: final phase reconciliation + full invariant validation.
    const { reconcilePhaseWithState } = await import(
      "@/systems/simulation/phase-lifecycle"
    );
    const { assertSimulationState } = await import(
      "@/systems/simulation/validate-simulation-state"
    );
    const { buildSimulationSummary } = await import(
      "@/systems/calendar/simulation-summary"
    );
    const postflight = reconcilePhaseWithState(result.state, rng);
    assertSimulationState(postflight.state, "full");

    const fromDate = workingState.world.calendar.currentDate;
    const allEvents = [...preEvents, ...result.events, ...postflight.events];
    const withProjections = processDerivedProjections(postflight.state, allEvents);

    const saved = await persistWorkingState(
      saveId,
      withProjections,
      rng.getState(),
      saveStore,
      allEvents,
    );

    const { state: _state, events: _ignored, ...simulation } = result;
    const highlights = buildSimulationHighlights(withProjections, allEvents);
    const summary = buildSimulationSummary(withProjections, allEvents, {
      fromDate,
      toDate: withProjections.world.calendar.currentDate,
    });
    return {
      ...withDashboard(saved),
      events: allEvents,
      simulation,
      highlights,
      summary,
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

function resolveAdvanceDays(
  state: GameState,
  options: AdvanceOwnerTimeOptions,
): { ok: true; days: number } | { ok: false; error: string } {
  const currentDate = state.world.calendar.currentDate;
  const stopConditions = [...(options.stopConditions ?? [])];

  let days = options.days ?? 1;
  let targetDate = options.targetDate;

  if (options.targetMode != null) {
    if (options.targetMode === "next_decision") {
      // Advance until a blocking decision appears or phase changes.
      days = 400;
      stopConditions.push("blocking_decision", "phase_change");
      targetDate = undefined;
    } else if (options.targetMode === "next_month") {
      const parsed = parseCalendarDate(currentDate);
      const lastDayThisMonth = formatCalendarDate(
        parsed.year,
        parsed.month,
        new Date(parsed.year, parsed.month, 0).getDate(),
      );
      targetDate = lastDayThisMonth;
      if (targetDate <= currentDate) {
        const nextMonth = parsed.month === 12 ? 1 : parsed.month + 1;
        const nextYear = parsed.month === 12 ? parsed.year + 1 : parsed.year;
        targetDate = formatCalendarDate(
          nextYear,
          nextMonth,
          new Date(nextYear, nextMonth, 0).getDate(),
        );
      }
      stopConditions.push("blocking_decision");
    } else if (options.targetMode === "end_of_season") {
      const anchors = resolveSeasonAnchors(state);
      targetDate =
        anchors.playoffsEnd ??
        anchors.regularSeasonEnd ??
        anchors.seasonReviewStart ??
        undefined;
      if (!targetDate || targetDate <= currentDate) {
        return {
          ok: false,
          error: "No end-of-season date is available to simulate to.",
        };
      }
      stopConditions.push("blocking_decision");
    } else {
      const target = findNextSimulationTarget(state, options.targetMode);
      if (!target || target.daysUntil < 1) {
        const labels: Record<string, string> = {
          next_game: "No upcoming team game found.",
          next_important: "No upcoming important event found.",
          next_deadline: "No upcoming deadline found.",
        };
        return {
          ok: false,
          error: labels[options.targetMode] ?? "No target found.",
        };
      }
      targetDate = target.date;
      if (options.targetMode === "next_game") {
        stopConditions.push("user_team_game", "blocking_decision");
      } else if (options.targetMode === "next_important") {
        stopConditions.push("important_event", "blocking_decision");
      } else {
        stopConditions.push("blocking_decision");
      }
    }
  }

  if (targetDate != null) {
    const delta = calendarDaysBetween(currentDate, targetDate);
    if (delta < 0) {
      return {
        ok: false,
        error: "Cannot simulate backward. Select a future date.",
      };
    }
    if (delta === 0) {
      return {
        ok: false,
        error: "Already at the selected date.",
      };
    }
    days = delta;
  }

  // Cap days at earlier stop-condition targets when requested.
  const caps: number[] = [days];

  if (stopConditions.includes("user_team_game")) {
    const next = findNextSimulationTarget(state, "next_game");
    if (next && next.daysUntil > 0) {
      caps.push(next.daysUntil);
    }
  }
  if (stopConditions.includes("important_event")) {
    const next = findNextSimulationTarget(state, "next_important");
    if (next && next.daysUntil > 0) {
      caps.push(next.daysUntil);
    }
  }
  if (
    stopConditions.includes("blocking_decision") &&
    options.targetMode !== "next_decision"
  ) {
    const next = findNextSimulationTarget(state, "next_decision");
    if (next && next.daysUntil > 0) {
      caps.push(next.daysUntil);
    }
  }

  const resolvedDays = Math.min(...caps);
  if (!Number.isInteger(resolvedDays) || resolvedDays < 1) {
    return { ok: false, error: "Nothing to simulate for the selected target." };
  }

  return { ok: true, days: resolvedDays };
}

/** @deprecated Prefer advanceOwnerTime — kept for existing callers. */
export async function advanceOwnerDay(
  saveId: string,
  store?: SaveGameStore,
): Promise<AdvanceDayResult | null> {
  const result = await advanceOwnerTime(saveId, { days: 1 }, store);
  if (!result.ok) {
    if (result.error === "Save not found.") {
      return null;
    }
    throw new Error(result.error);
  }
  return {
    save: result.save,
    dashboard: result.dashboard,
    events: result.events,
    simulation: result.simulation,
  };
}

export async function listOwnerTradeCandidates(
  saveId: string,
  outgoingPlayerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ candidates: TradeFinderCandidate[] }>> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const playerId = asPlayerId(outgoingPlayerId);
  const teamId = loaded.state.user.activeOwnerTeamId;
  const team = loaded.state.world.teams[teamId];
  if (!team?.roster.includes(playerId)) {
    return fail("Outgoing player is not on your roster.");
  }

  const working = ensureAiTradeBlocks(loaded.state);
  const candidates = findTrades(working, {
    direction: "move",
    teamId,
    asset: { kind: "player", playerId },
  }).filter((candidate) => {
    const evalB = evaluateTradeOffer(
      working,
      candidate.counterpartyTeamId,
      candidate.proposal,
    );
    return evalB.accepted;
  });

  return {
    ok: true,
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(loaded.state),
    candidates,
  };
}

export async function executeOwnerTrade(
  saveId: string,
  input: { outgoingPlayerId: string; proposal?: TradeProposal },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const teamId = loaded.state.user.activeOwnerTeamId;
  const playerId = asPlayerId(input.outgoingPlayerId);
  const team = loaded.state.world.teams[teamId];
  if (!team?.roster.includes(playerId)) {
    return fail("Outgoing player is not on your roster.");
  }

  const rng = createSeededRng(loaded.state.meta.rngState);
  let working = ensureAiTradeBlocks(loaded.state);

  let proposal = input.proposal;
  if (proposal === undefined) {
    const candidates = findTrades(working, {
      direction: "move",
      teamId,
      asset: { kind: "player", playerId },
    });
    const accepted = candidates.find((candidate) => {
      const evalB = evaluateTradeOffer(
        working,
        candidate.counterpartyTeamId,
        candidate.proposal,
      );
      const evalA = evaluateTradeOffer(working, teamId, candidate.proposal);
      return evalB.accepted && evalA.accepted;
    });
    if (accepted === undefined) {
      // Fall back: try other roster players for an acceptable 1-for-1.
      for (const otherId of team.roster) {
        if (otherId === playerId) {
          continue;
        }
        const otherCandidates = findTrades(working, {
          direction: "move",
          teamId,
          asset: { kind: "player", playerId: otherId },
        });
        const hit = otherCandidates.find((candidate) => {
          const evalB = evaluateTradeOffer(
            working,
            candidate.counterpartyTeamId,
            candidate.proposal,
          );
          return evalB.accepted;
        });
        if (hit !== undefined) {
          proposal = hit.proposal;
          break;
        }
      }
    } else {
      proposal = accepted.proposal;
    }
    if (proposal === undefined) {
      return fail("No acceptable trade candidate found for that player.");
    }
  }

  if (
    proposal.sideA.teamId !== teamId &&
    proposal.sideB.teamId !== teamId
  ) {
    return fail("Trade proposal does not involve your team.");
  }

  const counterpartId =
    proposal.sideA.teamId === teamId
      ? proposal.sideB.teamId
      : proposal.sideA.teamId;
  const evaluation = evaluateTradeOffer(working, counterpartId, proposal);
  if (!evaluation.accepted) {
    return fail("Counterpart rejected the trade proposal.");
  }

  const executed = executeTrade(working, proposal);
  if (!executed.success) {
    return fail(
      executed.validation.errors[0]?.message ?? "Trade validation failed.",
    );
  }

  const withEvidence = recordOwnershipEvidence(
    executed.state,
    scoreTradeDecision(working, proposal),
  );

  try {
    const saved = await persistWorkingState(
      saveId,
      withEvidence,
      rng.getState(),
      saveStore,
      executed.events,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Accept a pending owner trade offer. Idempotent if already resolved.
 */
export async function acceptOwnerDecision(
  saveId: string,
  decisionId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return resolveOwnerTradeDecision(saveId, decisionId, "accept", "owner", store);
}

/**
 * Decline a pending owner trade offer. Idempotent if already resolved.
 */
export async function declineOwnerDecision(
  saveId: string,
  decisionId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return resolveOwnerTradeDecision(saveId, decisionId, "decline", "owner", store);
}

/**
 * Ask AI to accept/decline using evaluateTradeOffer for the user team.
 */
export async function delegateOwnerDecisionToAi(
  saveId: string,
  decisionId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return resolveOwnerTradeDecision(
    saveId,
    decisionId,
    "ask_ai",
    "owner_ai",
    store,
  );
}

async function resolveOwnerTradeDecision(
  saveId: string,
  decisionIdRaw: string,
  mode: "accept" | "decline" | "ask_ai",
  decisionSource: "owner" | "owner_ai",
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const decisionId = asOwnerDecisionId(decisionIdRaw);
  const pending = loaded.state.user.pendingOwnerDecisions.find(
    (d) => d.id === decisionId,
  );
  if (!pending) {
    if (
      loaded.state.user.ownerDecisionHistory.some((r) => r.id === decisionId)
    ) {
      return withDashboard(loaded);
    }
    return fail("No matching pending owner decision.");
  }

  if (pending.type !== "trade_offer") {
    return fail("Unsupported owner decision type.");
  }

  const proposal =
    pending.payload.currentProposal ?? pending.payload.proposal;
  const evaluateAsTeamId = pending.payload.userTeamId;

  let working = loaded.state;
  const events: DomainEvent[] = [];
  let shouldExecute = false;
  let historyStatus: "accepted" | "declined" | "delegated";

  if (mode === "accept") {
    shouldExecute = true;
    historyStatus = "accepted";
  } else if (mode === "decline") {
    shouldExecute = false;
    historyStatus = "declined";
  } else {
    const evaluation = evaluateTradeOffer(
      working,
      evaluateAsTeamId,
      proposal,
    );
    shouldExecute = evaluation.accepted;
    historyStatus = "delegated";
  }

  if (shouldExecute) {
    const executed = executeTrade(working, proposal);
    if (!executed.success) {
      return fail(
        executed.validation.errors[0]?.message ?? "Trade validation failed.",
      );
    }
    working = recordOwnershipEvidence(
      executed.state,
      scoreTradeDecision(working, proposal),
    );
    events.push(...executed.events);
  }

  // Declines (owner or AI reject) get fingerprint cooldown via declined status.
  const resolveStatus =
    mode === "ask_ai" && !shouldExecute ? "declined" : historyStatus;

  const resolved = resolvePendingOwnerDecision(working, {
    decisionId,
    status: resolveStatus,
    decisionSource,
  });
  working = resolved.state;

  // Preserve "delegated" in history when Ask AI accepted (executed).
  // When Ask AI rejected we stored declined for cooldown; annotate source already set.

  try {
    const saved = await persistWorkingState(
      saveId,
      working,
      loaded.state.meta.rngState,
      saveStore,
      events,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Submit a user counteroffer against a pending CPU trade offer.
 * CPU Accept → execute. CPU Reject → declined. CPU Counter → stay negotiating.
 */
export async function submitTradeCounteroffer(
  saveId: string,
  decisionIdRaw: string,
  counterProposal: TradeProposal,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const decisionId = asOwnerDecisionId(decisionIdRaw);
  const pending = loaded.state.user.pendingOwnerDecisions.find(
    (d) => d.id === decisionId,
  );
  if (!pending || pending.type !== "trade_offer") {
    return fail("No matching pending trade offer.");
  }
  if (!loaded.state.user.ownedTeamIds.includes(pending.payload.userTeamId)) {
    return fail("Trade offer is not for an owned franchise.");
  }

  const validation = validateTrade(loaded.state, counterProposal);
  if (!validation.valid) {
    return fail(validation.errors[0]?.message ?? "Counteroffer is invalid.");
  }

  let working = loaded.state;
  const cpuEval = evaluateTradeOffer(
    working,
    pending.payload.offeringTeamId,
    counterProposal,
  );
  const events: DomainEvent[] = [];

  if (cpuEval.accepted || cpuEval.decisionAction === "accept") {
    const executed = executeTrade(working, counterProposal);
    if (!executed.success) {
      return fail(
        executed.validation.errors[0]?.message ?? "Trade validation failed.",
      );
    }
    working = recordOwnershipEvidence(
      executed.state,
      scoreTradeDecision(working, counterProposal),
    );
    events.push(...executed.events);
    const resolved = resolvePendingOwnerDecision(working, {
      decisionId,
      status: "accepted",
      decisionSource: "owner",
    });
    working = resolved.state;
  } else if (cpuEval.decisionAction === "counter") {
    // Simple CPU counter: keep original assets from CPU side, accept user's
    // outgoing set when still valid — otherwise reject.
    const original =
      pending.payload.originalProposal ?? pending.payload.proposal;
    const cpuSide =
      original.sideA.teamId === pending.payload.offeringTeamId
        ? original.sideA
        : original.sideB;
    const userSide =
      counterProposal.sideA.teamId === pending.payload.userTeamId
        ? counterProposal.sideA
        : counterProposal.sideB;
    const cpuCounter: TradeProposal = {
      sideA: {
        teamId: pending.payload.offeringTeamId,
        playerIds: [...cpuSide.playerIds],
        draftPickIds: [...cpuSide.draftPickIds],
      },
      sideB: {
        teamId: pending.payload.userTeamId,
        playerIds: [...userSide.playerIds],
        draftPickIds: [...userSide.draftPickIds],
      },
    };
    if (!validateTrade(working, cpuCounter).valid) {
      const resolved = resolvePendingOwnerDecision(
        applyTradeCounterofferState(
          working,
          decisionId,
          counterProposal,
          "rejected",
        ),
        {
          decisionId,
          status: "declined",
          decisionSource: "owner",
        },
      );
      working = resolved.state;
    } else {
      working = applyTradeCounterofferState(
        working,
        decisionId,
        counterProposal,
        "countered",
        cpuCounter,
      );
    }
  } else {
    // Rejected counter → negotiation ends as declined (no dead inbox offer).
    working = applyTradeCounterofferState(
      working,
      decisionId,
      counterProposal,
      "rejected",
    );
    const resolved = resolvePendingOwnerDecision(working, {
      decisionId,
      status: "declined",
      decisionSource: "owner",
    });
    working = resolved.state;
  }

  try {
    const saved = await persistWorkingState(
      saveId,
      working,
      loaded.state.meta.rngState,
      saveStore,
      events,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function signOwnerFreeAgent(
  saveId: string,
  input: { playerId: string; salary?: number; years?: number },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const state = loaded.state;
  const faBlock = getActionBlockReason(state, {
    kind: "sign_free_agent",
    playerId: asPlayerId(input.playerId),
    teamId: state.user.activeOwnerTeamId,
  });
  if (faBlock) {
    return fail(faBlock);
  }

  const playerId = asPlayerId(input.playerId);
  const teamId = state.user.activeOwnerTeamId;
  const year = state.competition.season.year;
  const pool = listFreeAgents(state);
  if (!pool.playerIds.includes(playerId)) {
    return fail("Player is not an available free agent.");
  }

  const salary = input.salary ?? 2_000_000;
  const years = input.years ?? 1;
  if (!Number.isInteger(years) || years < 1) {
    return fail("Contract years must be an integer >= 1.");
  }

  const endYear = year + years - 1;
  const salaryByYear: Record<string, number> = {};
  for (let y = year; y <= endYear; y += 1) {
    salaryByYear[String(y)] = salary;
  }

  const offerId = asOfferId(
    `offer_owner_${teamId}_${playerId}_${state.world.calendar.currentDate}`,
  );
  const contractId = asContractId(
    `contract_owner_${playerId}_${year}`,
  );
  const terms: ContractInput = {
    id: contractId,
    playerId,
    teamId,
    startYear: year,
    endYear,
    salaryByYear,
  };

  const rng = createSeededRng(state.meta.rngState);
  try {
    const offered = makeOffer(state, {
      id: offerId,
      playerId,
      teamId,
      terms,
    });
    const accepted = acceptOffer(offered.state, offerId);
    const withEvidence = recordOwnershipEvidence(
      accepted.state,
      scoreFreeAgentSigning(state, playerId, salary, years),
    );
    const saved = await persistWorkingState(
      saveId,
      withEvidence,
      rng.getState(),
      saveStore,
      [...offered.events, ...accepted.events],
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function finishFreeAgency(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  if (!isInLeaguePhase(loaded.state, "offseason.free_agency")) {
    return fail("Finish free agency requires offseason free_agency stage.");
  }

  const rng = createSeededRng(loaded.state.meta.rngState);
  try {
    const advanced = advanceLeaguePhase(loaded.state, rng);
    let working = advanced.state;
    const emitted = [...advanced.events];
    const dayResult = advanceSimulation(working, rng, { days: 1 });
    working = dayResult.state;
    emitted.push(...dayResult.events);

    if (isUserOnDraftClock(working)) {
      // Persist stopped at draft clock without requiring another advance.
    }

    working = processDerivedProjections(working, emitted);

    const saved = await persistWorkingState(
      saveId,
      working,
      rng.getState(),
      saveStore,
      emitted,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Advance the active league phase (user-controlled). Blocks on required tasks.
 */
export async function advanceLeaguePhaseCommand(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const preview = previewAdvance(loaded.state);
  if (!preview.canAdvance) {
    return fail(preview.blockReason ?? "Cannot advance phase.");
  }

  const rng = createSeededRng(loaded.state.meta.rngState);
  try {
    const advanced = advanceLeaguePhase(loaded.state, rng);
    const saved = await persistWorkingState(
      saveId,
      advanced.state,
      rng.getState(),
      saveStore,
      advanced.events,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Dismiss a recommended/optional phase task until the end of the current phase.
 */
export async function dismissPhaseTask(
  saveId: string,
  taskKey: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  if (typeof taskKey !== "string" || taskKey.length === 0) {
    return fail("taskKey is required.");
  }

  const teamId = loaded.state.user.activeOwnerTeamId;
  const phaseId = getActivePhaseId(loaded.state);
  const existing = loaded.state.user.franchisePhaseState?.[teamId] ?? {
    dismissed: [],
  };
  const nextState: GameState = {
    ...loaded.state,
    user: {
      ...loaded.state.user,
      franchisePhaseState: {
        ...(loaded.state.user.franchisePhaseState ?? {}),
        [teamId]: {
          dismissed: [
            ...existing.dismissed.filter((entry) => entry.taskKey !== taskKey),
            {
              taskKey,
              dismissedUntil: "phase_end",
              dismissedAt: loaded.state.world.calendar.currentDate,
              phaseId,
            },
          ],
        },
      },
    },
  };

  const saved = await persistWorkingState(
    saveId,
    nextState,
    loaded.state.meta.rngState,
    saveStore,
    [],
  );
  return withDashboard(saved);
}

/**
 * Run AI continuity for the user franchise, then advance until the next phase.
 */
export async function letAiHandlePhaseAndAdvance(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  if (isUserAssistCompletelyOff(
    loaded.state.settings,
    getOwnedFranchiseAssistance(loaded.state),
  )) {
    return fail(
      "AI assistance is off. Delegate at least one responsibility in settings first.",
    );
  }

  const rng = createSeededRng(loaded.state.meta.rngState);
  try {
    const phaseKey = resolveSimulationPhaseKey(loaded.state);
    const continuity = runAiContinuity(loaded.state, rng, {
      forcePhase: `handoff:${phaseKey}`,
    });
    let working = continuity.state;
    const emitted = [...continuity.events];

    if (isInLeaguePhase(working, "offseason.free_agency")) {
      const advanced = advanceLeaguePhase(working, rng);
      working = advanced.state;
      emitted.push(...advanced.events);
    }

    const dayResult = advanceSimulation(working, rng, {
      days: 400,
      stopOnPhaseChange: true,
    });
    working = dayResult.state;
    emitted.push(...dayResult.events);

    working = processDerivedProjections(working, emitted);

    const saved = await persistWorkingState(
      saveId,
      working,
      rng.getState(),
      saveStore,
      emitted,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Record that the user skipped unresolved phase decisions, then advance.
 */
export async function continuePastPhaseAnyway(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const phaseKey = resolveSimulationPhaseKey(loaded.state);
  const today = loaded.state.world.calendar.currentDate;
  const activeTeamId = loaded.state.user.activeOwnerTeamId;
  let working: GameState = withOwnedFranchise(loaded.state, activeTeamId, (f) => ({
    ...f,
    phaseSkips: [
      ...f.phaseSkips,
      {
        phaseKey,
        skippedOn: today,
        reason: "User chose Continue Anyway",
      },
    ],
  }));

  const rng = createSeededRng(working.meta.rngState);
  try {
    if (isInLeaguePhase(working, "offseason.free_agency")) {
      const advanced = advanceLeaguePhase(working, rng);
      working = advanced.state;
    }

    const dayResult = advanceSimulation(working, rng, {
      days: 400,
      stopOnPhaseChange: true,
    });
    working = dayResult.state;

    working = processDerivedProjections(working, dayResult.events);

    const saved = await persistWorkingState(
      saveId,
      working,
      rng.getState(),
      saveStore,
      dayResult.events,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Player-paced Season Review → offseason. Runs one simulation day so
 * season_transition auto-chains into roster_decisions.
 */
export async function beginOffseason(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  if (loaded.state.competition.season.phase !== "postseason") {
    return fail("Begin offseason requires the Season Review (postseason) phase.");
  }

  const rng = createSeededRng(loaded.state.meta.rngState);
  try {
    const entered = enterOffseasonFromPostseason(loaded.state);
    let working = entered.state;
    const emitted = [...entered.events];
    const dayResult = advanceSimulation(working, rng, { days: 1 });
    working = dayResult.state;
    emitted.push(...dayResult.events);

    working = processDerivedProjections(working, emitted);

    const saved = await persistWorkingState(
      saveId,
      working,
      rng.getState(),
      saveStore,
      emitted,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function selectOwnerDraftProspect(
  saveId: string,
  prospectPlayerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  if (!isInLeaguePhase(loaded.state, "offseason.draft")) {
    return fail("Draft selection is only allowed during the draft stage.");
  }

  if (!isUserOnDraftClock(loaded.state)) {
    return fail("Your team is not on the draft clock.");
  }

  const slot = getActiveDraftOnClockSlot(loaded.state);
  if (slot === undefined) {
    return fail("No available draft slot.");
  }

  const draftYear = draftYearForSeason(loaded.state.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  const rng = createSeededRng(loaded.state.meta.rngState);

  try {
    const selection = makeDraftSelection(loaded.state, {
      draftClassId,
      draftPickId: slot.draftPickId,
      prospectPlayerId: asPlayerId(prospectPlayerId),
      teamId: loaded.state.user.activeOwnerTeamId,
    });
    if (!selection.success) {
      return fail(
        selection.validation.errors[0]?.message ?? "Draft selection invalid.",
      );
    }

    let working = recordOwnershipEvidence(
      selection.state,
      scoreDraftSelection(loaded.state),
    );
    const emitted: DomainEvent[] = [...selection.events];
    const ai = runAiTeamDecisions(working, rng);
    working = ai.state;
    emitted.push(...ai.events);

    if (!isUserOnDraftClock(working)) {
      const advanced = advanceSimulation(working, rng, {
        days: 1,
        stopOnPhaseChange: true,
      });
      working = advanced.state;
      emitted.push(...advanced.events);
      if (
        working.competition.season.offseasonStage === "draft" &&
        !isUserOnDraftClock(working)
      ) {
        const aiAgain = runAiTeamDecisions(working, rng);
        working = aiAgain.state;
        emitted.push(...aiAgain.events);
        if (!isUserOnDraftClock(working)) {
          const again = advanceSimulation(working, rng, {
            days: 1,
            stopOnPhaseChange: true,
          });
          working = again.state;
          emitted.push(...again.events);
        }
      }
    }

    working = processDerivedProjections(working, emitted);

    const saved = await persistWorkingState(
      saveId,
      working,
      rng.getState(),
      saveStore,
      emitted,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

async function mutateActiveFranchiseDraft(
  saveId: string,
  mutate: (state: GameState) => GameState,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  try {
    const next = mutate(loaded.state);
    const saved = await persistWorkingState(
      saveId,
      next,
      loaded.state.meta.rngState,
      saveStore,
      [],
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function assignOwnerScoutToProspect(
  saveId: string,
  prospectPlayerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return mutateActiveFranchiseDraft(saveId, (state) =>
    assignScoutToProspect(
      state,
      state.user.activeOwnerTeamId,
      asPlayerId(prospectPlayerId),
    ),
  store);
}

export async function assignOwnerPlayerToDevelopmentLeague(
  saveId: string,
  playerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const teamId = loaded.state.user.activeOwnerTeamId;
  const result = assignPlayerToDevelopmentLeague(
    loaded.state,
    asPlayerId(playerId),
    teamId,
  );
  if (!result.success) {
    return fail(result.errors[0] ?? "Cannot assign to Development League.");
  }
  const saved = await persistWorkingState(
    saveId,
    result.state,
    loaded.state.meta.rngState,
    saveStore,
    result.events,
  );
  return withDashboard(saved);
}

export async function recallOwnerPlayerFromDevelopmentLeague(
  saveId: string,
  playerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const teamId = loaded.state.user.activeOwnerTeamId;
  const result = recallPlayerFromDevelopmentLeague(
    loaded.state,
    asPlayerId(playerId),
    teamId,
  );
  if (!result.success) {
    return fail(result.errors[0] ?? "Cannot recall from Development League.");
  }
  const saved = await persistWorkingState(
    saveId,
    result.state,
    loaded.state.meta.rngState,
    saveStore,
    result.events,
  );
  return withDashboard(saved);
}

export async function scoutOwnerRegion(
  saveId: string,
  region: "domestic" | "international",
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return mutateActiveFranchiseDraft(saveId, (state) =>
    scoutRegionCoverage(state, state.user.activeOwnerTeamId, region),
  store);
}

export async function addOwnerDraftBoardProspect(
  saveId: string,
  prospectPlayerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return mutateActiveFranchiseDraft(saveId, (state) =>
    addToDraftBoard(
      state,
      state.user.activeOwnerTeamId,
      asPlayerId(prospectPlayerId),
    ),
  store);
}

export async function removeOwnerDraftBoardProspect(
  saveId: string,
  prospectPlayerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return mutateActiveFranchiseDraft(saveId, (state) =>
    removeFromDraftBoard(
      state,
      state.user.activeOwnerTeamId,
      asPlayerId(prospectPlayerId),
    ),
  store);
}

export async function toggleOwnerDraftBoardPriority(
  saveId: string,
  prospectPlayerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return mutateActiveFranchiseDraft(saveId, (state) =>
    toggleDraftBoardPriority(
      state,
      state.user.activeOwnerTeamId,
      asPlayerId(prospectPlayerId),
    ),
  store);
}

export async function interviewOwnerProspect(
  saveId: string,
  prospectPlayerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return mutateActiveFranchiseDraft(saveId, (state) =>
    conductProspectInterview(
      state,
      state.user.activeOwnerTeamId,
      asPlayerId(prospectPlayerId),
    ),
  store);
}

export async function makeOwnerFreeAgentOffer(
  saveId: string,
  input: { playerId: string; salary?: number; years?: number },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const state = loaded.state;
  if (!isInLeaguePhase(state, "offseason.free_agency")) {
    return fail(
      "Free agent offers are only allowed during offseason free agency.",
    );
  }
  const playerId = asPlayerId(input.playerId);
  const teamId = state.user.activeOwnerTeamId;
  const year = state.competition.season.year;
  if (!listFreeAgents(state).playerIds.includes(playerId)) {
    return fail("Player is not an available free agent.");
  }
  const salary = input.salary ?? 2_000_000;
  const years = input.years ?? 1;
  if (!Number.isInteger(years) || years < 1) {
    return fail("Contract years must be an integer >= 1.");
  }
  const endYear = year + years - 1;
  const salaryByYear: Record<string, number> = {};
  for (let y = year; y <= endYear; y += 1) {
    salaryByYear[String(y)] = salary;
  }
  const offerId = asOfferId(
    `offer_owner_${teamId}_${playerId}_${state.world.calendar.currentDate}_${crypto.randomUUID()}`,
  );
  const contractId = asContractId(
    `contract_owner_${playerId}_${year}_${crypto.randomUUID()}`,
  );
  const terms: ContractInput = {
    id: contractId,
    playerId,
    teamId,
    startYear: year,
    endYear,
    salaryByYear,
  };
  const rng = createSeededRng(state.meta.rngState);
  try {
    const offered = makeOffer(state, { id: offerId, playerId, teamId, terms });
    const saved = await persistWorkingState(
      saveId,
      offered.state,
      rng.getState(),
      saveStore,
      offered.events,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function withdrawOwnerFreeAgentOffer(
  saveId: string,
  offerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const typedOfferId = asOfferId(offerId);
  const offer = loaded.state.business.freeAgency.offers[typedOfferId];
  if (!offer) {
    return fail("Offer not found.");
  }
  if (offer.teamId !== loaded.state.user.activeOwnerTeamId) {
    return fail("Offer does not belong to your team.");
  }
  const rng = createSeededRng(loaded.state.meta.rngState);
  try {
    const withdrawn = withdrawOffer(loaded.state, typedOfferId);
    const saved = await persistWorkingState(
      saveId,
      withdrawn.state,
      rng.getState(),
      saveStore,
      withdrawn.events,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function markOwnerNotificationsRead(
  saveId: string,
  notificationIds?: string[],
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const idSet =
    notificationIds === undefined
      ? null
      : new Set(notificationIds.filter((id) => id.length > 0));
  let working = loaded.state;
  for (const teamId of getOwnedTeamIds(working)) {
    working = withOwnedFranchise(working, teamId, (franchise) => ({
      ...franchise,
      notifications: franchise.notifications.map((notification) => {
        if (idSet !== null && !idSet.has(notification.id)) {
          return notification;
        }
        if (notification.read) {
          return notification;
        }
        return { ...notification, read: true };
      }),
    }));
  }
  try {
    const saved = await persistWorkingState(
      saveId,
      working,
      loaded.state.meta.rngState,
      saveStore,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export type MediaStoryEntityView = {
  id: string;
  name: string;
  canOpen?: boolean;
  href?: string;
  abbreviation?: string;
};

export type MediaStoryView = {
  id: string;
  headline: string;
  summary: string;
  occurredOn: string;
  storyType: MediaStoryType;
  importance: ImportanceLevel;
  unread: boolean;
  gameId?: string;
  canOpenGame: boolean;
  players: MediaStoryEntityView[];
  teams: MediaStoryEntityView[];
};

export type SocialPostView = {
  id: string;
  occurredOn: string;
  authorType: SocialAuthorType;
  authorLabel: string;
  content: string;
  importance: ImportanceLevel;
  relatedMediaId?: string;
};

export type MediaFranchiseAttentionView = {
  mediaAttention: number;
  awareness: number;
  fanSentiment: number;
  reputation: number;
  demandWeighted: number | null;
};

export type MediaPageView = {
  saveId: string;
  tab: MediaHubTab;
  latestFilter: MediaLatestFilter;
  items: MediaStoryView[];
  socialPosts: SocialPostView[];
  unreadCount: number;
  franchiseAttention: MediaFranchiseAttentionView;
};

function resolveTeamHref(
  state: GameState,
  teamId: TeamId,
  saveId: string,
): string {
  if (teamId === state.user.activeOwnerTeamId) {
    return `/dashboard/${saveId}/team`;
  }
  if (isOwnedFranchise(state, teamId)) {
    return `/dashboard/${saveId}/teams`;
  }
  return `/dashboard/${saveId}/league`;
}

function toMediaStoryView(
  state: GameState,
  saveId: string,
  item: MediaItem,
): MediaStoryView {
  const readState = getActiveOwnedFranchise(state).mediaReadState ?? {};
  const players = (item.playerIds ?? []).map((playerId) => {
    const player = state.world.players[playerId];
    const name = player
      ? `${player.firstName} ${player.lastName}`
      : String(playerId);
    return {
      id: playerId,
      name,
      canOpen: isPlayerInOwnerScope(state, playerId),
    };
  });
  const teams = (item.teamIds ?? []).map((teamId) => {
    const team = state.world.teams[teamId];
    return {
      id: teamId,
      name: team ? `${team.city} ${team.name}` : String(teamId),
      abbreviation: team?.abbreviation,
      href: resolveTeamHref(state, teamId, saveId),
    };
  });
  const gameId = item.gameId ? String(item.gameId) : undefined;
  return {
    id: item.id,
    headline: item.headline,
    summary: item.summary,
    occurredOn: item.occurredOn,
    storyType: item.storyType,
    importance: item.importance,
    unread: isMediaUnread(item, readState),
    gameId,
    canOpenGame: gameId ? canOpenGameBoxScore(state, gameId) : false,
    players,
    teams,
  };
}

function toSocialPostView(post: SocialPost): SocialPostView {
  return {
    id: post.id,
    occurredOn: post.occurredOn,
    authorType: post.authorType,
    authorLabel: post.authorLabel,
    content: post.content,
    importance: post.importance,
    relatedMediaId: post.relatedMediaId,
  };
}

function matchesLatestFilter(
  item: MediaItem,
  filter: MediaLatestFilter,
): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "game") {
    return item.storyType === "game";
  }
  if (filter === "player") {
    return item.storyType === "player" || item.storyType === "injury";
  }
  // trends: high-signal league/player developments
  return (
    item.importance === "critical" ||
    item.importance === "high" ||
    item.storyType === "injury"
  );
}

function filterMediaItemsForTab(
  items: readonly MediaItem[],
  tab: MediaHubTab,
  latestFilter: MediaLatestFilter,
  activeTeamId: TeamId,
): MediaItem[] {
  if (tab === "social") {
    return [];
  }
  if (tab === "transactions") {
    return items.filter((item) => item.storyType === "transaction");
  }
  if (tab === "league") {
    return items.filter((item) => item.storyType === "league");
  }
  if (tab === "team") {
    return items.filter(
      (item) =>
        (item.teamIds?.includes(activeTeamId) ?? false) ||
        item.relevanceScore >= 40,
    );
  }
  // latest
  return items.filter((item) => matchesLatestFilter(item, latestFilter));
}

function parseMediaHubTab(raw: string | undefined): MediaHubTab {
  switch (raw) {
    case "team":
    case "transactions":
    case "league":
    case "social":
      return raw;
    default:
      return "latest";
  }
}

function parseMediaLatestFilter(raw: string | undefined): MediaLatestFilter {
  switch (raw) {
    case "game":
    case "player":
    case "trends":
      return raw;
    default:
      return "all";
  }
}

/**
 * Media Hub page model: tab-filtered stories, social posts, unread count,
 * and franchise attention stats for the active owned franchise.
 */
export async function loadMediaPageView(
  saveId: string,
  options: { tab?: string; filter?: string } = {},
  store?: SaveGameStore,
): Promise<MediaPageView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  const state = loaded.state;
  const franchise = getActiveOwnedFranchise(state);
  const mediaFeed = franchise.mediaFeed ?? { items: [] };
  const socialFeed = franchise.socialFeed ?? { posts: [] };
  const readState = franchise.mediaReadState ?? {};
  const tab = parseMediaHubTab(options.tab);
  const latestFilter = parseMediaLatestFilter(options.filter);
  const activeTeamId = state.user.activeOwnerTeamId;

  const filteredItems = filterMediaItemsForTab(
    mediaFeed.items,
    tab,
    latestFilter,
    activeTeamId,
  );
  const unreadCount = mediaFeed.items.filter((item) =>
    isMediaUnread(item, readState),
  ).length;

  const biz = toFranchiseBusinessView(state);
  const mediaContributor = biz.forecast.demandContributors.find(
    (c) => c.key === "mediaAttention",
  );

  return {
    saveId,
    tab,
    latestFilter,
    items: filteredItems.map((item) => toMediaStoryView(state, saveId, item)),
    socialPosts:
      tab === "social" ? socialFeed.posts.map(toSocialPostView) : [],
    unreadCount,
    franchiseAttention: {
      mediaAttention: biz.mediaAttention,
      awareness: biz.awareness,
      fanSentiment: biz.fanSentiment,
      reputation: biz.reputation,
      demandWeighted: mediaContributor ? mediaContributor.weighted : null,
    },
  };
}

/** Mark one Media Hub item read for the active owned franchise. */
export async function markMediaRead(
  saveId: string,
  mediaItemId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  if (!mediaItemId) {
    return fail("Media item id is required.");
  }
  const typedId = asMediaItemId(mediaItemId);
  const currentDate = loaded.state.world.calendar.currentDate;
  const working = withOwnedFranchise(
    loaded.state,
    loaded.state.user.activeOwnerTeamId,
    (franchise) => {
      const existing = franchise.mediaReadState?.[typedId] ?? {};
      if (existing.readAt) {
        return franchise;
      }
      return {
        ...franchise,
        mediaReadState: {
          ...(franchise.mediaReadState ?? {}),
          [typedId]: { ...existing, readAt: currentDate },
        },
      };
    },
  );
  try {
    const saved = await persistWorkingState(
      saveId,
      working,
      loaded.state.meta.rngState,
      saveStore,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/** Mark all Media Hub items read for the active owned franchise. */
export async function markAllMediaRead(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const currentDate = loaded.state.world.calendar.currentDate;
  const working = withOwnedFranchise(
    loaded.state,
    loaded.state.user.activeOwnerTeamId,
    (franchise) => {
      const items = franchise.mediaFeed?.items ?? [];
      if (items.length === 0) {
        return franchise;
      }
      const nextReadState = { ...(franchise.mediaReadState ?? {}) };
      let changed = false;
      for (const item of items) {
        const existing = nextReadState[item.id] ?? {};
        if (existing.readAt || existing.dismissedAt) {
          continue;
        }
        nextReadState[item.id] = { ...existing, readAt: currentDate };
        changed = true;
      }
      if (!changed) {
        return franchise;
      }
      return {
        ...franchise,
        mediaReadState: nextReadState,
      };
    },
  );
  try {
    const saved = await persistWorkingState(
      saveId,
      working,
      loaded.state.meta.rngState,
      saveStore,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function acknowledgeOwnerNarrativeSituation(
  saveId: string,
  situationId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      acknowledgeNarrativeSituationInState(
        state,
        asNarrativeSituationId(situationId),
      ),
    store,
  );
}

export async function resolveOwnerNarrativeSituation(
  saveId: string,
  situationId: string,
  actionId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      applyNarrativeAction(
        state,
        asNarrativeSituationId(situationId),
        actionId,
      ),
    store,
  );
}

export async function exerciseOwnerTeamOption(
  saveId: string,
  contractId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return applyOwnerContractOption(saveId, contractId, "exercise", store);
}

export async function declineOwnerTeamOption(
  saveId: string,
  contractId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return applyOwnerContractOption(saveId, contractId, "decline", store);
}

async function applyOwnerContractOption(
  saveId: string,
  contractId: string,
  action: "exercise" | "decline",
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const typedId = asContractId(contractId);
  const contract = loaded.state.business.contracts[typedId];
  if (!contract) {
    return fail("Contract not found.");
  }
  if (contract.teamId !== loaded.state.user.activeOwnerTeamId) {
    return fail("Contract does not belong to your team.");
  }
  if (contract.teamOption?.status !== "pending") {
    return fail("Contract has no pending team option.");
  }
  try {
    const nextContract =
      action === "exercise"
        ? exerciseTeamOption(contract)
        : declineTeamOption(contract);
    const working: GameState = {
      ...loaded.state,
      business: {
        ...loaded.state.business,
        contracts: {
          ...loaded.state.business.contracts,
          [typedId]: nextContract,
        },
      },
    };
    const saved = await persistWorkingState(
      saveId,
      working,
      loaded.state.meta.rngState,
      saveStore,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Ensures non-user teams have at least one surplus player on the trade block
 * so findTrades can discover 1-for-1 candidates. Pure working-copy mutation.
 */
function ensureAiTradeBlocks(state: GameState): GameState {
  let current = state;
  const teamIds = (Object.keys(current.world.teams) as TeamId[])
    .filter((teamId) => teamId !== current.user.activeOwnerTeamId)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const teamId of teamIds) {
    const block = getTradeBlock(current, teamId);
    if (block.assets.some((asset) => asset.kind === "player")) {
      continue;
    }
    const surplus = findSurplusPlayer(current, teamId);
    if (surplus === undefined) {
      continue;
    }
    current = addToTradeBlock(current, teamId, {
      kind: "player",
      playerId: surplus,
    }).state;
  }
  return current;
}

function findSurplusPlayer(
  state: GameState,
  teamId: TeamId,
): PlayerId | undefined {
  const team = state.world.teams[teamId];
  if (!team || team.roster.length === 0) {
    return undefined;
  }
  const counts = new Map<PlayerPosition, number>();
  for (const position of PLAYER_POSITIONS) {
    counts.set(position, 0);
  }
  for (const playerId of team.roster) {
    const player = state.world.players[playerId];
    if (!player) {
      continue;
    }
    counts.set(player.position, (counts.get(player.position) ?? 0) + 1);
  }
  let maxCount = 0;
  for (const count of counts.values()) {
    if (count > maxCount) {
      maxCount = count;
    }
  }
  if (maxCount <= 1) {
    // Still allow trading a low-overall player when no surplus position.
    const sorted = [...team.roster].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return sorted[sorted.length - 1];
  }
  const surplusPositions = PLAYER_POSITIONS.filter(
    (position) => (counts.get(position) ?? 0) === maxCount,
  );
  const candidates = team.roster
    .filter((playerId) => {
      const player = state.world.players[playerId];
      return player !== undefined && surplusPositions.includes(player.position);
    })
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return candidates[0];
}

async function runOwnerFranchiseCommand(
  saveId: string,
  mutate: (
    state: GameState,
    rng: Rng,
  ) => { state: GameState; events: DomainEvent[] },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const activeStore = getStore(store);
  const loaded = await activeStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  try {
    const rng = createSeededRng(loaded.state.meta.rngState);
    const result = mutate(loaded.state, rng);
    const persisted = await persistWorkingState(
      saveId,
      result.state,
      rng.getState(),
      activeStore,
      result.events,
    );
    return withDashboard(persisted);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function loadOwnerStaffDetail(
  saveId: string,
  staffId: string,
  store?: SaveGameStore,
): Promise<
  | (CreateGameResult & { staff: import("@/domain/entities/staff").Staff })
  | null
> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  const staff = loaded.state.world.staff[staffId];
  if (!staff) {
    return null;
  }
  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(loaded.state),
    staff,
  };
}

export async function hireOwnerStaff(
  saveId: string,
  staffId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      hireStaff(state, state.user.activeOwnerTeamId, asStaffId(staffId)),
    store,
  );
}

export async function fireOwnerStaff(
  saveId: string,
  staffId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      fireStaffWithBuyout(
        state,
        state.user.activeOwnerTeamId,
        asStaffId(staffId),
      ),
    store,
  );
}

export async function upgradeOwnerFacility(
  saveId: string,
  category: FacilityCategory,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => {
      const result = startFacilityUpgrade(
        state,
        state.user.activeOwnerTeamId,
        category,
      );
      return {
        state: recordOwnershipEvidence(
          result.state,
          scoreFacilityUpgrade(state, category),
        ),
        events: result.events,
      };
    },
    store,
  );
}

export async function setOwnerTicketPrice(
  saveId: string,
  ticketPrice: number,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      setTicketPrice(state, state.user.activeOwnerTeamId, ticketPrice),
    store,
  );
}

export async function setOwnerMarketingBudget(
  saveId: string,
  budget: number,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => {
      const teamId = state.user.activeOwnerTeamId;
      const previous =
        state.business.franchiseOps[teamId]?.marketing.budget ?? 0;
      const result = setMarketingBudget(state, teamId, budget);
      return {
        state: recordOwnershipEvidence(
          result.state,
          scoreMarketingBudgetChange(state, previous, budget),
        ),
        events: result.events,
      };
    },
    store,
  );
}

export async function scheduleOwnerGameDayPromotion(
  saveId: string,
  gameId: string,
  promotionId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      scheduleGameDayPromotion(
        state,
        state.user.activeOwnerTeamId,
        asGameId(gameId),
        promotionId,
      ),
    store,
  );
}

export async function cancelOwnerGameDayPromotion(
  saveId: string,
  gameId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      cancelGameDayPromotion(
        state,
        state.user.activeOwnerTeamId,
        asGameId(gameId),
      ),
    store,
  );
}

export async function changeOwnerGameDayPromotion(
  saveId: string,
  gameId: string,
  promotionId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      changeGameDayPromotion(
        state,
        state.user.activeOwnerTeamId,
        asGameId(gameId),
        promotionId,
      ),
    store,
  );
}

export type GameDayPromotionEventPageView = {
  gameId: string;
  date: string;
  opponentName: string;
  opponentAbbreviation: string;
  home: boolean;
  status: string;
  currentDate: string;
  businessFunds: number;
  committedSpend: number;
  availableCash: number;
  currentPromotion: {
    promotionId: string;
    name: string;
    status: string;
    costPaid: number;
    projected: {
      attendanceLow: number;
      attendanceHigh: number;
      netImpactLow: number;
      netImpactHigh: number;
    } | null;
    refundFractionIfCancelled: number;
  } | null;
  result: {
    promotionId: string;
    name: string;
    actualAttendance: number;
    baselineAttendance: number;
    attendanceDifference: number;
    eventCost: number;
    netFinancialImpact: number;
    projectedAttendanceLow: number;
    projectedAttendanceHigh: number;
    projectedNetImpactLow: number;
    projectedNetImpactHigh: number;
    fanResponse: string;
    underperformed: boolean;
    giveawaysDistributed?: number;
    giveawaysQuantity?: number;
    giveawaysSoldOut?: boolean;
    ticketRevenueDifference: number;
    merchRevenueDifference: number;
    concessionsRevenueDifference: number;
  } | null;
  catalog: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    cost: number;
    leadTimeDays: number;
    available: boolean;
    reason?: string;
    projected: {
      attendanceLow: number;
      attendanceHigh: number;
      netImpactLow: number;
      netImpactHigh: number;
      attendanceDifferenceMid: number;
    } | null;
  }>;
};

export async function loadOwnerGameDayPromotionEventView(
  saveId: string,
  gameId: string,
  store?: SaveGameStore,
): Promise<GameDayPromotionEventPageView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) return null;
  const state = loaded.state;
  const teamId = state.user.activeOwnerTeamId;
  const game = state.competition.games[gameId];
  if (!game) return null;
  if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) return null;

  const home = game.homeTeamId === teamId;
  const opponentId = home ? game.awayTeamId : game.homeTeamId;
  const opponent = state.world.teams[opponentId];
  const promoState = state.business.gameDayPromotionsByTeamId[teamId];
  const assignment = promoState?.assignments[gameId];
  const resultRow = promoState?.results[gameId];
  const currentDate = state.world.calendar.currentDate;
  const businessFunds = state.business.finances[teamId]?.businessFunds ?? 0;
  const committedSpend = promoState?.committedSpend ?? 0;

  let currentPromotion: GameDayPromotionEventPageView["currentPromotion"] = null;
  if (assignment && assignment.status !== "cancelled") {
    const def = getGameDayPromotionDefinition(assignment.promotionId);
    currentPromotion = {
      promotionId: assignment.promotionId,
      name: def?.name ?? assignment.promotionId,
      status: assignment.status,
      costPaid: assignment.costPaid,
      projected: assignment.projectedSnapshot
        ? {
            attendanceLow: assignment.projectedSnapshot.attendanceLow,
            attendanceHigh: assignment.projectedSnapshot.attendanceHigh,
            netImpactLow: assignment.projectedSnapshot.netImpactLow,
            netImpactHigh: assignment.projectedSnapshot.netImpactHigh,
          }
        : null,
      refundFractionIfCancelled: refundFractionForCancel(
        currentDate,
        game.date,
        def?.leadTimeDays ?? 7,
      ),
    };
  }

  let result: GameDayPromotionEventPageView["result"] = null;
  if (resultRow) {
    const def = getGameDayPromotionDefinition(resultRow.promotionId);
    result = {
      promotionId: resultRow.promotionId,
      name: def?.name ?? resultRow.promotionId,
      actualAttendance: resultRow.actualAttendance,
      baselineAttendance: resultRow.baselineAttendance,
      attendanceDifference: resultRow.attendanceDifference,
      eventCost: resultRow.eventCost,
      netFinancialImpact: resultRow.netFinancialImpact,
      projectedAttendanceLow: resultRow.projectedAttendanceLow,
      projectedAttendanceHigh: resultRow.projectedAttendanceHigh,
      projectedNetImpactLow: resultRow.projectedNetImpactLow,
      projectedNetImpactHigh: resultRow.projectedNetImpactHigh,
      fanResponse: resultRow.fanResponse,
      underperformed: resultRow.underperformed,
      giveawaysDistributed: resultRow.giveawaysDistributed,
      giveawaysQuantity: def?.quantityAvailable,
      giveawaysSoldOut: resultRow.giveawaysSoldOut,
      ticketRevenueDifference: resultRow.ticketRevenueDifference,
      merchRevenueDifference: resultRow.merchRevenueDifference,
      concessionsRevenueDifference: resultRow.concessionsRevenueDifference,
    };
  }

  const catalog = listGameDayPromotionDefinitions().map((definition) => {
    let available = home && game.status === "scheduled";
    let reason: string | undefined;
    const days = calendarDaysBetween(currentDate, game.date);
    if (!home) {
      available = false;
      reason = "Away games cannot host promotions.";
    } else if (game.status !== "scheduled") {
      available = false;
      reason = "Game is no longer open for scheduling.";
    } else if (days < definition.leadTimeDays) {
      available = false;
      reason = `Needs ${definition.leadTimeDays} days lead time.`;
    } else if (definition.cost > businessFunds) {
      available = false;
      reason = "Insufficient business funds.";
    } else if (
      (promoState?.usageByPromotionId[definition.id] ?? 0) >=
      definition.maxUsesPerSeason
    ) {
      available = false;
      reason = "Max uses reached this season.";
    }
    const projected =
      home && game.status === "scheduled"
        ? projectGameDayPromotion(state, teamId, game, definition.id)
        : null;
    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      category: definition.category,
      cost: definition.cost,
      leadTimeDays: definition.leadTimeDays,
      available,
      reason,
      projected: projected
        ? {
            attendanceLow: projected.attendanceLow,
            attendanceHigh: projected.attendanceHigh,
            netImpactLow: projected.netImpactLow,
            netImpactHigh: projected.netImpactHigh,
            attendanceDifferenceMid: projected.attendanceDifferenceMid,
          }
        : null,
    };
  });

  return {
    gameId,
    date: game.date,
    opponentName: opponent
      ? `${opponent.city} ${opponent.name}`
      : "Unknown",
    opponentAbbreviation: opponent?.abbreviation ?? "???",
    home,
    status: game.status,
    currentDate,
    businessFunds,
    committedSpend,
    availableCash: businessFunds,
    currentPromotion,
    result,
    catalog,
  };
}

export async function signOwnerSponsorship(
  saveId: string,
  input: {
    sponsorName: string;
    annualValue: number;
    years: number;
  },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(saveId, (state) => {
    const year = state.competition.season.year;
    const teamId = state.user.activeOwnerTeamId;
    return signSponsorship(state, teamId, {
      id: asSponsorshipId(`sponsor_${teamId}_${year}_${input.sponsorName}`),
      sponsorName: input.sponsorName,
      annualValue: input.annualValue,
      startYear: year,
      endYear: year + Math.max(1, input.years) - 1,
      reputationFloor: 30,
      playoffBonus: Math.round(input.annualValue * 0.1),
    });
  }, store);
}

export async function advanceOwnerRelocation(
  saveId: string,
  targetJson?: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(saveId, (state) => {
    const teamId = state.user.activeOwnerTeamId;
    const process = state.business.relocationByTeamId[teamId];
    const starting =
      process === undefined || process.stage === "none";
    if (starting) {
      const phase = state.competition.season.phase;
      if (phase !== "offseason" && phase !== "postseason") {
        throw new Error(
          "Relocation can only be started during Season Review or the offseason.",
        );
      }
      const assessment = assessRelocation(state, teamId);
      if (!assessment.canStart) {
        throw new Error(
          assessment.status === "blocked_tenure"
            ? "Relocation is blocked by franchise tenure or cooldown."
            : "Relocation is not a relevant strategic option for this franchise right now.",
        );
      }
    }
    const target = targetJson
      ? (JSON.parse(targetJson) as RelocationTarget)
      : undefined;
    return advanceRelocationStage(state, teamId, target);
  }, store);
}

export async function cancelOwnerRelocation(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => cancelRelocation(state, state.user.activeOwnerTeamId),
    store,
  );
}

export async function proposeOwnerExpansion(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(saveId, (state) => {
    const phase = state.competition.season.phase;
    if (phase !== "offseason" && phase !== "postseason") {
      throw new Error(
        "Expansion can only be proposed during Season Review or the offseason.",
      );
    }
    const assessment = assessExpansion(state);
    if (!assessment.canPropose || assessment.status === "in_progress") {
      if (assessment.status === "in_progress") {
        throw new Error("Expansion is already in progress.");
      }
      throw new Error(
        assessment.summaryReasons[0] ??
          "Expansion is not available given league readiness, markets, or capacity.",
      );
    }
    const divisionId = pickExpansionDivisionId(state);
    const division = state.world.divisions[divisionId]!;
    const destinations = assessment.marketOpportunity.destinations.slice(0, 4);
    if (destinations.length === 0) {
      throw new Error("proposeOwnerExpansion: no expansion markets available.");
    }
    return proposeExpansion(
      state,
      destinations.map((destination) => ({
        city: destination.city,
        name: destination.name,
        abbreviation: destination.abbreviation,
        marketSize: destination.marketSize,
        conferenceId: division.conferenceId,
        divisionId: division.id,
      })),
      EXPANSION_FEE_DEFAULT,
    );
  }, store);
}

export async function approveOwnerExpansion(
  saveId: string,
  candidateIndex: number,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => approveExpansion(state, candidateIndex),
    store,
  );
}

export async function runOwnerExpansionDraft(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state, rng) => runExpansionDraft(state, rng),
    store,
  );
}

export async function completeOwnerExpansion(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state, rng) => {
      const phase = state.competition.season.phase;
      if (phase !== "offseason" && phase !== "postseason") {
        throw new Error(
          "Expansion can only be completed during Season Review or the offseason.",
        );
      }
      return completeExpansion(state, rng);
    },
    store,
  );
}

export type TeamManagementView = CreateGameResult & {
  overview: ReturnType<typeof toTeamManagementOverview>;
  lineup: ReturnType<typeof toLineupView>;
  rotation: ReturnType<typeof toRotationView>;
  coaching: ReturnType<typeof toCoachingView>;
  injuries: ReturnType<typeof toInjuryReportView>;
  transactions: ReturnType<typeof toSeasonTransactionsView>;
  recommendation: ReturnType<typeof previewLineupRecommendation>;
};

export async function loadTeamManagementView(
  saveId: string,
  transactionQuery?: {
    scope?: "team" | "league";
    type?: string;
    sort?: string;
    page?: number;
  },
  store?: SaveGameStore,
): Promise<TeamManagementView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  const state = loaded.state;
  const scope =
    transactionQuery?.scope === "league" ? "league" : "team";
  const sort =
    transactionQuery?.sort === "oldest" ||
    transactionQuery?.sort === "type" ||
    transactionQuery?.sort === "team" ||
    transactionQuery?.sort === "player"
      ? transactionQuery.sort
      : "newest";
  const type =
    transactionQuery?.type && transactionQuery.type !== "all"
      ? (transactionQuery.type as Parameters<
          typeof toSeasonTransactionsView
        >[1]["type"])
      : "all";

  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(state),
    overview: toTeamManagementOverview(state),
    lineup: toLineupView(state),
    rotation: toRotationView(state),
    coaching: toCoachingView(state),
    injuries: toInjuryReportView(state),
    transactions: toSeasonTransactionsView(state, {
      scope,
      type,
      sort,
      page: transactionQuery?.page ?? 0,
      pageSize: 50,
    }),
    recommendation: previewLineupRecommendation(
      state,
      state.user.activeOwnerTeamId,
    ),
    navGroups: ownerNavGroupsForState(state),
  };
}

async function runTeamManagementMutation(
  saveId: string,
  mutate: (state: GameState) =>
    | { ok: true; state: GameState }
    | { ok: false; error: string },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const result = mutate(loaded.state);
  if (!result.ok) {
    return fail(result.error);
  }
  const saved = await persistWorkingState(
    saveId,
    result.state,
    loaded.state.meta.rngState,
    saveStore,
  );
  return withDashboard(saved);
}

export async function updateOwnerLineup(
  saveId: string,
  input: {
    teamId: string;
    startingLineup: Array<{ playerId: string; slot: string }>;
    bench: string[];
    inactive: string[];
  },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runTeamManagementMutation(
    saveId,
    (state) =>
      updateLineupCommand(state, {
        teamId: asTeamId(input.teamId),
        startingLineup: input.startingLineup.map((slot) => ({
          playerId: asPlayerId(slot.playerId),
          slot: slot.slot as "PG" | "SG" | "SF" | "PF" | "C",
        })),
        bench: input.bench.map((id) => asPlayerId(id)),
        inactive: input.inactive.map((id) => asPlayerId(id)),
      }),
    store,
  );
}

export async function updateOwnerRotation(
  saveId: string,
  input: {
    teamId: string;
    rotation: Array<{
      playerId: string;
      targetMinutes: number;
      minimumMinutes?: number;
      normalMaximumMinutes?: number;
      absoluteMaximumMinutes?: number;
      rotationPriority: number;
      rotationStatus: string;
      role: string;
      preferredPositions: string[];
      secondaryPositions?: string[];
      minutePriorityBias?: number;
      overrideMedicalRecommendation?: boolean;
    }>;
    rotationStyle?: string;
    rotationPhilosophy?: string;
    rotationDepth?: number;
    rotationPreset?: string;
    closingLineupPolicy?: string;
    closingLineupIds?: string[];
  },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runTeamManagementMutation(
    saveId,
    (state) =>
      updateRotationCommand(state, {
        teamId: asTeamId(input.teamId),
        rotation: input.rotation.map((entry) => ({
          playerId: asPlayerId(entry.playerId),
          targetMinutes: entry.targetMinutes,
          minimumMinutes: entry.minimumMinutes ?? 0,
          normalMaximumMinutes: entry.normalMaximumMinutes ?? 0,
          absoluteMaximumMinutes: entry.absoluteMaximumMinutes ?? 0,
          rotationPriority: entry.rotationPriority as 1 | 2 | 3 | 4 | 5,
          rotationStatus: entry.rotationStatus as
            | "active"
            | "inactive"
            | "emergency",
          role: entry.role as
            | "starter"
            | "sixth_man"
            | "rotation"
            | "bench"
            | "deep_bench"
            | "emergency",
          preferredPositions: entry.preferredPositions as Array<
            "PG" | "SG" | "SF" | "PF" | "C"
          >,
          secondaryPositions: (entry.secondaryPositions ?? []) as Array<
            "PG" | "SG" | "SF" | "PF" | "C"
          >,
          minutePriorityBias: (entry.minutePriorityBias ?? 0) as -1 | 0 | 1,
          overrideMedicalRecommendation:
            entry.overrideMedicalRecommendation === true,
        })),
        rotationStyle: input.rotationStyle as
          | "tight"
          | "balanced"
          | "deep"
          | undefined,
        rotationPhilosophy: input.rotationPhilosophy as
          | "deep"
          | "balanced"
          | "tight"
          | "star_heavy"
          | "development"
          | undefined,
        rotationDepth: input.rotationDepth,
        rotationPreset: input.rotationPreset as
          | "auto"
          | "balanced"
          | "star_heavy"
          | "deep"
          | "development"
          | "custom"
          | undefined,
        closingLineupPolicy: input.closingLineupPolicy as
          | "auto"
          | "best_five"
          | "starters"
          | "custom"
          | undefined,
        closingLineupIds: input.closingLineupIds?.map((id) => asPlayerId(id)),
      }),
    store,
  );
}

export async function optimizeOwnerRotation(
  saveId: string,
  input: {
    teamId: string;
    rotationPreset?: string;
    rotationPhilosophy?: string;
  },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runTeamManagementMutation(
    saveId,
    (state) =>
      optimizeRotationCommand(state, {
        teamId: asTeamId(input.teamId),
        rotationPreset: input.rotationPreset as
          | "auto"
          | "balanced"
          | "star_heavy"
          | "deep"
          | "development"
          | "custom"
          | undefined,
        rotationPhilosophy: input.rotationPhilosophy as
          | "deep"
          | "balanced"
          | "tight"
          | "star_heavy"
          | "development"
          | undefined,
      }),
    store,
  );
}

export async function applyOwnerLineupRecommendation(
  saveId: string,
  teamId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runTeamManagementMutation(
    saveId,
    (state) => applyLineupRecommendationCommand(state, asTeamId(teamId)),
    store,
  );
}

export async function updateOwnerCoachingPhilosophy(
  saveId: string,
  input: {
    teamId: string;
    pace: string;
    offensiveEmphasis: string;
    defensiveApproach: string;
  },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runTeamManagementMutation(
    saveId,
    (state) =>
      updateCoachingPhilosophyCommand(state, {
        teamId: asTeamId(input.teamId),
        philosophy: {
          pace: input.pace as "fast" | "balanced" | "halfCourt",
          offensiveEmphasis: input.offensiveEmphasis as
            | "threePointHeavy"
            | "balanced"
            | "inside",
          defensiveApproach: input.defensiveApproach as
            | "aggressive"
            | "balanced"
            | "conservative",
        },
      }),
    store,
  );
}

export async function applyOwnerCoachingPreset(
  saveId: string,
  input: { teamId: string; presetId: string },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runTeamManagementMutation(
    saveId,
    (state) =>
      applyCoachingPresetCommand(state, {
        teamId: asTeamId(input.teamId),
        presetId: input.presetId as Parameters<
          typeof applyCoachingPresetCommand
        >[1]["presetId"],
      }),
    store,
  );
}

// ── Fantasy draft ──────────────────────────────────────────────────────────

export async function loadFantasyDraftView(
  saveId: string,
  store?: SaveGameStore,
): Promise<{ save: SaveGameSummary; draft: FantasyDraftView } | null> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return null;
  }
  const draft = toFantasyDraftView(loaded.state);
  if (!draft) {
    return null;
  }
  return { save: toSaveSummary(loaded), draft };
}

export async function loadFantasyDraftPlayerDetail(
  saveId: string,
  playerId: string,
  store?: SaveGameStore,
): Promise<FantasyDraftPlayerDetailView | null> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return null;
  }
  return toFantasyDraftPlayerDetailView(loaded.state, playerId);
}

export async function loadFantasyDraftSummaryView(
  saveId: string,
  store?: SaveGameStore,
): Promise<{
  save: SaveGameSummary;
  summary: NonNullable<ReturnType<typeof toFantasyDraftSummaryView>>;
} | null> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return null;
  }
  const summary = toFantasyDraftSummaryView(loaded.state);
  if (!summary) {
    return null;
  }
  return { save: toSaveSummary(loaded), summary };
}

async function mutateFantasyDraft(
  saveId: string,
  mutator: (
    state: GameState,
    rng: Rng,
    nowIso: string,
  ) => { state: GameState; events: DomainEvent[]; rngState?: number },
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const nowIso = new Date().toISOString();
  const rng = createSeededRng(loaded.state.meta.rngState);
  try {
    const result = mutator(loaded.state, rng, nowIso);
    const saved = await persistWorkingState(
      saveId,
      result.state,
      result.rngState ?? rng.getState(),
      saveStore,
      result.events,
    );
    return {
      ...withDashboard(saved),
      draft: toFantasyDraftView(saved.state, nowIso),
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function randomizeFantasyDraftOrder(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, rng) => ({
      state: randomizeDraftOrder(state, rng),
      events: [],
      rngState: rng.getState(),
    }),
    store,
  );
}

export async function initializeFantasyDraftOrder(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, rng) => {
      const draft = state.world.fantasyDraft;
      if (draft === null) {
        throw new Error("No fantasy draft.");
      }
      if (draft.draftOrder.length > 0) {
        return { state, events: [] };
      }
      if (draft.orderMode === "random") {
        return {
          state: randomizeDraftOrder(state, rng),
          events: [],
          rngState: rng.getState(),
        };
      }
      return { state: setDefaultDraftOrder(state), events: [] };
    },
    store,
  );
}

export async function reorderFantasyDraft(
  saveId: string,
  teamId: string,
  direction: -1 | 1,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state) => ({
      state: moveTeamInOrder(state, asTeamId(teamId), direction),
      events: [],
    }),
    store,
  );
}

export async function moveFantasyDraftTeamToIndex(
  saveId: string,
  teamId: string,
  toIndex: number,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state) => ({
      state: moveTeamToIndex(state, asTeamId(teamId), toIndex),
      events: [],
    }),
    store,
  );
}

export async function swapFantasyDraftTeams(
  saveId: string,
  teamIdA: string,
  teamIdB: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state) => ({
      state: swapTeamsInOrder(
        state,
        asTeamId(teamIdA),
        asTeamId(teamIdB),
      ),
      events: [],
    }),
    store,
  );
}

export async function configureFantasyDraftSetup(
  saveId: string,
  input: {
    draftType: FantasyDraftType;
    timerSeconds: number | null;
    orderMode: "random" | "manual";
  },
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, rng) => {
      const draft = state.world.fantasyDraft;
      if (draft === null || draft.orderConfirmed) {
        throw new Error("Fantasy draft setup is locked.");
      }
      let next = withFantasyDraft(state, {
        ...draft,
        draftType: input.draftType,
        orderMode: input.orderMode,
        timer: {
          enabled: input.timerSeconds !== null && input.timerSeconds > 0,
          secondsPerPick:
            input.timerSeconds !== null && input.timerSeconds > 0
              ? input.timerSeconds
              : 0,
          pickStartedAt: null,
        },
      });
      next = {
        ...next,
        settings: {
          ...next.settings,
          draft: {
            ...next.settings.draft,
            type: input.draftType,
            timerSeconds: input.timerSeconds,
            orderMode: input.orderMode,
          },
        },
      };
      if (next.world.fantasyDraft!.draftOrder.length === 0) {
        next =
          input.orderMode === "random"
            ? randomizeDraftOrder(next, rng)
            : setDefaultDraftOrder(next);
      }
      return { state: next, events: [], rngState: rng.getState() };
    },
    store,
  );
}

export async function confirmFantasyDraftSetup(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, _rng, nowIso) => {
      let next = state;
      if (
        next.world.fantasyDraft &&
        next.world.fantasyDraft.draftOrder.length === 0
      ) {
        next = setDefaultDraftOrder(next);
      }
      next = confirmFantasyDraftOrder(next, nowIso);
      const advanced = advanceFantasyDraftClock(next, nowIso);
      return {
        state: advanced.state,
        events: advanced.events,
      };
    },
    store,
  );
}

export async function selectFantasyDraftPlayer(
  saveId: string,
  playerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, _rng, nowIso) => {
      const draft = state.world.fantasyDraft;
      if (draft === null || draft.status !== "active") {
        throw new Error("Fantasy draft is not active.");
      }
      const pick = getCurrentPick(state);
      if (pick === undefined) {
        throw new Error("No active pick.");
      }
      if (!state.user.ownedTeamIds.includes(pick.teamId)) {
        throw new Error("It is not your team's turn to draft.");
      }
      const selection = makeFantasyDraftSelection(state, {
        teamId: pick.teamId,
        playerId: asPlayerId(playerId),
        nowIso,
      });
      if (!selection.success) {
        throw new Error(
          selection.validation.errors[0]?.message ?? "Invalid pick.",
        );
      }
      const advanced = advanceFantasyDraftClock(selection.state, nowIso);
      return {
        state: advanced.state,
        events: [...selection.events, ...advanced.events],
      };
    },
    store,
  );
}

export async function toggleFantasyDraftAutoPick(
  saveId: string,
  teamId: string,
  enabled: boolean,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, _rng, nowIso) => {
      let next = setFantasyDraftAutoPick(state, asTeamId(teamId), enabled);
      const advanced = advanceFantasyDraftClock(next, nowIso);
      return { state: advanced.state, events: advanced.events };
    },
    store,
  );
}

export async function toggleFantasyDraftAutoPickAll(
  saveId: string,
  enabled: boolean,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, _rng, nowIso) => {
      let next = setFantasyDraftAutoPickAll(state, enabled);
      const advanced = advanceFantasyDraftClock(next, nowIso);
      return { state: advanced.state, events: advanced.events };
    },
    store,
  );
}

export async function pauseOwnerFantasyDraft(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, _rng, nowIso) => ({
      state: pauseFantasyDraft(state, nowIso),
      events: [],
    }),
    store,
  );
}

export async function resumeOwnerFantasyDraft(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, _rng, nowIso) => {
      let next = resumeFantasyDraft(state, nowIso);
      const advanced = advanceFantasyDraftClock(next, nowIso);
      return { state: advanced.state, events: advanced.events };
    },
    store,
  );
}

export async function undoOwnerFantasyDraftPick(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, _rng, nowIso) => {
      const result = undoLastFantasyDraftPick(state, nowIso);
      if (!result.success) {
        throw new Error(result.message ?? "Undo failed.");
      }
      return { state: result.state, events: result.events };
    },
    store,
  );
}

export async function addFantasyDraftQueuePlayer(
  saveId: string,
  teamId: string,
  playerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state) => ({
      state: addToFantasyDraftQueue(
        state,
        asTeamId(teamId),
        asPlayerId(playerId),
      ),
      events: [],
    }),
    store,
  );
}

export async function removeFantasyDraftQueuePlayer(
  saveId: string,
  teamId: string,
  playerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state) => ({
      state: removeFromFantasyDraftQueue(
        state,
        asTeamId(teamId),
        asPlayerId(playerId),
      ),
      events: [],
    }),
    store,
  );
}

export async function reorderFantasyDraftQueuePlayers(
  saveId: string,
  teamId: string,
  orderedPlayerIds: string[],
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state) => ({
      state: reorderFantasyDraftQueue(
        state,
        asTeamId(teamId),
        orderedPlayerIds.map((id) => asPlayerId(id)),
      ),
      events: [],
    }),
    store,
  );
}

export async function setOwnerFantasyDraftAutoPickStrategy(
  saveId: string,
  teamId: string,
  strategy: FantasyDraftAutoPickStrategy,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state) => ({
      state: setFantasyDraftAutoPickStrategy(
        state,
        asTeamId(teamId),
        strategy,
      ),
      events: [],
    }),
    store,
  );
}

export async function updateOwnerFantasyDraftSettings(
  saveId: string,
  settings: { confirmPicks?: boolean },
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state) => ({
      state: updateFantasyDraftSettings(state, settings),
      events: [],
    }),
    store,
  );
}

export async function advanceFantasyDraftUntilNextPick(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, _rng, nowIso) => {
      const advanced = advanceFantasyDraftUntilNextUserPick(state, nowIso);
      return { state: advanced.state, events: advanced.events };
    },
    store,
  );
}

export async function continueAfterFantasyDraft(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const draft = loaded.state.world.fantasyDraft;
  if (draft === null || draft.status !== "complete") {
    return fail("Fantasy draft is not complete.");
  }
  return withDashboard(loaded);
}

