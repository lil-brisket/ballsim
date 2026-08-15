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

/**
 * Pure ticket demand score 0–100 from franchise and league inputs.
 */
export function calculateTicketDemand(
  inputs: TicketDemandInputs,
): TicketDemandResult {
  const normalized = {
    marketSize: clampRating(inputs.marketSize),
    fanSentiment: clampRating(inputs.fanSentiment),
    reputation: clampRating(inputs.reputation),
    awareness: clampRating(inputs.awareness),
    mediaAttention: clampRating(inputs.mediaAttention),
    leaguePopularity: clampRating(inputs.leaguePopularity),
    winPct: winPctContribution(inputs.winPct),
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
