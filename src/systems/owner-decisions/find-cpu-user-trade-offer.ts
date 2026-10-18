import { addCalendarDays } from "@/domain/calendar-date";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { PlayerId, TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { getOwnedTeamIds, isOwnedFranchise } from "@/state/owner-context";
import {
  USER_TRADE_OFFER_MAX_CPU_PLAYERS,
  USER_TRADE_OFFER_MAX_USER_ASSETS,
  USER_TRADE_OFFER_MIN_DAYS_BETWEEN,
  USER_TRADE_OFFER_MIN_FAIRNESS,
  USER_TRADE_OFFER_SEASON_GRACE_DAYS,
  USER_TRADE_OFFER_TARGET_MIN_OVERALL,
} from "@/systems/owner-decisions/owner-decision-config";
import { isInterruptWorthyTradeOffer } from "@/systems/owner-decisions/trade-offer-quality";
import {
  countTradeOffersSince,
  enqueueTradeOfferForOwner,
  type EnqueueTradeOfferResult,
} from "@/systems/owner-decisions/enqueue-trade-offer";
import { TRADE_OFFER_DAILY_CAP } from "@/systems/trades-config";
import { evaluateTradeOffer } from "@/systems/trades/trade-evaluation";
import { calculateTradeNeeds } from "@/systems/trades/trade-needs";
import { validateTrade } from "@/systems/trades/trade-validation";
import { getBaseAssetValue } from "@/systems/trades/asset-valuation/base-asset-value";
import { getTeamAssetValue } from "@/systems/trades/asset-valuation/team-asset-value";
import {
  deriveMotivation,
  generateCpuTradeCandidates,
  type TradeMotivation,
} from "@/systems/trades/cpu-trade-generator";
import {
  shouldNotShopPlayer,
  wasRecentlyAcquired,
} from "@/systems/trades/asset-valuation/retention-priority";

/**
 * Why CPU → owner offers may not be made today, or null when they may.
 * Each offer pauses simulation, so offers are limited to the regular season
 * after an opening grace period (no interruption of a new league's first
 * sims or of offseason phases with their own decisions) and are spaced
 * USER_TRADE_OFFER_MIN_DAYS_BETWEEN days apart.
 */
export function cpuOfferClosedReason(
  state: GameState,
): "offer_season_window" | "offer_spacing" | null {
  const season = state.competition.season;
  const today = state.world.calendar.currentDate;
  if (
    season.phase !== "regular" ||
    season.regularSeasonStartDate == null ||
    today <
      addCalendarDays(
        season.regularSeasonStartDate,
        USER_TRADE_OFFER_SEASON_GRACE_DAYS,
      )
  ) {
    return "offer_season_window";
  }
  const spacingStart = addCalendarDays(
    today,
    -(USER_TRADE_OFFER_MIN_DAYS_BETWEEN - 1),
  );
  if (countTradeOffersSince(state, spacingStart) > 0) {
    return "offer_spacing";
  }
  return null;
}

/**
 * Budgeted search for a meaningful CPU → owned-franchise trade offer.
 * Tries each owned franchise as recipient (not only the active team).
 * Stops at the first CPU-accepted + interrupt-worthy valid proposal.
 */
export function tryEnqueueCpuToUserTradeOffer(
  state: GameState,
  cpuTeamId: TeamId,
): EnqueueTradeOfferResult {
  if (isOwnedFranchise(state, cpuTeamId)) {
    return {
      outcome: "rejected",
      state,
      reason: "cpu_team_is_owned",
    };
  }

  const today = state.world.calendar.currentDate;
  let enqueued = countTradeOffersSince(state, today);
  if (enqueued >= TRADE_OFFER_DAILY_CAP) {
    return { outcome: "skipped", state, reason: "daily_cap" };
  }
  const closed = cpuOfferClosedReason(state);
  if (closed !== null) {
    return { outcome: "skipped", state, reason: closed };
  }

  const owned = new Set(getOwnedTeamIds(state));
  const ranked = generateCpuTradeCandidates(state, cpuTeamId, {
    maxCandidates: 30,
    counterpartyFilter: (id) => owned.has(id),
  });

  for (const candidate of ranked) {
    if (enqueued >= TRADE_OFFER_DAILY_CAP) {
      return { outcome: "skipped", state, reason: "daily_cap" };
    }
    if (!validateTrade(state, candidate.proposal).valid) continue;
    const cpuEval = evaluateTradeOffer(state, cpuTeamId, candidate.proposal);
    if (!cpuEval.accepted) continue;
    if (
      !isInterruptWorthyTradeOffer(
        state,
        candidate.counterpartyTeamId,
        candidate.proposal,
        cpuEval,
      )
    ) {
      continue;
    }
    const result = enqueueTradeOfferForOwner(
      state,
      cpuTeamId,
      candidate.proposal,
      {
        targetOwnedTeamId: candidate.counterpartyTeamId,
        motivation: candidate.motivation,
      },
    );
    if (result.outcome === "queued") {
      enqueued += 1;
      return result;
    }
  }

  // The generator only reaches owned teams through their trade block or
  // league-elite players, so most owners would never hear from it. Ask for
  // their players directly.
  return targetedCpuUserSearch(state, cpuTeamId);
}

type TargetedOffer = {
  proposal: TradeProposal;
  userTeamId: TeamId;
  /** Owner's team-side value received minus value given. */
  ownerGain: number;
};

/**
 * The CPU team asks for an owned player at a position it needs, offering one
 * of its own shoppable players. Kept only when the CPU accepts it, it is fair
 * to the owner by the owner's own valuation, and it is worth interrupting for.
 * The best deal for the owner is queued first.
 */
function targetedCpuUserSearch(
  state: GameState,
  cpuTeamId: TeamId,
): EnqueueTradeOfferResult {
  const needs = calculateTradeNeeds(state, cpuTeamId).priorityPositions;
  if (needs.length === 0) {
    return { outcome: "rejected", state, reason: "no_cpu_need" };
  }
  const cpuPlayers = cpuOfferPlayers(state, cpuTeamId);
  if (cpuPlayers.length === 0) {
    return { outcome: "rejected", state, reason: "no_cpu_players" };
  }

  const offers: TargetedOffer[] = [];
  const ownedTeamIds = [...getOwnedTeamIds(state)].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  for (const userTeamId of ownedTeamIds) {
    for (const target of ownedTargets(state, userTeamId, needs)) {
      const ownerGives = getTeamAssetValue(state, userTeamId, {
        kind: "player",
        playerId: target,
      }).value;
      for (const give of cpuPlayers) {
        const proposal: TradeProposal = {
          sideA: { teamId: cpuTeamId, playerIds: [give], draftPickIds: [] },
          sideB: { teamId: userTeamId, playerIds: [target], draftPickIds: [] },
        };
        const ownerGets = getTeamAssetValue(state, userTeamId, {
          kind: "player",
          playerId: give,
        }).value;
        if (ownerGets < ownerGives * USER_TRADE_OFFER_MIN_FAIRNESS) continue;
        if (!validateTrade(state, proposal).valid) continue;
        const cpuEval = evaluateTradeOffer(state, cpuTeamId, proposal);
        if (!cpuEval.accepted) continue;
        if (
          !isInterruptWorthyTradeOffer(state, userTeamId, proposal, cpuEval)
        ) {
          continue;
        }
        offers.push({
          proposal,
          userTeamId,
          ownerGain: ownerGets - ownerGives,
        });
      }
    }
  }

  // Stable sort keeps search order (owned team, target, CPU player) on ties.
  offers.sort((a, b) => b.ownerGain - a.ownerGain);
  const motivation = deriveMotivation(state, cpuTeamId);
  for (const offer of offers) {
    const result = enqueueTradeOfferForOwner(state, cpuTeamId, offer.proposal, {
      targetOwnedTeamId: offer.userTeamId,
      motivation,
    });
    if (result.outcome === "queued") {
      return result;
    }
  }

  return {
    outcome: "rejected",
    state,
    reason: "no_interrupt_worthy_match",
  };
}

/** CPU players it is willing to move: shoppable, not just acquired, best first. */
function cpuOfferPlayers(state: GameState, teamId: TeamId): PlayerId[] {
  const team = state.world.teams[teamId];
  if (!team) return [];
  return byValueDesc(
    state,
    team.roster.filter(
      (playerId) =>
        !shouldNotShopPlayer(state, teamId, playerId) &&
        !wasRecentlyAcquired(state, playerId),
    ),
  ).slice(0, USER_TRADE_OFFER_MAX_CPU_PLAYERS);
}

/** Owned rotation players at the CPU team's need positions, best first. */
function ownedTargets(
  state: GameState,
  teamId: TeamId,
  needs: readonly string[],
): PlayerId[] {
  const team = state.world.teams[teamId];
  if (!team) return [];
  return byValueDesc(
    state,
    team.roster.filter((playerId) => {
      const player = state.world.players[playerId];
      if (!player || player.retired === true) return false;
      if (!needs.includes(player.position)) return false;
      return (
        calculatePlayerOverall(player.position, player.attributes) >=
        USER_TRADE_OFFER_TARGET_MIN_OVERALL
      );
    }),
  ).slice(0, USER_TRADE_OFFER_MAX_USER_ASSETS);
}

function byValueDesc(state: GameState, playerIds: PlayerId[]): PlayerId[] {
  return playerIds
    .map((playerId) => ({
      playerId,
      value: getBaseAssetValue(state, { kind: "player", playerId }).value,
    }))
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
    })
    .map((entry) => entry.playerId);
}

export type { TradeMotivation };
