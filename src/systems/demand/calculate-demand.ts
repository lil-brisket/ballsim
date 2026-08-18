import { DEMAND_CONTRIBUTOR_WEIGHTS } from "@/systems/demand/demand-config";

export type TicketDemandInputs = {
  marketSize: number;
  fanSentiment: number;
  reputation: number;
  awareness: number;
  mediaAttention: number;
  leaguePopularity: number;
  /** Season win percentage 0–1. */
  winPct: number;
  /**
   * Fan facility level 1–5 mapped to 0–100.
   * Default when omitted: 0 (level 1 / no fan amenity boost).
   */
  fanFacility?: number;
  /**
   * Opponent win percentage 0–1 as attractiveness proxy.
   * Default when omitted: 0.5. Do not introduce a separate opponent popularity model.
   */
  opponentWinPct?: number;
};

export type DemandContribution = {
  raw: number;
  weighted: number;
};

export type TicketDemandResult = {
  score: number;
  contributions: Record<keyof typeof DEMAND_CONTRIBUTOR_WEIGHTS, DemandContribution>;
};

export type DemandExplanation = TicketDemandResult & {
  inputs: TicketDemandInputs;
};

export function explainTicketDemand(
  inputs: TicketDemandInputs,
): DemandExplanation {
  return { ...calculateTicketDemand(inputs), inputs };
}

function clampRating(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function winPctContribution(winPct: number): number {
  return clampRating(winPct * 100);
}

/** Facility level 1–5 → 0–100 demand raw (level 1 = 0). */
export function fanFacilityDemandRaw(level: number): number {
  const clamped = Math.max(1, Math.min(5, Math.round(level)));
  return ((clamped - 1) / 4) * 100;
}

/**
 * Pure ticket demand score 0–100 from franchise and league inputs.
 * Weights must sum to 1 (see DEMAND_CONTRIBUTOR_WEIGHTS).
 */
export function calculateTicketDemand(
  inputs: TicketDemandInputs,
): TicketDemandResult {
  const fanFacilityRaw =
    inputs.fanFacility !== undefined
      ? clampRating(inputs.fanFacility)
      : 0;
  const opponentRaw = winPctContribution(
    inputs.opponentWinPct !== undefined ? inputs.opponentWinPct : 0.5,
  );

  const normalized = {
    marketSize: clampRating(inputs.marketSize),
    fanSentiment: clampRating(inputs.fanSentiment),
    reputation: clampRating(inputs.reputation),
    awareness: clampRating(inputs.awareness),
    mediaAttention: clampRating(inputs.mediaAttention),
    leaguePopularity: clampRating(inputs.leaguePopularity),
    winPct: winPctContribution(inputs.winPct),
    fanFacility: fanFacilityRaw,
    opponentWinPct: opponentRaw,
  };

  const contributions = {} as TicketDemandResult["contributions"];
  let score = 0;

  for (const key of Object.keys(DEMAND_CONTRIBUTOR_WEIGHTS) as Array<
    keyof typeof DEMAND_CONTRIBUTOR_WEIGHTS
  >) {
    const weight = DEMAND_CONTRIBUTOR_WEIGHTS[key];
    const raw = normalized[key];
    const weighted = raw * weight;
    contributions[key] = { raw, weighted };
    score += weighted;
  }

  return {
    score: Math.round(clampRating(score)),
    contributions,
  };
}
