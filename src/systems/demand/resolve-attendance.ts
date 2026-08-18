import type { EconomicCycle } from "@/domain/entities/league-economy";
import {
  CONCESSIONS_PER_ATTENDEE_BASE,
  CONCESSIONS_SENTIMENT_MAX,
  CONCESSIONS_SENTIMENT_MIN,
  CONSUMER_CYCLE_MULTIPLIER,
  DEMAND_PRICE_ELASTICITY,
  DEMAND_REFERENCE_TICKET_PRICE,
  MERCHANDISE_PER_ATTENDEE_BASE,
  MERCHANDISE_SENTIMENT_MAX,
  MERCHANDISE_SENTIMENT_MIN,
  PREMIUM_CAPACITY_FRACTION_BY_ARENA_LEVEL,
  PREMIUM_PRICE_ELASTICITY,
  PREMIUM_REFERENCE_TICKET_PRICE,
  STAR_MERCH_MAX,
  STAR_MERCH_MIN,
} from "@/systems/demand/demand-config";

/**
 * Converts demand score and ticket price into expected attendance capped by capacity.
 * Higher price vs reference reduces fill rate via elasticity.
 */
export function resolveAttendance(
  demandScore: number,
  ticketPrice: number,
  capacity: number,
): number {
  if (capacity <= 0) {
    return 0;
  }
  const price = Math.max(1, ticketPrice);
  const priceFactor = Math.pow(
    DEMAND_REFERENCE_TICKET_PRICE / price,
    DEMAND_PRICE_ELASTICITY,
  );
  const fillRate = Math.min(1, (demandScore / 100) * priceFactor);
  return Math.min(capacity, Math.round(capacity * fillRate));
}

/**
 * Apply consumer-cycle multiplier to a demand score (fill/merch/premium only).
 * Does not create money; clamp remains 0–100.
 */
export function applyConsumerCycleToDemandScore(
  demandScore: number,
  cycle: EconomicCycle,
): number {
  const mult = CONSUMER_CYCLE_MULTIPLIER[cycle];
  return Math.max(0, Math.min(100, Math.round(demandScore * mult)));
}

export function applyPlayoffDemandUplift(
  demandScore: number,
  uplift: number,
): number {
  return Math.max(0, Math.min(100, Math.round(demandScore * uplift)));
}

/**
 * Bounded star-power merchandise modifier from top roster overalls (0–99 scale).
 * averageTop3Overall 50 → ~1.0; 90 → near STAR_MERCH_MAX.
 */
export function starMerchandiseFactor(averageTopOverall: number): number {
  const clamped = Math.max(0, Math.min(99, averageTopOverall));
  const t = clamped / 99;
  return STAR_MERCH_MIN + t * (STAR_MERCH_MAX - STAR_MERCH_MIN);
}

export function merchandiseFromAttendance(
  attendance: number,
  fanSentiment: number,
  starFactor: number = 1,
): number {
  if (attendance <= 0) {
    return 0;
  }
  const sentiment = Math.max(0, Math.min(100, fanSentiment));
  const sentimentFactor =
    MERCHANDISE_SENTIMENT_MIN +
    (sentiment / 100) * (MERCHANDISE_SENTIMENT_MAX - MERCHANDISE_SENTIMENT_MIN);
  const boundedStar = Math.max(STAR_MERCH_MIN, Math.min(STAR_MERCH_MAX, starFactor));
  return Math.round(
    attendance * MERCHANDISE_PER_ATTENDEE_BASE * sentimentFactor * boundedStar,
  );
}

/**
 * Simple concessions: attendance × base spend × sentiment modifier.
 * Does not use a separate demand model.
 */
export function concessionsFromAttendance(
  attendance: number,
  fanSentiment: number,
): number {
  if (attendance <= 0) {
    return 0;
  }
  const sentiment = Math.max(0, Math.min(100, fanSentiment));
  const sentimentFactor =
    CONCESSIONS_SENTIMENT_MIN +
    (sentiment / 100) * (CONCESSIONS_SENTIMENT_MAX - CONCESSIONS_SENTIMENT_MIN);
  return Math.round(
    attendance * CONCESSIONS_PER_ATTENDEE_BASE * sentimentFactor,
  );
}

/** Game-day yield: (tickets + premium + merch + concessions) / attendance when > 0. */
export function revenuePerAttendee(
  attendance: number,
  ticketRevenue: number,
  merchRevenue: number,
  concessionsRevenue: number,
  premiumRevenue: number = 0,
): number | null {
  if (attendance <= 0) {
    return null;
  }
  return Math.round(
    (ticketRevenue + premiumRevenue + merchRevenue + concessionsRevenue) /
      attendance,
  );
}

export function premiumCapacityForArena(
  arenaCapacity: number,
  arenaLevel: number,
): number {
  const level = Math.max(1, Math.min(5, Math.round(arenaLevel)));
  const fraction = PREMIUM_CAPACITY_FRACTION_BY_ARENA_LEVEL[level] ?? 0.1;
  return Math.max(0, Math.floor(arenaCapacity * fraction));
}

/**
 * Premium occupancy from demand score and premium price, capped by premium capacity.
 * Lower elasticity than GA (corporate demand).
 */
export function resolvePremiumOccupancy(
  demandScore: number,
  premiumTicketPrice: number,
  premiumCapacity: number,
): number {
  if (premiumCapacity <= 0) {
    return 0;
  }
  const price = Math.max(1, premiumTicketPrice);
  const priceFactor = Math.pow(
    PREMIUM_REFERENCE_TICKET_PRICE / price,
    PREMIUM_PRICE_ELASTICITY,
  );
  // Corporate blend: treat demand as slightly softer than GA fill.
  const fillRate = Math.min(1, (demandScore / 100) * priceFactor * 0.95);
  return Math.min(premiumCapacity, Math.round(premiumCapacity * fillRate));
}

/**
 * Seat allocation: premium first, then GA against remaining bowl.
 * GA capacity = arenaCapacity − premiumOccupancy (unsold premium can fill as GA).
 * Invariant: premiumOccupancy + gaAttendance ≤ arenaCapacity.
 */
export function allocateGameDaySeats(params: {
  arenaCapacity: number;
  premiumCapacity: number;
  premiumOccupancy: number;
  gaDemandScore: number;
  gaTicketPrice: number;
}): {
  premiumOccupancy: number;
  gaCapacity: number;
  gaAttendance: number;
  totalOccupied: number;
} {
  const premiumOccupancy = Math.min(
    params.premiumCapacity,
    Math.max(0, params.premiumOccupancy),
  );
  const gaCapacity = Math.max(0, params.arenaCapacity - premiumOccupancy);
  const gaAttendance = resolveAttendance(
    params.gaDemandScore,
    params.gaTicketPrice,
    gaCapacity,
  );
  const totalOccupied = premiumOccupancy + gaAttendance;
  return {
    premiumOccupancy,
    gaCapacity,
    gaAttendance,
    totalOccupied: Math.min(params.arenaCapacity, totalOccupied),
  };
}
