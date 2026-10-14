import type {
  FranchiseStanding,
  FranchiseValueDriverKey,
} from "@/state/franchise-value";
import type { FinancialHealthState } from "@/systems/financial-health";
import type { FranchiseHealthView } from "@/state/franchise-health";
import {
  type ScheduleGameView,
  type ObjectiveView,
  type NotificationView,
  type EventLogEntryView,
  toDashboardSnapshot,
} from "@/state/selectors";
import type { OwnerCareerEvaluation } from "@/state/owner-career-evaluation";
import type { OwnershipConfidenceView } from "@/state/ownership-confidence-view";
import type { TeamBrandingView } from "@/state/team-branding-view";
import type { SimulationPhaseContext } from "@/systems/simulation/simulation-phase";
import type { PhaseResponsibility } from "@/systems/simulation/phase-responsibility";
import type { GameState } from "@/state/game-state";
import {
  type FranchiseBusinessView,
  type LastGameDayView,
  toStaffView,
  toFacilitiesView,
  toSponsorshipsView,
} from "@/state/franchise-selectors";
import { getFinancialStatement } from "@/systems/team-finances";

export type OwnerDashboardActionSeverity = "critical" | "warning" | "info";

export type OwnerDashboardMediaHeadline = {
  id: string;
  headline: string;
  summary: string;
  occurredOn: string;
  href: string;
  importance: string;
  unread: boolean;
};

export type OwnerDashboardNextEvent = {
  date: string;
  title: string;
  description?: string;
  daysUntil: number;
  category: string;
  href?: string;
  blocking: boolean;
};

export type OwnerDashboardActionCategory =
  | "draft"
  | "financial"
  | "attendance"
  | "team"
  | "roster"
  | "staff"
  | "facilities"
  | "marketing"
  | "sponsorship"
  | "notifications"
  | "calendar"
  | "contracts"
  | "free_agency"
  | "relocation"
  | "narrative";

export type OwnerDashboardActionItem = {
  id: string;
  category: OwnerDashboardActionCategory;
  severity: OwnerDashboardActionSeverity;
  title: string;
  what: string;
  why: string;
  evidence: string[];
  href: string;
  hrefLabel: string;
};

export type OwnerDashboardInsight = {
  id: string;
  text: string;
};

export type OwnerDashboardMetricContext = {
  /** Secondary interpretive line; never a fake "this month" label. */
  text: string;
  direction?: "up" | "down" | "flat";
};

export type OwnerDashboardHealth = {
  cash: number;
  revenue: number;
  expenses: number;
  netIncome: number;
  franchiseValue: number;
  franchiseStanding: FranchiseStanding;
  topPositiveDriver: FranchiseValueDriverKey | null;
  topNegativeDriver: FranchiseValueDriverKey | null;
  financialHealth: FinancialHealthState;
  cashContext: OwnerDashboardMetricContext | null;
  attendance: number | null;
  attendanceFillRatePct: number | null;
  attendanceTrend: OwnerDashboardMetricContext | null;
  ticketPrice: number;
  ticketPriceVsLeaguePct: number | null;
  fanSentiment: number;
  franchiseReputation: number;
  marketSize: number;
  awareness: number;
  /** Six-dimension Franchise Health analytical layer. */
  franchiseHealth: FranchiseHealthView;
};

export type OwnerDashboardRosterProblem = {
  playerId: string;
  name: string;
  kind: string;
};

export type OwnerDashboardTeam = {
  wins: number;
  losses: number;
  leagueRank: number | null;
  conferenceRank: number | null;
  conferenceName: string | null;
  strength: number;
  payroll: number;
  payrollVsLeaguePct: number | null;
  rosterProblems: OwnerDashboardRosterProblem[];
  upcomingGames: ScheduleGameView[];
};

export type OwnerDashboardOwner = {
  patience: number;
  objectives: ObjectiveView[];
  primaryObjectives: ObjectiveView[];
  secondaryObjectives: ObjectiveView[];
  longTermObjectives: ObjectiveView[];
  completedObjectives: ObjectiveView[];
  failedObjectives: ObjectiveView[];
  priorities: string[];
  franchiseReputation: number;
  career: OwnerCareerEvaluation;
  ownership: OwnershipConfidenceView;
};

export type OwnerDashboardFlags = {
  userOnDraftClock: boolean;
  hasLastGameDay: boolean;
  hasUpcomingGames: boolean;
  isNewFranchise: boolean;
  /** Season Review checkpoint — time advance blocked until beginOffseason. */
  seasonReviewPending: boolean;
  /** Incoming owner decision (e.g. trade offer) pauses simulation. */
  pendingOwnerDecision: boolean;
};

