import "server-only";
import {
  isOtherParticipantTeam,
  participantTeamAccessError,
} from "@/systems/participation";
import {
  counterPlayerTradeOffer,
  isPlayerTradeOffer,
  proposePlayerTrade,
} from "@/systems/player-trades";
import type {
  LoadedSaveGame,
  SaveGameStore,
} from "@/persistence/save-game-store";
import {
  asDraftPickId,
  asPlayerId,
  asOwnerDecisionId,
  type TeamId,
  type PlayerId,
} from "@/domain/ids";
import {
  addToTradeBlock,
  removeFromTradeBlock,
  findTrades,
  findTradeOffers,
  evaluateTradeOffer,
  executeTrade,
  validateTrade,
  rebalanceCpuCounterProposal,
} from "@/systems/trades";
import {
  type TradeFinderRowView,
  toTradeFinderRowViews,
} from "@/state/roster-page-selectors";
import { toDashboardSnapshot } from "@/state/selectors";
import {
  type TradeOfferView,
  toTradeOfferViews,
} from "@/state/trade-offer-selectors";
import { canTradeDraftPick } from "@/systems/league-rules";
import { TRADE_OFFER_MAX_ASSETS_PER_SIDE } from "@/systems/trades-config";
import type { TradeAssetRef } from "@/systems/trades/asset-valuation/types";
import {
  type TradeProposal,
  proposalSendsPlayer,
} from "@/domain/entities/trade-proposal";
import { createSeededRng } from "@/domain/rng";
import { recordOwnershipEvidence } from "@/systems/ownership-confidence-engine";
import { scoreTradeDecision } from "@/systems/ownership-alignment-signals";
import {
  type CalendarInterrupt,
  buildCalendarInterrupt,
  remainingResumeTo,
} from "@/state/calendar-interrupt";
import type { DomainEvent } from "@/domain/events";
import {
  resolvePendingOwnerDecision,
  applyTradeCounterofferState,
} from "@/systems/owner-decisions";
import type { GameState } from "@/state/game-state";
import type { OwnerCommandResult } from "@/application/game-service/types";
import {
  getStore,
  fail,
  persistWorkingState,
  withDashboard,
  ensureAiTradeBlocks,
  toSaveSummary,
} from "@/application/game-service/internal";

/**
 * Add or remove a roster player from the owner's trade block.
 * Persists; does not change roster membership.
 */
