import type { DomainEvent } from "@/domain/events";
import type {
  NarrativeCategory,
  NarrativeEvidence,
  NarrativeMonthSnapshot,
  NarrativeSeverity,
  NarrativeSituationAction,
} from "@/domain/entities/narrative-situation";
import type { OwnerObjective } from "@/domain/entities/owner-objective";
import type { FinancialHealthState } from "@/systems/financial-health";
import type { TeamId } from "@/domain/ids";

export type NarrativeCadence =
  | "game"
  | "daily"
  | "weekly"
  | "monthly"
  | "offseason";

export type NarrativeDetectorKind = "situation" | "story";

export type DetectorCandidate = {
  detectorKey: string;
  kind: NarrativeDetectorKind;
  category: NarrativeCategory;
  stage: number;
  severity: NarrativeSeverity;
  /** Higher wins when selecting the day's story cap. */
  priorityHint: number;
  evidence: NarrativeEvidence;
  /** Presentation-only inputs; templates must not recompute thresholds. */
  templateContext: Record<string, number | boolean | string>;
  actions?: NarrativeSituationAction[];
  aggregateGroup?: "fan_demand" | "money_pressure";
  relatedTeamId?: TeamId;
  relatedObjectiveId?: string;
  relatedSponsorshipId?: string;
  relatedRivalTeamId?: TeamId;
  /** When true, resolve an existing active situation of this key. */
  resolve?: boolean;
};

export type ObjectiveGapView = {
  id: string;
  type: string;
  description: string;
  target: number | null;
  progress: number | null;
  gap: number | null;
  status: OwnerObjective["status"];
  category: OwnerObjective["category"];
};

export type LeagueRelativeView = {
  attendanceFillPct: number | null;
  leagueMeanFillPct: number | null;
  vsLeagueFillPct: number | null;
  ticketPrice: number;
  leagueMeanTicketPrice: number;
  vsLeagueTicketPricePct: number | null;
  payroll: number;
  leagueMeanPayroll: number;
  vsLeaguePayrollPct: number | null;
  facilityMean: number;
  leagueMedianFacility: number;
  vsLeagueFacility: number;
  franchiseValue: number;
  leagueMeanFranchiseValue: number;
  vsLeagueFranchiseValuePct: number | null;
  winPct: number;
  conferenceMeanWinPct: number;
  vsConferenceWinPct: number | null;
  mediaAttention: number;
  leagueMeanMedia: number;
  vsLeagueMedia: number | null;
};

export type NarrativeContext = {
  date: string;
  monthId: string;
  teamId: TeamId;
  cadence: NarrativeCadence;
  dayEvents: readonly DomainEvent[];
  /** Recent snapshots oldest → newest (controlled team). */
  snapshots: readonly NarrativeMonthSnapshot[];
  consecutiveAttendanceDeclineMonths: number;
  consecutiveAttendanceRiseMonths: number;
  attendanceDownPctVsPriorMonth: number | null;
  sentimentChangeVsPriorMonth: number | null;
  ticketMerchChangeVsPriorMonth: number | null;
  franchiseValueChangePctVsPriorMonth: number | null;
  currentFillPctEstimate: number | null;
  currentFanSentiment: number;
  currentMediaAttention: number;
  currentReputation: number;
  currentTicketPrice: number;
  currentMarketingBudget: number;
  currentCash: number;
  healthBand: FinancialHealthState;
  runwayWeeks: number | null;
  streakKind: "W" | "L" | "N";
  streakLength: number;
  wins: number;
  losses: number;
  winPct: number;
  playoffQualified: boolean;
  facilityMean: number;
  leagueRelative: LeagueRelativeView;
  objectives: ObjectiveGapView[];
  priorSeasonWins: number | null;
  priorSeasonLosses: number | null;
  priorSeasonPlayoff: string | null;
  leaguePopularity: number;
  leagueBroadcast: number;
  sponsorshipClimate: number;
  priorLeaguePopularity: number | null;
  /** Active situation detector keys (active | acknowledged | escalated). */
  openDetectorKeys: ReadonlySet<string>;
  openSituationStages: ReadonlyMap<string, number>;
  cooldowns: Readonly<Record<string, string>>;
  /** Milestone notification dedupe keys already present. */
  notificationDedupeKeys: ReadonlySet<string>;
};