export type OwnerDashboardPendingTradeOffer = {
  decisionId: string;
  offeringTeamId: string;
  offeringTeamName: string;
  offeringTeamBranding: TeamBrandingView | null;
  receivingTeamId: string;
  receivingTeamName: string;
  receivingTeamBranding: TeamBrandingView | null;
  primaryTeamId: string;
  bothSidesOwned: boolean;
  createdOn: string;
  youReceive: string[];
  theyReceive: string[];
  valueSummary: "favor_receive" | "favor_send" | "even";
  motivationLabel: string | null;
  reasons: string[];
  expiresOn: string | null;
};

export type OwnerDashboardTradeInbox = {
  totalPending: number;
  pendingForActiveTeam: number;
};

export type OwnerDashboardSeasonRecap = {
  record: string;
  playoffResult: string;
  revenue: number;
  expenses: number;
  netIncome: number;
  cash: number;
  franchiseValue: number;
  completedObjectives: number;
  failedObjectives: number;
  story: string;
};

export type OwnerDashboardSituationView = {
  id: string;
  detectorKey: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  summary: string;
  body: string;
  updatedOn: string;
  evidence: Record<string, number | boolean | string>;
  actions: {
    id: string;
    label: string;
    href?: string;
    effectSummary?: string;
  }[];
};

export type OwnerDashboardView = {
  saveId: string;
  currentDate: string;
  seasonYear: number;
  seasonPhase: string;
  offseasonStage: string;
  calendarDisplayLabel: string;
  seasonSegment: string;
  seasonStory: string;
  tradesOpen: boolean;
  daysUntilTradeDeadline: number | null;
  offseasonPriorities: readonly string[];
  seasonRecap: OwnerDashboardSeasonRecap | null;
  /** Latest cached annual report for the controlled team, if any. */
  annualReport:
    | import("@/domain/entities/annual-franchise-report").AnnualFranchiseReport
    | null;
  /** Active historical milestones (approaching / projected / achieved this season). */
  historicalMilestones: import("@/domain/entities/historical-milestone").MilestoneResult[];
  /** Current franchise era, if detectable. */
  currentEra: import("@/domain/entities/franchise-era").FranchiseEra | null;
  leagueName: string;
  controlledTeam: {
    id: string;
    city: string;
    name: string;
    abbreviation: string;
    branding: {
      primaryColor: string;
      secondaryColor: string;
      accentColor: string;
      logoId: string;
    };
  };
  health: OwnerDashboardHealth;
  team: OwnerDashboardTeam;
  owner: OwnerDashboardOwner;
  actionItems: OwnerDashboardActionItem[];
  insights: OwnerDashboardInsight[];
  notifications: NotificationView[];
  activity: EventLogEntryView[];
  flags: OwnerDashboardFlags;
  /** Active trade offer requiring Accept / Decline / Review / Negotiate, if any. */
  pendingTradeOffer: OwnerDashboardPendingTradeOffer | null;
  tradeInbox: OwnerDashboardTradeInbox;
  situations: OwnerDashboardSituationView[];
  simulationPhase: SimulationPhaseContext;
  phaseResponsibility: PhaseResponsibility;
  /** Top franchise media feed items for dashboard League News. */
  mediaHeadlines: OwnerDashboardMediaHeadline[];
  /** Next high-importance calendar target for the controlled franchise. */
  nextImportantEvent: OwnerDashboardNextEvent | null;
};

export type CanonicalDashboardData = {
  state: GameState;
  saveId: string;
  teamId: string;
  year: number;
  snapshot: ReturnType<typeof toDashboardSnapshot>;
  business: FranchiseBusinessView;
  statement: ReturnType<typeof getFinancialStatement>;
  payroll: number;
  strength: number;
  leagueMeanTicketPrice: number | null;
  ticketPriceVsLeaguePct: number | null;
  leagueMeanPayroll: number | null;
  payrollVsLeaguePct: number | null;
  leagueMeanStrength: number | null;
  strengthVsLeaguePct: number | null;
  homeGameDays: LastGameDayView[];
  attendanceTrendPct: number | null;
  conference: { name: string; rank: number } | null;
  rosterProblems: OwnerDashboardRosterProblem[];
  vacantStarterRoles: string[];
  hasFacilityUpgradeAvailable: boolean;
  hasActiveSponsorship: boolean;
  staff: ReturnType<typeof toStaffView>;
  facilities: ReturnType<typeof toFacilitiesView>;
  sponsorships: ReturnType<typeof toSponsorshipsView>;
};
