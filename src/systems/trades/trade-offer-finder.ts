import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { canTradeDraftPick } from "@/systems/league-rules";
import { gmTradeAcceptanceThreshold } from "@/systems/staff-effects";
import {
  TRADE_ACCEPTANCE_THRESHOLDS,
  TRADE_OFFER_INTEREST,
  TRADE_OFFER_MAX_ASSETS_PER_SIDE,
  TRADE_OFFER_MAX_EVALUATIONS_PER_TEAM,
  TRADE_OFFER_PACKAGE_WEIGHTS,
  TRADE_OFFER_POOL_PICKS,
  TRADE_OFFER_POOL_PLAYERS,
} from "@/systems/trades-config";
import { getBaseAssetValue } from "@/systems/trades/asset-valuation/base-asset-value";
import { evaluateTrade } from "@/systems/trades/asset-valuation/complete-trade-evaluation";
import { getTeamAssetValue } from "@/systems/trades/asset-valuation/team-asset-value";
import { getTradeDesirability } from "@/systems/trades/asset-valuation/trade-desirability";
import type { TradeAssetRef } from "@/systems/trades/asset-valuation/types";
import { evaluateTradeOffer } from "@/systems/trades/trade-evaluation";
import { validateTrade } from "@/systems/trades/trade-validation";

export type TradeOffer = {
  counterpartyTeamId: TeamId;
  /** sideA = offering (owner) team, sideB = counterparty. */
  proposal: TradeProposal;
  /** 0–100: how much the counterparty wants the assets put up. */
  interest: number;
};

/**
 * Upper bound of everything in makeTradeDecision that is not the additive
 * value difference: fit terms at their 0/1 extremes plus the variance band.
 * Packages whose value-only score falls below threshold − this can never be
 * accepted, so they are skipped without a full evaluation.
 */
const NON_VALUE_SCORE_SLACK =
  0.5 * 40 * TRADE_ACCEPTANCE_THRESHOLDS.rosterFitWeight +
  0.5 * 40 * TRADE_ACCEPTANCE_THRESHOLDS.strategicFitWeight +
  0.5 * 30 * TRADE_ACCEPTANCE_THRESHOLDS.financialWeight +
  TRADE_ACCEPTANCE_THRESHOLDS.varianceBand;

type PoolAsset = {
  asset: TradeAssetRef;
  /** Counterparty's own (team-specific) value — what it gives up. */
  cost: number;
  /** League-wide value — what the owner receives. */
  baseValue: number;
};

/**
 * Trade Finder offers: the owner puts up 1–3 assets and each counterparty
 * builds its most generous package (1–3 of its own assets) that its AI would
 * accept. Deterministic, no RNG; never executes.
 *
 * Returns at most one offer per counterparty, sorted by interest (desc) then
 * team id. Counterparties with no acceptable package are omitted.
 */
export function findTradeOffers(
  state: GameState,
  teamId: TeamId,
  outgoing: readonly TradeAssetRef[],
  counterpartyTeamIds: readonly TeamId[],
): TradeOffer[] {
  if (
    outgoing.length === 0 ||
    outgoing.length > TRADE_OFFER_MAX_ASSETS_PER_SIDE
  ) {
    return [];
  }

  const offers: TradeOffer[] = [];
  const sortedTeams = [...counterpartyTeamIds]
    .filter((id) => id !== teamId && state.world.teams[id] !== undefined)
    .sort(compareIds);

  for (const otherTeamId of sortedTeams) {
    const offer = buildOffer(state, teamId, outgoing, otherTeamId);
    if (offer !== null) {
      offers.push(offer);
    }
  }

  return offers.sort(
    (a, b) =>
      b.interest - a.interest ||
      compareIds(a.counterpartyTeamId, b.counterpartyTeamId),
  );
}

function buildOffer(
  state: GameState,
  teamId: TeamId,
  outgoing: readonly TradeAssetRef[],
  otherTeamId: TeamId,
): TradeOffer | null {
  const gift = evaluateTrade(
    state,
    otherTeamId,
    proposalFor(teamId, outgoing, otherTeamId, []),
  );
  const interest = interestScore(state, outgoing, gift);
  const threshold = gmTradeAcceptanceThreshold(state, otherTeamId);
  const minValueScore = threshold - NON_VALUE_SCORE_SLACK;

  const received = outgoing.map(
    (asset) => getTeamAssetValue(state, otherTeamId, asset).value,
  );
  const receivedPackageValue = packageValue(received);

  const pool = counterpartyPool(state, otherTeamId);
  const packages = combinations(pool, TRADE_OFFER_MAX_ASSETS_PER_SIDE)
    .filter((pkg) => {
      const costs = pkg.map((entry) => entry.cost);
      const cost = costs.reduce((sum, value) => sum + value, 0);
      const valueScore =
        (gift.receivedValue - cost) * TRADE_ACCEPTANCE_THRESHOLDS.valueWeight;
      return (
        valueScore >= minValueScore &&
        packageValue(costs) <= receivedPackageValue
      );
    })
    .map((pkg) => ({
      pkg,
      returnValue: packageValue(pkg.map((entry) => entry.baseValue)),
    }))
    .sort(
      (a, b) =>
        b.returnValue - a.returnValue ||
        a.pkg.length - b.pkg.length ||
        compareIds(packageKey(a.pkg), packageKey(b.pkg)),
    )
    .slice(0, TRADE_OFFER_MAX_EVALUATIONS_PER_TEAM);

  for (const { pkg } of packages) {
    const proposal = proposalFor(
      teamId,
      outgoing,
      otherTeamId,
      pkg.map((entry) => entry.asset),
    );
    if (!validateTrade(state, proposal).valid) {
      continue;
    }
    if (evaluateTradeOffer(state, otherTeamId, proposal).accepted) {
      return { counterpartyTeamId: otherTeamId, proposal, interest };
    }
  }
  return null;
}

