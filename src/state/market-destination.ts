/**
 * Destination evaluation for relocation and expansion.
 * Exposes opportunity / risk / uncertainty — does NOT assume a fixed
 * attendance realization for a new market.
 */

import type { GameState } from "@/state/game-state";
import { MARKET_POTENTIAL_PER_POINT } from "@/state/franchise-value-config";
import {
  listUnoccupiedCatalogMarkets,
  type CatalogMarket,
} from "@/systems/market-catalog";

export type OpportunityBand = "very_high" | "high" | "moderate" | "low";
export type RiskBand = "high" | "moderate" | "low";

export type DestinationEvaluation = {
  city: string;
  name: string;
  abbreviation: string;
  marketSize: number;
  /** Size delta vs current franchise market (positive = larger). */
  marketSizeDelta: number;
  /** Structural potential dollars from market size alone (not predicted fill). */
  marketPotential: number;
  opportunity: OpportunityBand;
  risk: RiskBand;
  uncertainty: RiskBand;
  reasons: string[];
  /** Credible strategic improvement over remaining — not a higher immediate value requirement. */
  credibleImprovement: boolean;
};

function opportunityBand(sizeDelta: number, currentSize: number): OpportunityBand {
  if (sizeDelta >= 25 || (sizeDelta >= 15 && currentSize < 50)) {
    return "very_high";
  }
  if (sizeDelta >= 12) {
    return "high";
  }
  if (sizeDelta >= 4) {
    return "moderate";
  }
  return "low";
}

function riskBand(sizeDelta: number, candidateSize: number): RiskBand {
  const absJump = Math.abs(sizeDelta);
  if (absJump >= 25 || candidateSize >= 75) {
    return "high";
  }
  if (absJump >= 12 || candidateSize >= 60) {
    return "moderate";
  }
  return "low";
}

/**
 * Evaluate one catalog market relative to the franchise's current market.
 * Realization in the destination is uncertain — do not bake in DEFAULT fill.
 */
export function evaluateDestination(
  candidate: CatalogMarket,
  currentMarketSize: number,
  options: {
    currentRealization?: number;
    financialPressure?: boolean;
  } = {},
): DestinationEvaluation {
  const marketSizeDelta = candidate.marketSize - currentMarketSize;
  const marketPotential = candidate.marketSize * MARKET_POTENTIAL_PER_POINT;
  const opportunity = opportunityBand(marketSizeDelta, currentMarketSize);
  const risk = riskBand(marketSizeDelta, candidate.marketSize);
  const uncertainty = risk;

  const reasons: string[] = [];
  if (marketSizeDelta > 0) {
    reasons.push(
      `Larger market (+${marketSizeDelta} size points vs current ${currentMarketSize}).`,
    );
  } else if (marketSizeDelta < 0) {
    reasons.push(
      `Smaller market (${marketSizeDelta} size points vs current ${currentMarketSize}).`,
    );
  } else {
    reasons.push("Similar market size to the current city.");
  }

  const realization = options.currentRealization;
  if (realization !== undefined && realization < 0.7 && marketSizeDelta >= 0) {
    reasons.push(
      "Current attendance realization is soft — a move may unlock more of market potential.",
    );
  }
  if (options.financialPressure && marketSizeDelta > 0) {
    reasons.push("Financial pressure at home makes a stronger market strategically relevant.");
  }
  if (risk === "high") {
    reasons.push("Large size jump or major market entry carries high uncertainty.");
  }

  const credibleImprovement =
    marketSizeDelta > 0 ||
    (options.currentRealization !== undefined &&
      options.currentRealization < 0.65 &&
      marketSizeDelta >= -2) ||
    (options.financialPressure === true && marketSizeDelta >= 0);

  return {
    city: candidate.city,
    name: candidate.name,
    abbreviation: candidate.abbreviation,
    marketSize: candidate.marketSize,
    marketSizeDelta,
    marketPotential,
    opportunity,
    risk,
    uncertainty,
    reasons,
    credibleImprovement,
  };
}

/** Rank unoccupied catalog destinations for a franchise. */
export function rankRelocationDestinations(
  state: GameState,
  currentMarketSize: number,
  options: {
    currentRealization?: number;
    financialPressure?: boolean;
  } = {},
): DestinationEvaluation[] {
  const open = listUnoccupiedCatalogMarkets(state);
  const ranked = open.map((market) =>
    evaluateDestination(market, currentMarketSize, options),
  );
  ranked.sort((a, b) => {
    const oppRank = (band: OpportunityBand): number => {
      switch (band) {
        case "very_high":
          return 0;
        case "high":
          return 1;
        case "moderate":
          return 2;
        default:
          return 3;
      }
    };
    const oppDelta = oppRank(a.opportunity) - oppRank(b.opportunity);
    if (oppDelta !== 0) {
      return oppDelta;
    }
    const riskRank = (band: RiskBand): number => {
      switch (band) {
        case "low":
          return 0;
        case "moderate":
          return 1;
        default:
          return 2;
      }
    };
    const riskDelta = riskRank(a.risk) - riskRank(b.risk);
    if (riskDelta !== 0) {
      return riskDelta;
    }
    return b.marketSize - a.marketSize || a.city.localeCompare(b.city);
  });
  return ranked;
}

/** Rank unoccupied markets for expansion (no current franchise size). */
export function rankExpansionDestinations(
  state: GameState,
): DestinationEvaluation[] {
  const open = listUnoccupiedCatalogMarkets(state);
  // Use mid baseline so opportunity reflects absolute attractiveness.
  const baseline = 50;
  const ranked = open.map((market) => evaluateDestination(market, baseline));
  ranked.sort((a, b) => {
    if (b.marketSize !== a.marketSize) {
      return b.marketSize - a.marketSize;
    }
    return a.city.localeCompare(b.city);
  });
  return ranked;
}
