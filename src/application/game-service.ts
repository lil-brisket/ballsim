import "server-only";

import type { ContractInput } from "@/domain/entities/contract";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { DomainEvent } from "@/domain/events";
import {
  asContractId,
  asOfferId,
  asPlayerId,
  asTeamId,
  type PlayerId,
  type TeamId,
} from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { validateGameState } from "@/persistence/validate-game-state";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";
import type {
  LoadedSaveGame,
  SaveGameStore,
  SaveGameSummary,
} from "@/persistence/save-game-store";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import {
  listTeamsForSelection,
  toDashboardSnapshot,
  toDraftBoardView,
  toFreeAgentViews,
  toRosterView,
  toStandingsView,
  type DashboardSnapshot,
  type DraftBoardView,
  type FreeAgentView,
  type RosterPlayerView,
  type StandingRowView,
  type TeamListEntry,
} from "@/state/selectors";
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
  draftBoard: DraftBoardView | null;
  tradeCandidates: TradeFinderCandidate[];
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
 */
async function persistWorkingState(
  saveId: string,
  working: GameState,
  rngState: number,
  store: SaveGameStore,
): Promise<LoadedSaveGame> {
  validateGameState(working);
  const nowIso = new Date().toISOString();
  const nextState: GameState = {
    ...working,
    meta: {
      ...working.meta,
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
    draftBoard: toDraftBoardView(state),
    tradeCandidates,
  };
}

export async function listOwnerSaves(
  store?: SaveGameStore,
): Promise<SaveGameSummary[]> {
  return getStore(store).list();
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
    let working = makeOffer(state, {
      id: offerId,
      playerId,
      teamId,
      terms,
    }).state;
    working = acceptOffer(working, offerId).state;
    const saved = await persistWorkingState(
      saveId,
      working,
      rng.getState(),
      saveStore,
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
    // Enter draft stage processing so create/activate runs on next advance —
    // also run one offseason lifecycle via advanceSimulation day 0 path:
    // Call advanceSimulation for 1 day after stage change so draft activates,
    // but only if user is not immediately on the clock after create/activate.
    let working = advanced.state;
    const dayResult = advanceSimulation(working, rng, { days: 1 });
    working = dayResult.state;

    if (isUserOnDraftClock(working)) {
      // Persist stopped at draft clock without requiring another advance.
    }

    const saved = await persistWorkingState(
      saveId,
      working,
      rng.getState(),
      saveStore,
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
    // AI fills until user is on the clock again or draft completes.
    // Never selects for the user-controlled team.
    const ai = runAiTeamDecisions(working, rng);
    working = ai.state;

    // If draft order is fully used, advanceSimulation will auto-complete on next day.
    // Run lifecycle via a single advance day when user is not on the clock.
    if (!isUserOnDraftClock(working)) {
      const advanced = advanceSimulation(working, rng, {
        days: 1,
        stopOnPhaseChange: true,
      });
      working = advanced.state;
      // Continue AI after lifecycle create if still in draft and not on clock
      if (
        working.competition.season.offseasonStage === "draft" &&
        !isUserOnDraftClock(working)
      ) {
        working = runAiTeamDecisions(working, rng).state;
        if (!isUserOnDraftClock(working)) {
          const again = advanceSimulation(working, rng, {
            days: 1,
            stopOnPhaseChange: true,
          });
          working = again.state;
        }
      }
    }

    const saved = await persistWorkingState(
      saveId,
      working,
      rng.getState(),
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
