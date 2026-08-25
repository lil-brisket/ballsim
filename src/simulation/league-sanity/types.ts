/**
 * League sanity observation types — numeric snapshots only.
 * Must not import franchise-report, eras, milestones, narrative, or dashboard.
 */

import type { FinancialHealthState } from "@/systems/financial-health";

export type LeagueSanityTeamSeasonSnapshot = {
  simulationIndex: number;
  teamId: string;
  /** Stable key across expansion/relocation identity within a simulation. */
  teamKey: string;
  seasonYear: number;
  /** 0-based season index within the career. */
  seasonIndex: number;
  seasonsSinceFounding: number;
  wins: number;
  losses: number;
  winPct: number;
  leagueRank: number;
  playoff: boolean;
  playoffDepth: number;
  champion: boolean;
  cash: number;
  revenue: number;
  expenses: number;
  netIncome: number;
  payroll: number;
  franchiseValue: number;
  financialHealth: FinancialHealthState;
  insolvent: boolean;
  attendance: number | null;
  fillRate: number | null;
  ticketPrice: number;
  marketSize: number;
  marketingBudget: number;
  sponsorshipRevenue: number;
  meanFacilityLevel: number;
  meanRosterAge: number;
  youngSharePct: number;
  meanSalary: number;
  rosterStrength: number;
  reputation: number;
  fanSentiment: number;
  relocated: boolean;
  expansionTeam: boolean;
};

export type LeagueSanityConfig = {
  simulations: number;
  seasonsPerSimulation: number;
  seed: number;
};

export type TenureMetrics = {
  activeSeasons: ReturnType<
    typeof import("@/simulation/analytics").summarizeWithPercentiles
  >;
  seasonsUntilFirstInsolvency: ReturnType<
    typeof import("@/simulation/analytics").summarizeWithPercentiles
  >;
  seasonsInsolventMean: number;
  seasonsUntilRelocation: ReturnType<
    typeof import("@/simulation/analytics").summarizeWithPercentiles
  >;
  financialDistressRate: number;
  insolvencyRate: number;
  relocationRate: number;
  expansionRate: number;
  survivalThroughSimulation: number;
};

export type LeagueSanityWarning = {
  id: string;
  severity: "info" | "warning" | "critical";
  message: string;
  evidence: Record<string, number | string | null | boolean>;
};

export type LeagueSanityReportMetadata = {
  simulationSeed: number;
  simulationConfigHash: string;
  resultChecksum: string;
  simulations: number;
  seasonsPerSimulation: number;
  teamCount: number;
  schemaVersion: number;
  generatedAt: string;
};
