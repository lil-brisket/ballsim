import {
  DEMAND_PRICE_ELASTICITY,
  DEMAND_REFERENCE_TICKET_PRICE,
  MERCHANDISE_PER_ATTENDEE_BASE,
  MERCHANDISE_SENTIMENT_MAX,
  MERCHANDISE_SENTIMENT_MIN,
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

export function merchandiseFromAttendance(
  attendance: number,
  fanSentiment: number,
): number {
  if (attendance <= 0) {
    return 0;
  }
  const sentiment = Math.max(0, Math.min(100, fanSentiment));
  const sentimentFactor =
    MERCHANDISE_SENTIMENT_MIN +
    (sentiment / 100) * (MERCHANDISE_SENTIMENT_MAX - MERCHANDISE_SENTIMENT_MIN);
  return Math.round(attendance * MERCHANDISE_PER_ATTENDEE_BASE * sentimentFactor);
}