export async function setOwnerPlayerTradeBlock(
  saveId: string,
  input: { playerId: string; listed: boolean },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const playerId = asPlayerId(input.playerId);
  const teamId = loaded.state.user.activeOwnerTeamId;
  const team = loaded.state.world.teams[teamId];
  if (!team?.roster.includes(playerId)) {
    return fail("Player is not on your roster.");
  }

  try {
    const result = input.listed
      ? addToTradeBlock(loaded.state, teamId, { kind: "player", playerId })
      : removeFromTradeBlock(loaded.state, teamId, {
          kind: "player",
          playerId,
        });
    const saved = await persistWorkingState(
      saveId,
      result.state,
      loaded.state.meta.rngState,
      saveStore,
      result.events,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function listOwnerTradeCandidates(
  saveId: string,
  outgoingPlayerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ candidates: TradeFinderRowView[] }>> {
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

  // Working-copy preparation only — must not run inside roster page selectors.
  const working = ensureAiTradeBlocks(loaded.state);
  const raw = findTrades(working, {
    direction: "move",
    teamId,
    asset: { kind: "player", playerId },
  });
  const accepted = raw.filter((candidate) => {
    if (isOtherParticipantTeam(working, candidate.counterpartyTeamId)) {
      return false;
    }
    const evalB = evaluateTradeOffer(
      working,
      candidate.counterpartyTeamId,
      candidate.proposal,
    );
    return evalB.accepted;
  });

  const candidates = toTradeFinderRowViews(working, accepted, saveId).map(
    (row) => ({
      ...row,
      acceptedByCounterparty: true,
    }),
  );

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

  let proposal = input.proposal;
  if (proposal !== undefined) {
    if (!proposalSendsPlayer(proposal, teamId, playerId)) {
      return fail("Trade proposal does not send the selected player.");
    }
  } else {
    proposal = findAcceptedProposalForPlayer(
      ensureAiTradeBlocks(loaded.state),
      teamId,
      playerId,
    );
    if (proposal === undefined) {
      return fail("No acceptable trade candidate found for that player.");
    }
  }

  return commitOwnerTrade(saveId, loaded, proposal, saveStore);
}

export type OwnerTradeAssetInput = {
  kind: "player" | "draftPick";
  id: string;
};

/**
 * Trade Finder: the owner puts up 1–3 players/picks; every eligible CPU team
 * answers with its best acceptable package and an interest score.
 * Read-only — AI trade-block prep runs on a working copy and is not saved.
 */
export async function findOwnerTradeOffers(
  saveId: string,
  assets: readonly OwnerTradeAssetInput[],
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ offers: TradeOfferView[] }>> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const state = loaded.state;
  const teamId = state.user.activeOwnerTeamId;
  const parsed = parseOwnerTradeAssets(state, teamId, assets);
  if (!parsed.ok) {
    return fail(parsed.error);
  }

  const working = ensureAiTradeBlocks(state);
  const counterparties = (Object.keys(working.world.teams) as TeamId[]).filter(
    (id) => id !== teamId && !isOtherParticipantTeam(working, id),
  );
  const offers = findTradeOffers(
    working,
    teamId,
    parsed.assets,
    counterparties,
  );

  return {
    ok: true,
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(state),
    offers: toTradeOfferViews(working, offers),
  };
}

/**
 * Execute a Trade Finder offer. The owner may have edited the offer before
 * proposing it, so nothing is trusted from the client: re-checks the per-side
 * asset cap here; ownership, rules and CPU acceptance in commitOwnerTrade.
 */
export async function executeOwnerTradeOffer(
  saveId: string,
  proposal: TradeProposal,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  if (proposal.sideA.teamId !== loaded.state.user.activeOwnerTeamId) {
    return fail("Trade offer must send assets from your team.");
  }
  for (const side of [proposal.sideA, proposal.sideB]) {
    const count = side.playerIds.length + side.draftPickIds.length;
    if (count === 0 || count > TRADE_OFFER_MAX_ASSETS_PER_SIDE) {
      return fail(
        `Each side of a trade needs 1–${TRADE_OFFER_MAX_ASSETS_PER_SIDE} players or picks.`,
      );
    }
  }

  return commitOwnerTrade(saveId, loaded, proposal, saveStore);
}

function parseOwnerTradeAssets(
  state: GameState,
  teamId: TeamId,
  assets: readonly OwnerTradeAssetInput[],
): { ok: true; assets: TradeAssetRef[] } | { ok: false; error: string } {
  if (assets.length === 0 || assets.length > TRADE_OFFER_MAX_ASSETS_PER_SIDE) {
    return {
      ok: false,
      error: `Put up 1–${TRADE_OFFER_MAX_ASSETS_PER_SIDE} players or picks.`,
    };
  }
  const seen = new Set<string>();
  const parsed: TradeAssetRef[] = [];
  for (const asset of assets) {
    const key = `${asset.kind}:${asset.id}`;
    if (seen.has(key)) {
      return { ok: false, error: "The same asset was put up twice." };
    }
    seen.add(key);
    if (asset.kind === "player") {
      const playerId = asPlayerId(asset.id);
      if (!state.world.teams[teamId]?.roster.includes(playerId)) {
        return { ok: false, error: "Player is not on your roster." };
      }
      parsed.push({ kind: "player", playerId });
      continue;
    }
    const draftPickId = asDraftPickId(asset.id);
    if (state.world.draftPicks[draftPickId]?.ownerTeamId !== teamId) {
      return { ok: false, error: "You do not own that draft pick." };
    }
    const check = canTradeDraftPick(state, draftPickId);
    if (!check.allowed) {
      return {
        ok: false,
        error: check.violations[0]?.message ?? "Pick cannot be traded.",
      };
    }
    parsed.push({ kind: "draftPick", draftPickId });
  }
  return { ok: true, assets: parsed };
}

/**
 * Shared owner→CPU commit: counterparty acceptance, execution (which
 * re-validates ownership and league rules), ownership evidence, persist.
 */
async function commitOwnerTrade(
  saveId: string,
  loaded: LoadedSaveGame,
  proposal: TradeProposal,
  saveStore: SaveGameStore,
): Promise<OwnerCommandResult> {
  const teamId = loaded.state.user.activeOwnerTeamId;
  const rng = createSeededRng(loaded.state.meta.rngState);
  // Finder discovery only — never persist these surplus listings.
  const working = ensureAiTradeBlocks(loaded.state);

  const counterpartId =
    proposal.sideA.teamId === teamId
      ? proposal.sideB.teamId
      : proposal.sideA.teamId;
  if (isOtherParticipantTeam(working, counterpartId)) {
    return fail(
      "That franchise belongs to another player. Send them an offer from Propose to a player instead.",
    );
  }
  const evaluation = evaluateTradeOffer(working, counterpartId, proposal);
  if (!evaluation.accepted) {
    return fail("Counterpart rejected the trade proposal.");
  }

  const executed = executeTrade(loaded.state, proposal);
  if (!executed.success) {
    return fail(
      executed.validation.errors[0]?.message ?? "Trade validation failed.",
    );
  }

  const withEvidence = recordOwnershipEvidence(
    executed.state,
    scoreTradeDecision(loaded.state, proposal),
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
  return resolveOwnerTradeDecision(
    saveId,
    decisionId,
    "accept",
    "owner",
    store,
  );
}

/**
 * Decline a pending owner trade offer. Idempotent if already resolved.
 */
export async function declineOwnerDecision(
  saveId: string,
  decisionId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return resolveOwnerTradeDecision(
    saveId,
    decisionId,
    "decline",
    "owner",
    store,
  );
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

export type ResolveCalendarInterruptResult =
  | { ok: true; interrupt: CalendarInterrupt | null; resumeTo: string | null }
  | { ok: false; error: string };

/**
 * Resolve a Calendar trade interrupt and return the next interrupt (if any)
 * plus the leftover resume target. Idempotent when the decision is already
 * in history.
 */
export async function resolveCalendarTradeInterrupt(
  saveId: string,
  decisionId: string,
  mode: "accept" | "decline" | "let_ai_decide",
  resumeTo: string | null,
  store?: SaveGameStore,
): Promise<ResolveCalendarInterruptResult> {
  const result =
    mode === "accept"
      ? await acceptOwnerDecision(saveId, decisionId, store)
      : mode === "decline"
        ? await declineOwnerDecision(saveId, decisionId, store)
        : await delegateOwnerDecisionToAi(saveId, decisionId, store);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return { ok: false, error: "Save not found." };
  }
  return {
    ok: true,
    interrupt: buildCalendarInterrupt(loaded.state, saveId),
    resumeTo: remainingResumeTo(
      loaded.state.world.calendar.currentDate,
      resumeTo,
    ),
  };
}

/** Calendar href after a mutation that may still leave an interrupt pending. */
export async function calendarHrefAfterOwnerMutation(
  saveId: string,
  resumeTo: string | null,
  options: { autoResumeIfClear: boolean },
  store?: SaveGameStore,
): Promise<string | null> {
  if (!resumeTo || !/^\d{4}-\d{2}-\d{2}$/.test(resumeTo)) {
    return null;
  }
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  const leftover = remainingResumeTo(
    loaded.state.world.calendar.currentDate,
    resumeTo,
  );
  const params = new URLSearchParams();
  if (leftover) {
    params.set("resumeTo", leftover);
  }
  const interrupt = buildCalendarInterrupt(loaded.state, saveId);
  if (options.autoResumeIfClear && leftover && interrupt == null) {
    params.set("autoResume", "1");
  }
  const query = params.toString();
  return `/dashboard/${saveId}/calendar${query ? `?${query}` : ""}`;
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
  // The proposer of a player offer may withdraw it (decline their own offer).
  const withdrawing =
    mode === "decline" &&
    isPlayerTradeOffer(loaded.state, pending) &&
    participantTeamAccessError(loaded.state, pending.payload.offeringTeamId) ===
      null;
  const accessError = withdrawing
    ? null
    : participantTeamAccessError(loaded.state, pending.payload.userTeamId);
  if (accessError) {
    return fail(accessError);
  }

  const proposal = pending.payload.currentProposal ?? pending.payload.proposal;
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
    const evaluation = evaluateTradeOffer(working, evaluateAsTeamId, proposal);
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
  const accessError = participantTeamAccessError(
    loaded.state,
    pending.payload.userTeamId,
  );
  if (accessError) {
    return fail(accessError);
  }

  const validation = validateTrade(loaded.state, counterProposal);
  if (!validation.valid) {
    return fail(validation.errors[0]?.message ?? "Counteroffer is invalid.");
  }

  if (isPlayerTradeOffer(loaded.state, pending)) {
    // Another human made this offer: send the counter back to them instead
    // of letting the AI answer on their behalf.
    const countered = counterPlayerTradeOffer(
      loaded.state,
      pending,
      counterProposal,
    );
    if (!countered.ok) {
      return fail(countered.error);
    }
    try {
      const saved = await persistWorkingState(
        saveId,
        countered.state,
        loaded.state.meta.rngState,
        saveStore,
        [],
        { ifUpdatedAt: loaded.updatedAt },
      );
      return withDashboard(saved);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
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
    const cpuCounter = rebalanceCpuCounterProposal(
      working,
      pending.payload.offeringTeamId,
      pending.payload.userTeamId,
      cpuSide,
      userSide,
    );
    if (!cpuCounter || !validateTrade(working, cpuCounter).valid) {
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

function findAcceptedProposalForPlayer(
  working: GameState,
  teamId: TeamId,
  playerId: PlayerId,
): TradeProposal | undefined {
  const candidates = findTrades(working, {
    direction: "move",
    teamId,
    asset: { kind: "player", playerId },
  });
  const accepted = candidates.find((candidate) => {
    if (isOtherParticipantTeam(working, candidate.counterpartyTeamId)) {
      return false;
    }
    const evalB = evaluateTradeOffer(
      working,
      candidate.counterpartyTeamId,
      candidate.proposal,
    );
    const evalA = evaluateTradeOffer(working, teamId, candidate.proposal);
    return evalB.accepted && evalA.accepted;
  });
  return accepted?.proposal;
}

/**
 * Send a trade offer from the active participant to another participant's
 * franchise. It lands in their inbox; only they can accept it.
 */
export async function proposeTradeToParticipant(
  saveId: string,
  proposal: TradeProposal,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const proposed = proposePlayerTrade(loaded.state, proposal);
  if (!proposed.ok) {
    return fail(proposed.error);
  }
  try {
    const saved = await persistWorkingState(
      saveId,
      proposed.state,
      loaded.state.meta.rngState,
      saveStore,
      [],
      { ifUpdatedAt: loaded.updatedAt },
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}
