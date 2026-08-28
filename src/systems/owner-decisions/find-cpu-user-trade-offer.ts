import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getOwnedTeamIds, isOwnedFranchise } from "@/state/owner-context";
import {
  USER_TRADE_OFFER_MAX_CPU_ASSETS,
  USER_TRADE_OFFER_MAX_USER_ASSETS,
} from "@/systems/owner-decisions/owner-decision-config";
import { isInterruptWorthyTradeOffer } from "@/systems/owner-decisions/trade-offer-quality";
import {
  enqueueTradeOfferForOwner,
  type EnqueueTradeOfferResult,
} from "@/systems/owner-decisions/enqueue-trade-offer";
import { evaluateTradeOffer } from "@/systems/trades/trade-evaluation";
import { getTradeBlock } from "@/systems/trades/trade-block";
import { validateTrade } from "@/systems/trades/trade-validation";

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

  const cpuAssets = topCpuSurplusAssets(state, cpuTeamId);
  if (cpuAssets.length === 0) {
    return {
      outcome: "rejected",
      state,
      reason: "no_cpu_surplus",
    };
  }

  for (const userTeamId of getOwnedTeamIds(state)) {
    const userAssets = topUserCandidateAssets(state, userTeamId);
    if (userAssets.length === 0) {
      continue;
    }

    for (const outgoing of cpuAssets) {
      for (const incoming of userAssets) {
        const proposal = buildOneForOne(
          cpuTeamId,
          outgoing,
          userTeamId,
          incoming,
        );
        if (!validateTrade(state, proposal).valid) {
          continue;
        }
        const cpuEval = evaluateTradeOffer(state, cpuTeamId, proposal);
        if (!cpuEval.accepted) {
          continue;
        }
        if (
          !isInterruptWorthyTradeOffer(state, userTeamId, proposal, cpuEval)
        ) {
          continue;
        }
        return enqueueTradeOfferForOwner(state, cpuTeamId, proposal, {
          targetOwnedTeamId: userTeamId,
        });
      }
    }
  }

  return {
    outcome: "rejected",
    state,
    reason: "no_interrupt_worthy_match",
  };
}

type AssetRef =
  | { kind: "player"; playerId: PlayerId }
  | { kind: "draftPick"; draftPickId: DraftPickId };

function topCpuSurplusAssets(
  state: GameState,
  teamId: TeamId,
): AssetRef[] {
  const block = getTradeBlock(state, teamId);
  const scored = block.assets.map((asset) => {
    if (asset.kind === "player") {
      const player = state.world.players[asset.playerId];
      const value = player
        ? calculatePlayerOverall(player.position, player.attributes)
        : 0;
      return {
        asset: {
          kind: "player" as const,
          playerId: asset.playerId,
        },
        value,
      };
    }
    const pick = state.world.draftPicks[asset.draftPickId];
    const value = pick ? (pick.round === 1 ? 80 : 50) : 0;
    return {
      asset: {
        kind: "draftPick" as const,
        draftPickId: asset.draftPickId,
      },
      value,
    };
  });

  scored.sort((a, b) => {
    if (b.value !== a.value) {
      return b.value - a.value;
    }
    const keyA =
      a.asset.kind === "player"
        ? `player:${a.asset.playerId}`
        : `pick:${a.asset.draftPickId}`;
    const keyB =
      b.asset.kind === "player"
        ? `player:${b.asset.playerId}`
        : `pick:${b.asset.draftPickId}`;
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });

  return scored.slice(0, USER_TRADE_OFFER_MAX_CPU_ASSETS).map((s) => s.asset);
}

function topUserCandidateAssets(
  state: GameState,
  teamId: TeamId,
): AssetRef[] {
  const team = state.world.teams[teamId];
  if (!team) {
    return [];
  }

  const scored = team.roster.map((playerId) => {
    const player = state.world.players[playerId];
    const value = player
      ? calculatePlayerOverall(player.position, player.attributes)
      : 0;
    return { playerId, value };
  });

  scored.sort((a, b) => {
    if (b.value !== a.value) {
      return b.value - a.value;
    }
    return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
  });

  // Prefer mid-roster value (avoid trading the absolute star and absolute scrap).
  const midStart = Math.min(
    2,
    Math.max(0, scored.length - USER_TRADE_OFFER_MAX_USER_ASSETS),
  );
  const preferred = scored.slice(
    midStart,
    midStart + USER_TRADE_OFFER_MAX_USER_ASSETS,
  );
  const pool =
    preferred.length >= USER_TRADE_OFFER_MAX_USER_ASSETS
      ? preferred
      : scored.slice(0, USER_TRADE_OFFER_MAX_USER_ASSETS);

  return pool.map((entry) => ({
    kind: "player" as const,
    playerId: entry.playerId,
  }));
}

function buildOneForOne(
  fromTeamId: TeamId,
  outgoing: AssetRef,
  toTeamId: TeamId,
  incoming: AssetRef,
): TradeProposal {
  return {
    sideA: {
      teamId: fromTeamId,
      playerIds: outgoing.kind === "player" ? [outgoing.playerId] : [],
      draftPickIds: outgoing.kind === "draftPick" ? [outgoing.draftPickId] : [],
    },
    sideB: {
      teamId: toTeamId,
      playerIds: incoming.kind === "player" ? [incoming.playerId] : [],
      draftPickIds: incoming.kind === "draftPick" ? [incoming.draftPickId] : [],
    },
  };
}
