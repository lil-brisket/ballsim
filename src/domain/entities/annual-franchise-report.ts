/**
 * Immutable annual franchise report — interpretation snapshot, not live state.
 * Values are frozen at generation time so later formula changes do not rewrite history.
 */

import type { PlayoffResultSnapshot } from "@/domain/entities/franchise-history";
import type {
  FranchiseEraClassification,
  EraDriver,
  EraStrength,
} from "@/domain/entities/franchise-era";
import type { MilestoneResult } from "@/domain/entities/historical-milestone";
import type { FacilityCategory } from "@/domain/entities/franchise-ops";
import type { TeamId } from "@/domain/ids";

export type YoYMetric = {
  value: number;
  prior: number | null;
  delta: number | null;
  deltaPct: number | null;
};

export type TrajectoryArrow = "up" | "flat" | "down";

export type FranchiseTrajectorySection = {
  competitive: TrajectoryArrow;
  financial: TrajectoryArrow;
  commercial: TrajectoryArrow;
  organizational: TrajectoryArrow;
  brand: TrajectoryArrow;
  overall: "positive" | "neutral" | "negative";
};

export type AnnualFranchiseReport = {
  teamId: TeamId;
  seasonYear: number;
  /** ISO timestamp when this snapshot was frozen. */
  generatedAt: string;
  competitive: {
    wins: number;
    losses: number;
    winPct: YoYMetric;
    leagueRank: number | null;
    playoffResult: PlayoffResultSnapshot;
    championship: boolean;
    rosterStrength: YoYMetric;
  };
  financial: {
    startingCash: number;
    endingCash: YoYMetric;
    revenue: YoYMetric;
    expenses: YoYMetric;
    netIncome: YoYMetric;
    payroll: YoYMetric;
  };
  commercial: {
    attendance: YoYMetric;
    ticketPrice: YoYMetric;
    sponsorshipRevenue: YoYMetric;
  };
  organizational: {
    meanFacilityLevel: YoYMetric;
  };
  ownership: {
    patience: number;
    completedObjectives: number;
    failedObjectives: number;
    alignmentScore: number | null;
  };
  franchiseValue: {
    starting: number | null;
    ending: number;
    deltaPct: number | null;
    /** Frozen driver breakdown at generation time. */
    drivers: Record<string, number>;
    topPositiveDriver: string | null;
    topNegativeDriver: string | null;
  };
  facilityLevels: Record<FacilityCategory, number>;
  franchiseTrajectory: FranchiseTrajectorySection;
  historicalSignificance: MilestoneResult[];
  era: {
    classification: FranchiseEraClassification;
    label: string;
    confidence: number;
    strength: EraStrength;
    seasonIndex: number;
    totalSeasonsInEra: number;
    drivers: EraDriver[];
    explanation: string[];
  } | null;
  eraTransition: {
    occurred: boolean;
    from: FranchiseEraClassification | null;
    to: FranchiseEraClassification | null;
    message: string | null;
  };
  narrative: string;
};

export type FranchiseReportCache = Record<
  string,
  Record<string, AnnualFranchiseReport>
>;