/**
 * 0–100. Centered at 50 when the team values the package exactly at
 * league-wide value; team-specific need/posture premiums and fit move it.
 */
function interestScore(
  state: GameState,
  outgoing: readonly TradeAssetRef[],
  gift: ReturnType<typeof evaluateTrade>,
): number {
  const base = outgoing.reduce(
    (sum, asset) => sum + getBaseAssetValue(state, asset).value,
    0,
  );
  if (base <= 0) {
    return 0;
  }
  const t = TRADE_OFFER_INTEREST;
  const ratio = gift.receivedValue / base;
  const raw =
    50 +
    (ratio - 1) * t.valueRatioScale +
    (gift.rosterFit - 0.5) * t.rosterFitScale +
    (gift.strategicFit - 0.5) * t.strategicFitScale;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Assets the counterparty is willing to put in an offer: its most movable
 * players (trade-desirability "send") and its tradable picks.
 */
function counterpartyPool(state: GameState, teamId: TeamId): PoolAsset[] {
  const team = state.world.teams[teamId];
  if (!team) {
    return [];
  }

  const players = [...team.roster]
    .map((playerId) => {
      const asset: TradeAssetRef = { kind: "player", playerId };
      return {
        playerId,
        asset,
        willingness: getTradeDesirability(state, teamId, asset, "send").score,
      };
    })
    .filter((entry) => entry.willingness > 0)
    .sort(
      (a, b) =>
        b.willingness - a.willingness || compareIds(a.playerId, b.playerId),
    )
    .slice(0, TRADE_OFFER_POOL_PLAYERS)
    .map((entry) => entry.asset);

  const picks = Object.values(state.world.draftPicks)
    .filter(
      (pick) =>
        pick.ownerTeamId === teamId &&
        canTradeDraftPick(state, pick.id).allowed,
    )
    .sort(
      (a, b) =>
        a.seasonYear - b.seasonYear ||
        a.round - b.round ||
        compareIds(a.id, b.id),
    )
    .slice(0, TRADE_OFFER_POOL_PICKS)
    .map((pick): TradeAssetRef => ({
      kind: "draftPick",
      draftPickId: pick.id,
    }));

  return [...players, ...picks].map((asset) => ({
    asset,
    cost: getTeamAssetValue(state, teamId, asset).value,
    baseValue: getBaseAssetValue(state, asset).value,
  }));
}

/** Best asset counts fully; the rest by TRADE_OFFER_PACKAGE_WEIGHTS. */
function packageValue(values: readonly number[]): number {
  return [...values]
    .sort((a, b) => b - a)
    .reduce(
      (sum, value, index) =>
        sum + value * (TRADE_OFFER_PACKAGE_WEIGHTS[index] ?? 0),
      0,
    );
}

function combinations<T>(items: readonly T[], maxSize: number): T[][] {
  const result: T[][] = [];
  const walk = (start: number, current: T[]) => {
    if (current.length > 0) {
      result.push([...current]);
    }
    if (current.length === maxSize) {
      return;
    }
    for (let i = start; i < items.length; i += 1) {
      current.push(items[i]!);
      walk(i + 1, current);
      current.pop();
    }
  };
  walk(0, []);
  return result;
}

function proposalFor(
  teamId: TeamId,
  outgoing: readonly TradeAssetRef[],
  otherTeamId: TeamId,
  incoming: readonly TradeAssetRef[],
): TradeProposal {
  return {
    sideA: { teamId, ...splitAssets(outgoing) },
    sideB: { teamId: otherTeamId, ...splitAssets(incoming) },
  };
}

function splitAssets(assets: readonly TradeAssetRef[]): {
  playerIds: PlayerId[];
  draftPickIds: DraftPickId[];
} {
  return {
    playerIds: assets.flatMap((a) => (a.kind === "player" ? [a.playerId] : [])),
    draftPickIds: assets.flatMap((a) =>
      a.kind === "draftPick" ? [a.draftPickId] : [],
    ),
  };
}

function packageKey(pkg: readonly PoolAsset[]): string {
  return pkg
    .map((entry) =>
      entry.asset.kind === "player"
        ? `p:${entry.asset.playerId}`
        : `d:${entry.asset.draftPickId}`,
    )
    .join("|");
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
