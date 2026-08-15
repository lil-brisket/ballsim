import "server-only";

import type { ContractInput } from "@/domain/entities/contract";
import {
  declineTeamOption,
  exerciseTeamOption,
} from "@/domain/entities/contract";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { DomainEvent } from "@/domain/events";
import {
  asContractId,
  asOfferId,
  asPlayerId,
  asSponsorshipId,
  asStaffId,
  asTeamId,
  type PlayerId,
  type TeamId,
} from "@/domain/ids";
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
  isPlayerInOwnerScope,
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
  type ContractRowView,
  type DashboardSnapshot,
  type DraftBoardView,
  type EventLogEntryView,
  type FinancesView,
  type FreeAgencyOfferView,
  type FreeAgentView,
  type NotificationView,
  type ObjectiveView,
  type PlayerDetailView,
  type RosterPlayerView,
  type ScheduleGameView,
  type StandingRowView,
  type TeamListEntry,
} from "@/state/selectors";
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
import type { ExpansionState } from "@/domain/entities/expansion";
import type { LeagueEconomy } from "@/domain/entities/league-economy";
import type { RelocationProcess } from "@/domain/entities/relocation";
import { hireStaff, fireStaff } from "@/systems/staff";
import { startFacilityUpgrade } from "@/systems/facilities";
import type { FacilityCategory } from "@/domain/entities/franchise-ops";
import { setMarketingBudget } from "@/systems/marketing";
import { setTicketPrice } from "@/systems/ticket-pricing";
import {
  advanceRelocationStage,
  cancelRelocation,
} from "@/systems/relocation";
import type { RelocationTarget } from "@/domain/entities/relocation";
import { signSponsorship } from "@/systems/sponsorships";
import {
  approveExpansion,
  completeExpansion,
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
  acceptOffer,
  listFreeAgents,
  makeOffer,
  withdrawOffer,
} from "@/systems/free-agency";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { advanceOffseasonStage } from "@/systems/simulation/offseason-lifecycle";
import type { AdvanceSimulationResult } from "@/systems/simulation/types";
import {
  addToTradeBlock,
  evaluateTradeOffer,
  executeTrade,
  findTrades,
  getTradeBlock,
  type TradeFinderCandidate,
} from "@/systems/trades";
import { PLAYER_POSITIONS, type PlayerPosition } from "@/domain/entities/player";
import { bootstrapWorld } from "@/systems/world-pipeline";

export type CreateGameResult = {
  save: SaveGameSummary;
  dashboard: DashboardSnapshot;
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
  sponsorships: SponsorshipView[];
  leagueEconomy: LeagueEconomy;
  relocation: RelocationProcess;
  expansion: ExpansionState;
  franchiseHistory: FranchiseHistoryView;
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
  },
  store?: SaveGameStore,
): Promise<CreateGameResult> {
  const saveStore = getStore(store);
  const saveId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  let state = createInitialGameState({
    saveId,
    rngSeed: input.rngSeed,
    nowIso,
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

  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(loaded.state),
  };
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
  const teamId = state.user.controlledTeamId;
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
    sponsorships: toSponsorshipsView(state),
    leagueEconomy: toLeagueEconomyView(state),
    relocation: toRelocationView(state),
    expansion: toExpansionView(state),
    franchiseHistory: toFranchiseHistoryView(state),
  };
}

export async function loadOwnerPlayerView(
  saveId: string,
  playerId: string,
  store?: SaveGameStore,
): Promise<(CreateGameResult & { player: PlayerDetailView }) | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  const typedId = asPlayerId(playerId);
  if (!isPlayerInOwnerScope(loaded.state, typedId)) {
    return null;
  }
  const player = toPlayerDetailView(loaded.state, typedId);
  if (!player) {
    return null;
  }
  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(loaded.state),
    player,
  };
}

export async function listOwnerSaves(
  store?: SaveGameStore,
): Promise<SaveGameSummary[]> {
  return getStore(store).list();
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
    if (loaded.state.user.controlledTeamId === typedTeamId) {
      return withDashboard(loaded);
    }
    return fail(
      "Team selection is locked after the first time advance for this save.",
    );
  }

  if (loaded.state.user.controlledTeamId === typedTeamId) {
    return withDashboard(loaded);
  }

  const working: GameState = {
    ...loaded.state,
    user: {
      ...loaded.state.user,
      controlledTeamId: typedTeamId,
    },
  };

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

