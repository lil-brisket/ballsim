/**
 * Franchise era classifications (v1 taxonomy).
 */

export type FranchiseEraClassification =
  | "new_franchise"
  | "rebuilding"
  | "competitive_window"
  | "contender"
  | "golden_era"
  | "decline"
  | "financial_crisis"
  | "recovery";

export type EraStrength = "weak" | "moderate" | "strong";

export type EraDriver = {
  signal: string;
  value: number;
  description: string;
};

export type FranchiseEra = {
  classification: FranchiseEraClassification;
  label: string;
  confidence: number;
  strength: EraStrength;
  startSeasonYear: number;
  endSeasonYear: number | null;
  drivers: EraDriver[];
  explanation: string[];
  signals: Record<string, number>;
};

export type FranchiseEraTransition = {
  from: FranchiseEraClassification;
  to: FranchiseEraClassification;
  seasonYear: number;
  message: string;
  drivers: EraDriver[];
};

export const FRANCHISE_ERA_LABELS: Record<FranchiseEraClassification, string> = {
  new_franchise: "New Franchise",
  rebuilding: "Rebuilding",
  competitive_window: "Competitive Window",
  contender: "Contender",
  golden_era: "Golden Era",
  decline: "Decline",
  financial_crisis: "Financial Crisis",
  recovery: "Recovery",
};