export async function advanceOwnerTime(
  saveId: string,
  options: { days?: number; stopOnPhaseChange?: boolean } = {},
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ events: DomainEvent[]; simulation: Omit<AdvanceSimulationResult, "state" | "events"> }>> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  if (isUserOnDraftClock(loaded.state)) {
    return fail(
      "Cannot advance time while your team is on the draft clock. Make a draft selection first.",
    );
  }

  const days = options.days ?? 1;
  const rng = createSeededRng(loaded.state.meta.rngState);

  try {
    const result = advanceSimulation(loaded.state, rng, {
      days,
      stopOnPhaseChange: options.stopOnPhaseChange,
    });

    // If draft clock became active after a day, still persist (lifecycle may have entered draft).
    // Further advances are blocked until the user picks.
    const saved = await persistWorkingState(
      saveId,
      result.state,
      rng.getState(),
      saveStore,
      result.events,
    );

    const { state: _state, events, ...simulation } = result;
    return {
      ...withDashboard(saved),
      events,
      simulation,
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
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
  const teamId = loaded.state.user.controlledTeamId;
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

  const teamId = loaded.state.user.controlledTeamId;
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

  try {
    const saved = await persistWorkingState(
      saveId,
      executed.state,
      rng.getState(),
      saveStore,
      executed.events,
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
  if (
    state.competition.season.phase !== "offseason" ||
    state.competition.season.offseasonStage !== "free_agency"
  ) {
    return fail(
      "Free agent signing is only allowed during offseason free agency.",
    );
  }

  const playerId = asPlayerId(input.playerId);
  const teamId = state.user.controlledTeamId;
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
    const saved = await persistWorkingState(
      saveId,
      accepted.state,
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

  if (
    loaded.state.competition.season.phase !== "offseason" ||
    loaded.state.competition.season.offseasonStage !== "free_agency"
  ) {
    return fail("Finish free agency requires offseason free_agency stage.");
  }

  const rng = createSeededRng(loaded.state.meta.rngState);
  try {
    const advanced = advanceOffseasonStage(loaded.state);
    let working = advanced.state;
    const emitted = [...advanced.events];
    const dayResult = advanceSimulation(working, rng, { days: 1 });
    working = dayResult.state;
    emitted.push(...dayResult.events);

    if (isUserOnDraftClock(working)) {
      // Persist stopped at draft clock without requiring another advance.
    }

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

  if (
    loaded.state.competition.season.phase !== "offseason" ||
    loaded.state.competition.season.offseasonStage !== "draft"
  ) {
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
      teamId: loaded.state.user.controlledTeamId,
    });
    if (!selection.success) {
      return fail(
        selection.validation.errors[0]?.message ?? "Draft selection invalid.",
      );
    }

    let working = selection.state;
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
  if (
    state.competition.season.phase !== "offseason" ||
    state.competition.season.offseasonStage !== "free_agency"
  ) {
    return fail(
      "Free agent offers are only allowed during offseason free agency.",
    );
  }
  const playerId = asPlayerId(input.playerId);
  const teamId = state.user.controlledTeamId;
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
  if (offer.teamId !== loaded.state.user.controlledTeamId) {
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
  const notifications = loaded.state.user.notifications.map((notification) => {
    if (idSet !== null && !idSet.has(notification.id)) {
      return notification;
    }
    if (notification.read) {
      return notification;
    }
    return { ...notification, read: true };
  });
  const working: GameState = {
    ...loaded.state,
    user: { ...loaded.state.user, notifications },
  };
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
  if (contract.teamId !== loaded.state.user.controlledTeamId) {
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
    .filter((teamId) => teamId !== current.user.controlledTeamId)
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

export async function hireOwnerStaff(
  saveId: string,
  staffId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      hireStaff(state, state.user.controlledTeamId, asStaffId(staffId)),
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
      fireStaff(state, state.user.controlledTeamId, asStaffId(staffId)),
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
    (state) =>
      startFacilityUpgrade(state, state.user.controlledTeamId, category),
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
      setTicketPrice(state, state.user.controlledTeamId, ticketPrice),
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
    (state) =>
      setMarketingBudget(state, state.user.controlledTeamId, budget),
    store,
  );
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
    const teamId = state.user.controlledTeamId;
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
    const target = targetJson
      ? (JSON.parse(targetJson) as RelocationTarget)
      : undefined;
    return advanceRelocationStage(state, state.user.controlledTeamId, target);
  }, store);
}

export async function cancelOwnerRelocation(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => cancelRelocation(state, state.user.controlledTeamId),
    store,
  );
}

export async function proposeOwnerExpansion(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(saveId, (state) => {
    const divisions = Object.values(state.world.divisions);
    const division = divisions[0];
    if (!division) {
      throw new Error("proposeOwnerExpansion: no divisions available.");
    }
    return proposeExpansion(state, [
      {
        city: "Summit",
        name: "Skyhawks",
        abbreviation: "SUM",
        marketSize: 58,
        conferenceId: division.conferenceId,
        divisionId: division.id,
      },
      {
        city: "Canyon",
        name: "Rattlers",
        abbreviation: "CAN",
        marketSize: 52,
        conferenceId: division.conferenceId,
        divisionId: division.id,
      },
    ]);
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
    (state, rng) => completeExpansion(state, rng),
    store,
  );
}
